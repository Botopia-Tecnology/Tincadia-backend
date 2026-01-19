import { Injectable, NotFoundException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PricingPlan } from './entities/pricing-plan.entity';
import { Course } from './entities/course.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { WompiService } from '../wompi/wompi.service';
import { WompiEventDto } from './dto/wompi-event.dto';
import { PurchasesService } from './purchases.service';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(PricingPlan)
        private readonly pricingPlanRepository: Repository<PricingPlan>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        private readonly wompiService: WompiService,
        private readonly configService: ConfigService,
        private readonly purchasesService: PurchasesService,
    ) { }

    /**
     * Process a direct card payment using a token from the frontend.
     * Use this when using a custom credit card form instead of the widget.
     */
    async processCardPayment(data: import('./dto/charge-card.dto').ChargeCardDto) {
        const payment = await this.findByReference(data.reference);
        if (!payment) throw new NotFoundException('Payment not found');

        this.logger.log(`Processing direct card payment for reference: ${data.reference}`);

        try {
            // 1. Create Payment Source (Vault) for recurring billing
            // This exchanges the single-use token for a reusable source ID
            const source = await this.wompiService.createPaymentSource(
                data.cardToken,
                data.email,
                data.acceptanceToken
            );

            if (!source.data?.id) {
                this.logger.error('Failed to create payment source:', source);
                throw new BadRequestException('No se pudo tokenizar la tarjeta para pagos recurrentes');
            }

            const paymentSourceId = source.data.id;
            this.logger.log(`Payment source created: ${paymentSourceId}`);

            // Wait until source is AVAILABLE (Wompi async processing)
            await this.wompiService.waitForPaymentSourceAvailable(paymentSourceId);

            // 2. Charge using the new source (Initial Payment)
            const charge = await this.wompiService.chargeWithPaymentSource(
                paymentSourceId,
                payment.amountInCents,
                payment.reference,
                data.email,
                data.installments
            );

            // Note: We don't need to manually create the subscription here because
            // the charge will trigger a "transaction.updated" webhook with status APPROVED
            // and payment_source_id. Our handleWompiEvent method already handles 
            // creating subscriptions from webhook events.

            return charge;
        } catch (error) {
            this.logger.error('Error processing card payment:', error);
            throw new BadRequestException('Error procesando el pago con tarjeta: ' + (error.message || error));
        }
    }
    /**
     * SEGURIDAD: El precio se obtiene de la base de datos, NO del frontend
     */
    async initiatePayment(data: CreatePaymentDto) {
        this.logger.log(`[initiatePayment] Data received: ${JSON.stringify(data)}`);

        try {
            let amountInCents = 0;
            let reference = '';
            let planName = '';

            // 1. Determine price based on product type
            // Enhanced check: if it's explicitly COURSE, OR if plan info indicates course purchase
            if ((data.productType === 'COURSE' || data.planType === 'course_access' || data.planId === 'course_purchase') && data.productId) {
                // Course purchase logic - fetch price from database
                const course = await this.courseRepository.findOne({
                    where: { id: data.productId }
                });

                if (!course) {
                    throw new NotFoundException(`Curso no encontrado: ${data.productId}`);
                }

                if (!course.isPaid) {
                    throw new BadRequestException('Este curso es gratuito y no requiere pago');
                }

                amountInCents = Number(course.priceCents);
                if (!amountInCents || amountInCents < 100) {
                    throw new BadRequestException('El curso no tiene un precio válido configurado');
                }

                planName = `Curso: ${course.title}`;
            } else {
                // Existing Plan Logic (Subscription)
                if (data.planId === 'course_purchase') {
                    // Safety net: if we reached here with 'course_purchase' but failed the first check (e.g. missing productId),
                    // we should fail gracefully instead of querying DB with invalid UUID
                    throw new BadRequestException('Para comprar un curso se requiere productId');
                }

                const pricingPlan = await this.pricingPlanRepository.findOne({
                    where: { id: data.planId }
                });

                if (!pricingPlan) {
                    this.logger.warn(`Plan not found: ${data.planId}`);
                    throw new NotFoundException(`Plan no encontrado: ${data.planId}`);
                }

                if (pricingPlan.isFree) {
                    throw new BadRequestException('Este plan es gratuito y no requiere pago');
                }

                amountInCents = data.billingCycle === 'anual'
                    ? Number(pricingPlan.priceAnnualInCents)
                    : Number(pricingPlan.priceMonthlyInCents);

                planName = pricingPlan.name;

                if (pricingPlan.planType && pricingPlan.planType !== data.planType) {
                    throw new ForbiddenException('Tipo de plan no coincide');
                }
            }

            if (!amountInCents || amountInCents < 100) {
                throw new BadRequestException('El precio no es válido');
            }

            // 2. Generate Reference
            reference = this.wompiService.generateReference();

            // 3. Create Pending Payment
            // Note: planId must be a valid UUID if provided, unless it's null.
            // When buying a course, we set planId to null to avoid FK constraint/UUID errors
            const planIdToSave = (data.productType === 'COURSE' || data.planType === 'course_access' || data.planId === 'course_purchase')
                ? undefined
                : (data.planId || undefined);

            const payment = this.paymentRepository.create({
                userId: data.userId || undefined,
                amountInCents,
                currency: 'COP',
                plan: data.planType || 'COURSE',
                planId: planIdToSave,
                productType: data.productType || 'PLAN',
                productId: data.productId,
                status: PaymentStatus.PENDING,
                reference,
                customerEmail: data.customerEmail,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                customerLegalId: data.customerLegalId,
                customerLegalIdType: data.customerLegalIdType,
            });

            await this.paymentRepository.save(payment);

            // 4. Prepare Widget Config
            const defaultRedirectUrl = this.configService.get<string>(
                'WOMPI_REDIRECT_URL',
                'https://www.tincadia.com/pagos/respuesta'
            );
            const redirectUrl = data.redirectUrl || defaultRedirectUrl;

            const widgetConfig = this.wompiService.prepareWidgetConfig({
                reference,
                amountInCents,
                currency: 'COP',
                customerEmail: data.customerEmail,
                customerFullName: data.customerName,
                customerPhoneNumber: data.customerPhone,
                customerPhonePrefix: data.customerPhonePrefix,
                customerLegalId: data.customerLegalId,
                customerLegalIdType: data.customerLegalIdType,
                redirectUrl,
                plan: data.planType || 'Individual Course',
            });

            this.logger.log(`Payment initiated: ${reference} for ${amountInCents} (Product: ${data.productType || 'PLAN'})`);

            return {
                paymentId: payment.id,
                reference,
                widgetConfig,
                widgetScriptUrl: this.wompiService.getWidgetScriptUrl(),
                checkoutUrl: this.wompiService.getCheckoutUrl(),
            };
        } catch (error) {
            this.logger.error(`[initiatePayment] Error initiating payment: ${error.message}`, error.stack);
            // Throw RpcException to ensure the message reaches the gateway/frontend
            throw new RpcException({
                statusCode: 400,
                message: `Payment Init Failed: ${error.message}`,
                error: 'Bad Request'
            });
        }
    }

    /**
     * Procesa eventos de webhook de Wompi
     */
    async handleWompiEvent(event: WompiEventDto, checksum: string) {
        this.logger.log(`Received Wompi event: ${event.event}`);

        // Validar firma del evento
        const isValid = this.wompiService.validateEventSignature(
            event.signature.properties,
            event.data,
            event.timestamp,
            checksum
        );

        if (!isValid) {
            this.logger.warn(`Invalid event signature for transaction ${event.data.transaction.id}`);
            throw new BadRequestException('Invalid event signature');
        }

        const transaction = event.data.transaction;

        // Buscar pago por referencia
        const payment = await this.paymentRepository.findOne({
            where: { reference: transaction.reference }
        });

        if (!payment) {
            this.logger.warn(`Payment not found for reference: ${transaction.reference}`);
            throw new NotFoundException(`Payment not found for reference: ${transaction.reference}`);
        }

        // Actualizar datos de la transacción
        payment.wompiTransactionId = transaction.id;
        payment.status = transaction.status as PaymentStatus;
        payment.paymentMethodType = transaction.payment_method_type || '';

        // Actualizar datos del cliente si vienen de Wompi
        if (transaction.customer_email) {
            payment.customerEmail = transaction.customer_email;
        }
        if (transaction.customer_data) {
            payment.customerName = transaction.customer_data.full_name || payment.customerName;
            payment.customerPhone = transaction.customer_data.phone_number || payment.customerPhone;
            payment.customerLegalId = transaction.customer_data.legal_id || payment.customerLegalId;
            payment.customerLegalIdType = transaction.customer_data.legal_id_type || payment.customerLegalIdType;
        }

        // Marcar como finalizado
        if (['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status)) {
            payment.finalizedAt = transaction.finalized_at ? new Date(transaction.finalized_at) : new Date();
        }

        await this.paymentRepository.save(payment);

        this.logger.log(`Payment ${payment.reference} updated to status: ${payment.status}`);

        // If payment is APPROVED
        if (transaction.status === 'APPROVED') {
            if (payment.productType === 'COURSE' && payment.productId) {
                await this.createPurchaseFromPayment(payment);
            } else if (transaction.payment_method_type === 'CARD') {
                // Existing subscription logic for PLAN
                await this.createSubscriptionFromPayment(payment, transaction);
            }
        }

        return { received: true };
    }

    /**
     * Create purchase record after successful one-time payment
     */
    private async createPurchaseFromPayment(payment: Payment) {
        if (!payment.productId) {
            this.logger.error(`Cannot create purchase for payment ${payment.id}: Missing productId`);
            return;
        }

        try {
            await this.purchasesService.create({
                userId: payment.userId,
                productId: payment.productId,
                productType: payment.productType || 'COURSE',
                paymentId: payment.id,
                priceInCents: payment.amountInCents,
                currency: payment.currency,
            });
            this.logger.log(`Purchase record created for user ${payment.userId}, product ${payment.productId}`);
        } catch (error) {
            this.logger.error(`Failed to create purchase record: ${error.message}`, error.stack);
        }
    }

    /**
     * Create subscription after successful card payment
     */
    private async createSubscriptionFromPayment(payment: Payment, transaction: any) {
        try {
            // Check if user already has active subscription
            const existing = await this.subscriptionRepository.findOne({
                where: { userId: payment.userId, status: 'active' }
            });

            if (existing) {
                // Update existing subscription with new payment source
                existing.paymentSourceId = transaction.payment_source_id;
                existing.lastPaymentReference = payment.reference;
                existing.failedChargeAttempts = 0;
                await this.subscriptionRepository.save(existing);
                this.logger.log(`Updated existing subscription ${existing.id} with new payment source`);
                return;
            }

            // Get billing interval from plan configuration
            let billingIntervalMonths = 1; // Default to monthly
            if (payment.planId) {
                const plan = await this.pricingPlanRepository.findOne({ where: { id: payment.planId } });
                if (plan?.billingIntervalMonths) {
                    billingIntervalMonths = plan.billingIntervalMonths;
                }
            }

            // Calculate period dates based on plan's billing interval
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + billingIntervalMonths);

            // Determine billing cycle label
            const billingCycle = billingIntervalMonths >= 12 ? 'annual' : 'monthly';

            // Extract card info if available
            const cardLastFour = transaction.payment_method?.extra?.last_four;
            const cardBrand = transaction.payment_method?.extra?.brand;

            const subscription = this.subscriptionRepository.create({
                userId: payment.userId,
                planId: payment.planId,
                paymentSourceId: transaction.payment_source_id,
                cardLastFour,
                cardBrand,
                status: 'active',
                billingCycle,
                amountCents: payment.amountInCents,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                nextChargeAt: periodEnd,
                lastPaymentReference: payment.reference,
            });

            await this.subscriptionRepository.save(subscription);
            this.logger.log(`✅ Created subscription ${subscription.id} for user ${payment.userId} with ${billingIntervalMonths} month interval`);
        } catch (error) {
            this.logger.error(`Failed to create subscription for payment ${payment.reference}:`, error);
            // Don't throw - payment was successful, subscription creation is secondary
        }
    }

    /**
     * Verifica el estado de un pago consultando directamente a Wompi
     */
    async verifyPaymentStatus(transactionId: string) {
        const wompiTransaction = await this.wompiService.getTransaction(transactionId);

        if (wompiTransaction?.data) {
            const txData = wompiTransaction.data;

            // Actualizar en nuestra BD
            const payment = await this.paymentRepository.findOne({
                where: { reference: txData.reference }
            });

            if (payment) {
                // Actualizar datos de la transacción
                payment.wompiTransactionId = txData.id;
                payment.status = txData.status as PaymentStatus;
                payment.paymentMethodType = txData.payment_method_type || '';

                // Actualizar datos del cliente si vienen de Wompi
                if (txData.customer_email) {
                    payment.customerEmail = txData.customer_email;
                }
                if (txData.customer_data) {
                    payment.customerName = txData.customer_data.full_name || payment.customerName;
                    payment.customerPhone = txData.customer_data.phone_number || payment.customerPhone;
                    payment.customerLegalId = txData.customer_data.legal_id || payment.customerLegalId;
                    payment.customerLegalIdType = txData.customer_data.legal_id_type || payment.customerLegalIdType;
                }

                // Marcar como finalizado
                if (['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(txData.status)) {
                    payment.finalizedAt = txData.finalized_at ? new Date(txData.finalized_at) : new Date();
                }

                await this.paymentRepository.save(payment);
                this.logger.log(`Payment ${payment.reference} verified and updated: ${payment.status}`);

                // If payment is APPROVED and uses CARD, create subscription for recurring payments
                if (txData.status === 'APPROVED' && txData.payment_method_type === 'CARD') {
                    await this.createSubscriptionFromPayment(payment, txData);
                }
            }

            return wompiTransaction.data;
        }

        throw new NotFoundException('Transaction not found');
    }

    async create(data: CreatePaymentDto) {
        return this.initiatePayment(data);
    }

    async findAll(query: PaymentQueryDto) {
        const { userId, status, limit = 50, page = 1 } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (userId) where.userId = userId;
        if (status) where.status = status;

        const [items, total] = await this.paymentRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
            skip,
        });

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async findOne(id: string) {
        const payment = await this.paymentRepository.findOne({ where: { id } });
        if (!payment) {
            throw new NotFoundException(`Payment with ID ${id} not found`);
        }
        return payment;
    }

    async findByReference(reference: string) {
        const payment = await this.paymentRepository.findOne({ where: { reference } });
        if (!payment) {
            throw new NotFoundException(`Payment with reference ${reference} not found`);
        }
        return payment;
    }

    async update(id: string, data: UpdatePaymentDto) {
        await this.findOne(id);
        await this.paymentRepository.update(id, data);
        return this.findOne(id);
    }

    async remove(id: string) {
        const payment = await this.findOne(id);
        return this.paymentRepository.remove(payment);
    }

    /**
     * Obtiene configuración pública de Wompi para el frontend
     */
    getWompiConfig() {
        return {
            publicKey: this.wompiService.getPublicKey(),
            widgetScriptUrl: this.wompiService.getWidgetScriptUrl(),
            checkoutUrl: this.wompiService.getCheckoutUrl(),
            isSandbox: this.wompiService.isInSandboxMode(),
        };
    }
}
