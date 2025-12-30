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

    @ManyToOne(() => Category, (category) => category.courses)
    @JoinColumn({ name: 'category_id' })
    category: Category;

    @Column({ name: 'category_id', type: 'uuid' })
    categoryId: string;

    @OneToMany(() => Module, (module) => module.course)
    modules: Module[];

    @Column({ default: false })
    isPublished: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
