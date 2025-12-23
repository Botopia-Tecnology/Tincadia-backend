import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @MessagePattern('send_push_notification')
    async sendPushNotification(
        @Payload() data: { to: string; title: string; body: string; data?: any },
    ) {
        return this.notificationsService.sendPushNotification(data);
    }
}
