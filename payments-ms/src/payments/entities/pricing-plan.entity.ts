import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Read-only entity for obtaining plan prices
 * The pricing_plans table is managed by content-ms
 * DO NOT use synchronize with this entity - read only
 */
@Entity('pricing_plans')
export class PricingPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true })
    type: string; // 'personal' | 'empresa'

    @Column({ name: 'plan_type', nullable: true })
    planType: string; // PaymentPlan enum value

    @Column({ name: 'price_monthly', nullable: true })
    priceMonthly: string;

    @Column({ name: 'price_annual', nullable: true })
    priceAnnual: string;

    @Column({ name: 'price_monthly_cents', type: 'bigint', nullable: true })
    priceMonthlyInCents: number;

    @Column({ name: 'price_annual_cents', type: 'bigint', nullable: true })
    priceAnnualInCents: number;

    @Column({ name: 'is_free', nullable: true, default: false })
    isFree: boolean;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'button_text', nullable: true })
    buttonText: string;

    @Column('jsonb', { default: [] })
    includes: string[];

    @Column('jsonb', { default: [] })
    excludes: string[];

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ default: 0 })
    order: number;
}
