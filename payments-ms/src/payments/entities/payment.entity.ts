import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PaymentStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    DECLINED = 'DECLINED',
    VOIDED = 'VOIDED',
    ERROR = 'ERROR',
}

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id', nullable: true })
    userId: string;

    @Column({ type: 'bigint', name: 'amount_in_cents' })
    amountInCents: number;

    @Column({ length: 10, default: 'COP' })
    currency: string;

    @Column({ length: 50, nullable: true })
    plan: string;

    @Column({ name: 'plan_id', type: 'uuid', nullable: true })
    planId: string;

    @Column({ name: 'product_type', default: 'PLAN' })
    productType: 'PLAN' | 'COURSE';

    @Column({ name: 'product_id', nullable: true })
    productId: string;

    @Column({ length: 20, default: PaymentStatus.PENDING })
    status: PaymentStatus;

    @Column({ name: 'wompi_transaction_id', nullable: true })
    wompiTransactionId: string;

    @Column({ length: 100, unique: true })
    reference: string;

    @Column({ name: 'payment_method_type', nullable: true })
    paymentMethodType: string; // CARD, NEQUI, PSE, BANCOLOMBIA_TRANSFER, etc.

    @Column({ name: 'customer_email', nullable: true })
    customerEmail: string;

    @Column({ name: 'customer_name', nullable: true })
    customerName: string;

    @Column({ name: 'customer_phone', nullable: true })
    customerPhone: string;

    @Column({ name: 'customer_legal_id', nullable: true })
    customerLegalId: string;

    @Column({ name: 'customer_legal_id_type', nullable: true })
    customerLegalIdType: string;

    @Column({ name: 'finalized_at', nullable: true })
    finalizedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
