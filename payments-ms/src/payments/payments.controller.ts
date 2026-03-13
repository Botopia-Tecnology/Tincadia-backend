import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { WompiEventDto } from './dto/wompi-event.dto';

@Controller()
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @MessagePattern('payments.initiate')
    async initiatePayment(@Payload() data: CreatePaymentDto) {
        this.logger.log(`Initiating payment for plan: ${data.planType} (${data.planId})`);
        return this.paymentsService.initiatePayment(data);
    }

    @MessagePattern('payments.webhook')
    async handleWebhook(@Payload() payload: { event: WompiEventDto; checksum: string }) {
        this.logger.log(`Webhook received: ${payload.event.event}`);
        return this.paymentsService.handleWompiEvent(payload.event, payload.checksum);
    }

    @MessagePattern('payments.verify')
    async verifyPayment(@Payload() data: { transactionId: string }) {
        this.logger.log(`Verifying transaction: ${data.transactionId}`);
        return this.paymentsService.verifyPaymentStatus(data.transactionId);
    }

    @MessagePattern('payments.config')
    getWompiConfig() {
        return this.paymentsService.getWompiConfig();
    }

    @MessagePattern('payments.create')
    create(@Payload() createPaymentDto: CreatePaymentDto) {
        return this.paymentsService.create(createPaymentDto);
    }

    @MessagePattern('payments.findAll')
    findAll(@Payload() query: PaymentQueryDto) {
        return this.paymentsService.findAll(query);
    }

    @MessagePattern('payments.findOne')
    findOne(@Payload() data: { id: string }) {
        return this.paymentsService.findOne(data.id);
    }

    @MessagePattern('payments.findByReference')
    findByReference(@Payload() data: { reference: string }) {
        return this.paymentsService.findByReference(data.reference);
    }

    @MessagePattern('payments.update')
    update(@Payload() data: { id: string; updatePaymentDto: UpdatePaymentDto }) {
        return this.paymentsService.update(data.id, data.updatePaymentDto);
    }

    @MessagePattern('payments.remove')
    remove(@Payload() data: { id: string }) {
        return this.paymentsService.remove(data.id);
    }

    @MessagePattern('payments.charge-card')
    chargeCard(@Payload() data: import('./dto/charge-card.dto').ChargeCardDto) {
        this.logger.log(`Processing card charge for reference: ${data.reference}`);
        return this.paymentsService.processCardPayment(data);
    }
}
