import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import { AppNotificationsService } from './app-notifications.service';
import { CreateAppNotificationDto, UpdateAppNotificationDto } from './dto/app-notification.dto';

@Controller()
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly appNotificationsService: AppNotificationsService,
    ) { }

    @MessagePattern('send_push_notification')
    async sendPushNotification(
        @Payload() data: { to: string; title: string; body: string; data?: any },
    ) {
        return this.notificationsService.sendPushNotification(data);
    }

    // ==================== App Notifications ====================

    @MessagePattern('get_app_notifications')
    async getAppNotifications(@Payload() data: { userId?: string }) {
        if (data.userId) {
            return this.appNotificationsService.getNotificationsForUser(data.userId);
        }
        return this.appNotificationsService.getActiveNotifications();
    }

    @MessagePattern('get_unread_count')
    async getUnreadCount(@Payload() data: { userId: string }) {
        return { count: await this.appNotificationsService.getUnreadCount(data.userId) };
    }

    @MessagePattern('mark_notification_read')
    async markAsRead(@Payload() data: { userId: string; notificationId: string }) {
        const success = await this.appNotificationsService.markAsRead(data.userId, data.notificationId);
        return { success };
    }

    @MessagePattern('create_app_notification')
    async createNotification(@Payload() dto: CreateAppNotificationDto) {
        return this.appNotificationsService.createNotification(dto);
    }

    @MessagePattern('update_app_notification')
    async updateNotification(@Payload() data: { id: string; dto: UpdateAppNotificationDto }) {
        return this.appNotificationsService.updateNotification(data.id, data.dto);
    }

    @MessagePattern('delete_app_notification')
    async deleteNotification(@Payload() data: { id: string }) {
        const success = await this.appNotificationsService.deleteNotification(data.id);
        return { success };
    }

    @MessagePattern('get_all_app_notifications')
    async getAllNotifications() {
        return this.appNotificationsService.getAllNotifications();
    }
}
