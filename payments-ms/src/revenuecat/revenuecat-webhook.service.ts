import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';

/**
 * Mapea los Product IDs de Apple/Google al planType interno de Tincadia
 * Esto conecta lo que RevenueCat nos dice con los planes que ya existen en la DB
 */
const PRODUCT_ID_TO_PLAN_TYPE: Record<string, string> = {
    'com.tincadia.app.premium.mensual': 'personal_premium',
    'com.tincadia.app.basico.mensual': 'personal_basico',
};

@Injectable()
export class RevenueCatWebhookService {
    private readonly logger = new Logger(RevenueCatWebhookService.name);

    constructor(
        @InjectRepository(Subscription)
        private readonly subscriptionRepo: Repository<Subscription>,
    ) { }

    async handleEvent(event: any): Promise<{ received: boolean }> {
        const eventType: string = event?.event?.type;
        const appUserId: string = event?.event?.app_user_id;
        const productId: string = event?.event?.product_id;
        const expirationAtMs: number = event?.event?.expiration_at_ms;

        this.logger.log(`📲 [RevenueCat] Event: ${eventType} | User: ${appUserId} | Product: ${productId}`);

        if (!appUserId) {
            this.logger.warn('[RevenueCat] Received event without app_user_id, ignoring.');
            return { received: true };
        }

        switch (eventType) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'UNCANCELLATION':
                await this.handlePurchase(appUserId, productId, expirationAtMs);
                break;

            case 'CANCELLATION':
            case 'EXPIRATION':
                await this.handleCancellation(appUserId);
                break;

            default:
                this.logger.log(`[RevenueCat] Unhandled event type: ${eventType}`);
        }

        return { received: true };
    }

    private async handlePurchase(
        userId: string,
        productId: string,
        expirationAtMs?: number,
    ): Promise<void> {
        const planType = PRODUCT_ID_TO_PLAN_TYPE[productId];
        const periodEnd = expirationAtMs ? new Date(expirationAtMs) : undefined;

        // Check if subscription already exists for this user from mobile
        const existing = await this.subscriptionRepo.findOne({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        if (existing) {
            // Update existing record
            existing.status = 'active';
            existing.cancelAtPeriodEnd = false;
            if (planType) (existing as any).planType = planType;
            if (periodEnd) existing.currentPeriodEnd = periodEnd;
            existing.lastPaymentReference = `revenuecat_${productId}`;
            await this.subscriptionRepo.save(existing);
            this.logger.log(`✅ [RevenueCat] Updated subscription for user ${userId} → ${planType}`);
        } else {
            // Create a new lightweight record to track the mobile purchase
            const now = new Date();
            const sub = this.subscriptionRepo.create({
                userId,
                planId: undefined,
                status: 'active',
                billingCycle: 'monthly',
                amountCents: 0, // Managed by Apple/Google, not by us
                currency: 'COP',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                lastPaymentReference: `revenuecat_${productId}`,
            });
            await this.subscriptionRepo.save(sub);
            this.logger.log(`✅ [RevenueCat] Created new subscription record for user ${userId} → ${planType}`);
        }
    }

    private async handleCancellation(userId: string): Promise<void> {
        const sub = await this.subscriptionRepo.findOne({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        if (sub) {
            sub.status = 'canceled';
            sub.canceledAt = new Date();
            await this.subscriptionRepo.save(sub);
            this.logger.log(`🚫 [RevenueCat] Subscription canceled for user ${userId}`);
        }
    }
}
