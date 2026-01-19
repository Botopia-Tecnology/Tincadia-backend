import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription, BillingCycle } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { WompiService } from '../wompi/wompi.service';

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        @InjectRepository(Subscription)
        private readonly subscriptionRepo: Repository<Subscription>,
        private readonly wompiService: WompiService,
    ) { }

    /**
     * Create a new subscription after successful first payment
     */
    async create(dto: CreateSubscriptionDto): Promise<Subscription> {
        const now = new Date();
        const periodEnd = this.calculatePeriodEnd(now, dto.billingCycle);

        const subscription = this.subscriptionRepo.create({
            userId: dto.userId,
            planId: dto.planId,
            paymentSourceId: dto.paymentSourceId,
            billingCycle: dto.billingCycle,
            amountCents: dto.amountCents,
            cardLastFour: dto.cardLastFour,
            cardBrand: dto.cardBrand,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            nextChargeAt: periodEnd,
            lastPaymentReference: dto.paymentReference,
        });

        const saved = await this.subscriptionRepo.save(subscription);
        this.logger.log(`✅ Created subscription ${saved.id} for user ${dto.userId}`);
        return saved;
    }

    /**
     * Find all subscriptions (paginated)
     */
    async findAll(query: { page?: number; limit?: number; status?: string; planId?: string }): Promise<{ items: Subscription[]; total: number }> {
        const { page = 1, limit = 50, status, planId } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (planId) where.planId = planId;

        const [items, total] = await this.subscriptionRepo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
            skip,
            relations: ['plan']
        });

        return { items, total };
    }

    /**
     * Find subscription by user ID
     */
    async findByUserId(userId: string): Promise<Subscription | null> {
        return this.subscriptionRepo.findOne({
            where: { userId, status: In(['active', 'trialing', 'past_due']) },
            order: { createdAt: 'DESC' },
            relations: ['plan']
        });
    }

    /**
     * Find subscription by ID
     */
    async findOne(id: string): Promise<Subscription> {
        const sub = await this.subscriptionRepo.findOne({ where: { id } });
        if (!sub) throw new NotFoundException('Subscription not found');
        return sub;
    }

    /**
     * Update subscription
     */
    async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
        const sub = await this.findOne(id);
        Object.assign(sub, dto);
        return this.subscriptionRepo.save(sub);
    }

    /**
     * Cancel subscription (immediately or at period end)
     */
    async cancel(id: string, immediate: boolean = false): Promise<Subscription> {
        const sub = await this.findOne(id);

        if (immediate) {
            sub.status = 'canceled';
            sub.canceledAt = new Date();
        } else {
            sub.cancelAtPeriodEnd = true;
        }

        this.logger.log(`🚫 Subscription ${id} ${immediate ? 'canceled immediately' : 'set to cancel at period end'}`);
        return this.subscriptionRepo.save(sub);
    }

    /**
     * Update payment source (for card updates)
     */
    async updatePaymentSource(
        id: string,
        paymentSourceId: string,
        cardLastFour?: string,
        cardBrand?: string
    ): Promise<Subscription> {
        const sub = await this.findOne(id);
        sub.paymentSourceId = paymentSourceId;
        if (cardLastFour) sub.cardLastFour = cardLastFour;
        if (cardBrand) sub.cardBrand = cardBrand;
        sub.failedChargeAttempts = 0; // Reset failed attempts
        return this.subscriptionRepo.save(sub);
    }

    /**
     * Process a renewal charge for a subscription
     */
    async processRenewal(subscription: Subscription): Promise<boolean> {
        if (!subscription.paymentSourceId) {
            this.logger.warn(`⚠️ Subscription ${subscription.id} has no payment source`);
            return false;
        }

        const reference = this.wompiService.generateReference('REN');

        try {
            this.logger.log(`💳 Processing renewal for subscription ${subscription.id}`);

            const result = await this.wompiService.chargeWithPaymentSource(
                subscription.paymentSourceId,
                subscription.amountCents,
                reference,
                subscription.userId // Will need to get email from profile
            );

            if (result.data?.status === 'APPROVED') {
                // Renewal successful
                const now = new Date();
                const newPeriodEnd = this.calculatePeriodEnd(now, subscription.billingCycle);

                subscription.currentPeriodStart = now;
                subscription.currentPeriodEnd = newPeriodEnd;
                subscription.nextChargeAt = newPeriodEnd;
                subscription.lastPaymentReference = reference;
                subscription.failedChargeAttempts = 0;
                subscription.status = 'active';

                await this.subscriptionRepo.save(subscription);
                this.logger.log(`✅ Renewal successful for subscription ${subscription.id}`);
                return true;
            } else {
                // Renewal failed
                subscription.failedChargeAttempts += 1;
                subscription.status = 'past_due';
                await this.subscriptionRepo.save(subscription);
                this.logger.warn(`❌ Renewal failed for subscription ${subscription.id}: ${result.data?.status}`);
                return false;
            }
        } catch (error) {
            subscription.failedChargeAttempts += 1;
            subscription.status = 'past_due';
            await this.subscriptionRepo.save(subscription);
            this.logger.error(`❌ Renewal error for subscription ${subscription.id}:`, error);
            return false;
        }
    }

    /**
     * CRON: Process due renewals every day at 6 AM
     */
    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async processDueRenewals() {
        this.logger.log('🔄 Starting daily renewal processing...');

        const now = new Date();
        const dueSubscriptions = await this.subscriptionRepo.find({
            where: {
                status: In(['active', 'past_due']),
                nextChargeAt: LessThanOrEqual(now),
            }
        });

        this.logger.log(`📋 Found ${dueSubscriptions.length} subscriptions due for renewal`);

        for (const sub of dueSubscriptions) {
            // Check if should cancel at period end
            if (sub.cancelAtPeriodEnd) {
                sub.status = 'canceled';
                sub.canceledAt = now;
                await this.subscriptionRepo.save(sub);
                this.logger.log(`🚫 Subscription ${sub.id} canceled at period end`);
                continue;
            }

            // Skip if too many failed attempts
            if (sub.failedChargeAttempts >= 3) {
                this.logger.warn(`⚠️ Subscription ${sub.id} has 3+ failed attempts, skipping`);
                continue;
            }

            await this.processRenewal(sub);
        }

        this.logger.log('✅ Daily renewal processing complete');
    }

    /**
     * Calculate period end date based on billing cycle
     */
    private calculatePeriodEnd(startDate: Date, cycle: BillingCycle): Date {
        const end = new Date(startDate);
        if (cycle === 'monthly') {
            end.setMonth(end.getMonth() + 1);
        } else {
            end.setFullYear(end.getFullYear() + 1);
        }
        return end;
    }

    /**
     * Check if user has active subscription
     */
    async hasActiveSubscription(userId: string): Promise<boolean> {
        const sub = await this.findByUserId(userId);
        return sub !== null && sub.status === 'active';
    }

    /**
     * Get subscription status for user
     */
    async getStatus(userId: string): Promise<{
        hasSubscription: boolean;
        status?: string;
        planId?: string;
        currentPeriodEnd?: Date;
        cancelAtPeriodEnd?: boolean;
        permissions?: string[];
    }> {
        const sub = await this.findByUserId(userId);
        if (!sub) {
            return { hasSubscription: false };
        }
        return {
            hasSubscription: true,
            status: sub.status,
            planId: sub.planId,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            permissions: sub.plan?.includes || [],
        };
    }
}
