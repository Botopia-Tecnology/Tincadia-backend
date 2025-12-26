import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AppNotificationsService } from './app-notifications.service';

@Module({
    providers: [NotificationsService, AppNotificationsService],
    controllers: [NotificationsController],
    exports: [AppNotificationsService],
})
export class NotificationsModule { }
