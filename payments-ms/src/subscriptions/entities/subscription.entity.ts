import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PricingPlan } from '../../payments/entities/pricing-plan.entity';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';
export type BillingCycle = 'monthly' | 'annual';

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    userId: string;

    @Column({ name: 'plan_id', type: 'uuid', nullable: true })
    planId: string;

    @ManyToOne(() => PricingPlan, { nullable: true })
    @JoinColumn({ name: 'plan_id' })
    plan: PricingPlan;

    // Wompi payment source token for recurring charges
    @Column({ name: 'payment_source_id', nullable: true })
    paymentSourceId: string;

    // Card info (last 4 digits for display)
    @Column({ name: 'card_last_four', nullable: true })
    cardLastFour: string;

    @Column({ name: 'card_brand', nullable: true })
    cardBrand: string;

    @Column({
        type: 'varchar',
        default: 'active'
    })
    status: SubscriptionStatus;

    @Column({ name: 'billing_cycle', type: 'varchar' })
    billingCycle: BillingCycle;

    @Column({ name: 'amount_cents', type: 'bigint' })
    amountCents: number;

    @Column({ name: 'currency', default: 'COP' })
    currency: string;

    @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
    currentPeriodStart: Date;

    @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
    currentPeriodEnd: Date;

    @Column({ name: 'next_charge_at', type: 'timestamptz', nullable: true })
    nextChargeAt: Date;

    @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
    canceledAt: Date;

    @Column({ name: 'cancel_at_period_end', default: false })
    cancelAtPeriodEnd: boolean;

    // Last successful payment reference
    @Column({ name: 'last_payment_reference', nullable: true })
    lastPaymentReference: string;

    // Number of failed charge attempts
    @Column({ name: 'failed_charge_attempts', default: 0 })
    failedChargeAttempts: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
