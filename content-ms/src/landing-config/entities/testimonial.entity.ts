import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('testimonials')
export class Testimonial {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'author_name' })
    authorName: string;

    @Column({ name: 'author_role' })
    authorRole: string;

    @Column('text')
    quote: string;

    @Column({ default: 5 })
    rating: number;

    @Column({ default: 0 })
    order: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
