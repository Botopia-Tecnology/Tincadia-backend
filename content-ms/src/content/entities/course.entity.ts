import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Category } from './category.entity';
import { Module } from './module.entity';

@Entity('courses')
export class Course {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ nullable: true })
    thumbnailUrl: string;

    @ManyToOne(() => Category, (category) => category.courses, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'category_id' })
    category: Category;

    @Column({ name: 'category_id', type: 'uuid' })
    categoryId: string;

    @OneToMany(() => Module, (module) => module.course)
    modules: Module[];

    @Column({ default: false })
    isPublished: boolean;

    @Column({
        name: 'access_scope',
        type: 'varchar',
        length: 20,
        default: 'free',
        comment: 'Defines access control scope: course | module | lesson'
    })
    accessScope: string;

    @Column({ name: 'is_paid', default: false, comment: 'If true and accessScope=course, entire course is paywalled' })
    isPaid: boolean;

    @Column({
        name: 'preview_limit',
        type: 'int',
        nullable: true,
        comment: 'How many lessons can be free previews (e.g., 3-4). Optional.'
    })
    previewLimit: number | null;

    @Column({
        name: 'price_cents',
        type: 'int',
        default: 0,
        comment: 'Price in cents (e.g., 5000000 for 50,000 COP)'
    })
    priceInCents: number;

    @Column({
        name: 'currency',
        type: 'varchar',
        length: 3,
        default: 'COP'
    })
    currency: string;

    @Column({
        name: 'learning_points',
        type: 'text',
        array: true,
        default: '{}',
        nullable: true,
        comment: 'Key learning objectives for the course landing page'
    })
    learningPoints: string[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
