
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('purchases')
export class Purchase {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'product_id' })
    productId: string;

    @Column({ name: 'product_type', default: 'COURSE' })
    productType: string;

    @Column({ name: 'payment_id', nullable: true })
    paymentId: string;

    @Column({ name: 'price_cents', type: 'bigint' })
    priceInCents: number;

    @Column({ name: 'currency', default: 'COP' })
    currency: string;

    @CreateDateColumn({ name: 'purchased_at' })
    purchasedAt: Date;
}
