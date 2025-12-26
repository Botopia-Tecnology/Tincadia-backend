/**
 * App Notification Entity
 * 
 * Entity for app-wide notifications like news, updates, and promotions
 * Different from push notifications - these are stored and displayed in-app
 */

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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

    @Column({
        type: 'enum',
        enum: NotificationType,
        default: NotificationType.NEWS,
    })
    type: NotificationType;

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
