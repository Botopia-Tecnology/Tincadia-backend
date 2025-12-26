/**
 * User Notification Read Entity
 * 
 * Tracks which notifications have been read by each user
 */

import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('user_notification_reads')
export class UserNotificationRead {
    @PrimaryColumn({ name: 'user_id' })
    userId: string;

    @PrimaryColumn({ name: 'notification_id' })
    notificationId: string;

    @CreateDateColumn({ name: 'read_at' })
    readAt: Date;
}
