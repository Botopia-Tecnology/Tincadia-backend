/**
 * App Notifications Service
 * 
 * Service for managing in-app notifications (news, updates, promotions)
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { CreateAppNotificationDto, UpdateAppNotificationDto } from './dto/app-notification.dto';

@Injectable()
export class AppNotificationsService {
    private readonly logger = new Logger(AppNotificationsService.name);
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
        const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY')!;

        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    /**
     * Get all active notifications (ordered by priority and date)
     */
    async getActiveNotifications(): Promise<any[]> {
        const now = new Date().toISOString();

        const { data, error } = await this.supabase
            .from('app_notifications')
            .select('*')
            .eq('is_active', true)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error('Error fetching notifications:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get notifications with read status for a user
     */
    async getNotificationsForUser(userId: string): Promise<any[]> {
        const notifications = await this.getActiveNotifications();

        // Get read notifications for this user
        const { data: readNotifications } = await this.supabase
            .from('user_notification_reads')
            .select('notification_id')
            .eq('user_id', userId);

        const readIds = new Set((readNotifications || []).map(r => r.notification_id));

        // Add isRead flag to each notification
        return notifications.map(n => ({
            ...n,
            isRead: readIds.has(n.id),
        }));
    }

    /**
     * Get unread count for a user
     */
    async getUnreadCount(userId: string): Promise<number> {
        const notifications = await this.getNotificationsForUser(userId);
        return notifications.filter(n => !n.isRead).length;
    }

    /**
     * Mark a notification as read for a user
     */
    async markAsRead(userId: string, notificationId: string): Promise<boolean> {
        const { error } = await this.supabase
            .from('user_notification_reads')
            .upsert({
                user_id: userId,
                notification_id: notificationId,
                read_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,notification_id',
            });

        if (error) {
            this.logger.error('Error marking as read:', error);
            return false;
        }

        return true;
    }

    /**
     * Create a new notification (admin only)
     */
    async createNotification(dto: CreateAppNotificationDto): Promise<any> {
        const { data, error } = await this.supabase
            .from('app_notifications')
            .insert({
                title: dto.title,
                message: dto.message,
                type: dto.type || 'news',
                image_url: dto.imageUrl,
                link_url: dto.linkUrl,
                priority: dto.priority || 0,
                expires_at: dto.expiresAt,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            this.logger.error('Error creating notification:', error);
            throw error;
        }

        return data;
    }

    /**
     * Update a notification (admin only)
     */
    async updateNotification(id: string, dto: UpdateAppNotificationDto): Promise<any> {
        const updateData: any = {};

        if (dto.title !== undefined) updateData.title = dto.title;
        if (dto.message !== undefined) updateData.message = dto.message;
        if (dto.type !== undefined) updateData.type = dto.type;
        if (dto.imageUrl !== undefined) updateData.image_url = dto.imageUrl;
        if (dto.linkUrl !== undefined) updateData.link_url = dto.linkUrl;
        if (dto.isActive !== undefined) updateData.is_active = dto.isActive;
        if (dto.priority !== undefined) updateData.priority = dto.priority;
        if (dto.expiresAt !== undefined) updateData.expires_at = dto.expiresAt;

        const { data, error } = await this.supabase
            .from('app_notifications')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error('Error updating notification:', error);
            throw error;
        }

        if (!data) {
            throw new NotFoundException(`Notification ${id} not found`);
        }

        return data;
    }

    /**
     * Delete a notification (admin only)
     */
    async deleteNotification(id: string): Promise<boolean> {
        const { error } = await this.supabase
            .from('app_notifications')
            .delete()
            .eq('id', id);

        if (error) {
            this.logger.error('Error deleting notification:', error);
            return false;
        }

        return true;
    }

    /**
     * Get all notifications (admin - includes inactive)
     */
    async getAllNotifications(): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('app_notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error('Error fetching all notifications:', error);
            throw error;
        }

        return data || [];
    }
}
