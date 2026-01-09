import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserType {
    PERSONAL = 'personal',
    EMPRESA = 'empresa',
}

@Entity('pricing_plans')
export class PricingPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: UserType,
        default: UserType.PERSONAL
    })
    type: UserType;

    @Column({ default: '0' })
    price_monthly: string;

    @Column({ nullable: true })
    price_annual: string;

    @Column('text')
    description: string;

    @Column({ nullable: true })
    button_text: string;

    @Column('jsonb', { default: [] })
    includes: string[];

    @Column('jsonb', { default: [] })
    excludes: string[];

    @Column({ default: true })
    is_active: boolean;

    @Column({ default: 0 })
    order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
