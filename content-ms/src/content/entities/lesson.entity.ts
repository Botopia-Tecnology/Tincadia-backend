import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Module } from './module.entity';

@Entity('lessons')
export class Lesson {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    content: string;

    @Column({ nullable: true })
    videoUrl: string; // Cloudinary URL

    @Column({ nullable: true })
    durationSeconds: number;

    @ManyToOne(() => Module, (module) => module.lessons, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'module_id' })
    module: Module;

    @Column({ name: 'module_id', type: 'uuid' })
    moduleId: string;

    @Column({ default: 0 })
    order: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
