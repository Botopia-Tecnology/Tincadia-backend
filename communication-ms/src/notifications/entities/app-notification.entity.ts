import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { NotificationCategory } from './notification-category.entity';

export enum NotificationType {
    NEWS = 'news',
    UPDATE = 'update',
    PROMOTION = 'promotion',
}

@Entity('app_notifications')
export class AppNotification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column('text')
    message: string;

    // Type can now be a generic string (legacy support + custom types by name)
    @Column({ default: 'news' })
    type: string;

    @Column({ name: 'category_id', nullable: true })
    categoryId?: string;

    @ManyToOne(() => NotificationCategory, { nullable: true, eager: true })
    @JoinColumn({ name: 'category_id' })
    category?: NotificationCategory;

    @Column({ name: 'image_url', nullable: true })
    imageUrl?: string;

    @Column({ name: 'link_url', nullable: true })
    linkUrl?: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ default: 0 })
    priority: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'expires_at', nullable: true })
    expiresAt?: Date;
}

