import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Read-only entity to fetch course price for payment processing.
 * This mirrors the courses table from content-ms but only includes
 * fields needed for payment validation.
 */
@Entity('courses')
export class Course {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ name: 'price_cents', type: 'bigint', default: 0 })
    priceCents: number;

    @Column({ default: 'COP' })
    currency: string;

    @Column({ name: 'is_paid', default: false })
    isPaid: boolean;
}
