import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pricing_plans')
export class PricingPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true })
    type: string; // 'personal' | 'empresa'

    @Column({ name: 'price_monthly', nullable: true })
    price_monthly: string;

    @Column({ name: 'price_annual', nullable: true })
    price_annual: string;

    @Column({ name: 'price_monthly_cents', type: 'bigint', nullable: true })
    price_monthly_cents: number;

    @Column({ name: 'price_annual_cents', type: 'bigint', nullable: true })
    price_annual_cents: number;

    @Column({ name: 'plan_type', nullable: true })
    plan_type: string;

    @Column({ name: 'is_free', default: false })
    is_free: boolean;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'button_text', nullable: true })
    button_text: string;

    @Column('jsonb', { default: [] })
    includes: string[];

    @Column('jsonb', { default: [] })
    excludes: string[];

    @Column({ name: 'is_active', default: true })
    is_active: boolean;

    // Billing interval in months: 1=monthly, 2=bimonthly, 3=quarterly, 6=semiannual, 12=annual
    @Column({ name: 'billing_interval_months', type: 'int', default: 1 })
    billing_interval_months: number;

    @Column({ default: 0 })
    order: number;
}
