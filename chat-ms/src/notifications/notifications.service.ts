import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private expo: Expo;

    constructor() {
        this.expo = new Expo();
    }

    /**
     * Enviar una notificación push a un token de Expo
     */
    async sendPushNotification(
        pushToken: string,
        title: string,
        body: string,
        data?: any,
        options?: { channelId?: string; sound?: string | null; priority?: 'default' | 'normal' | 'high' }
    ) {
        if (!Expo.isExpoPushToken(pushToken)) {
            this.logger.error(`Push token ${pushToken} is not a valid Expo push token`);
            return;
        }

        const message: ExpoPushMessage = {
            to: pushToken,
            sound: options?.sound !== undefined ? options.sound : 'default',
            title,
            body,
            data: data || {},
            priority: options?.priority || 'high',
            channelId: options?.channelId,
        };

        try {
            const chunks = this.expo.chunkPushNotifications([message]);
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                    this.logger.log('Notification sent successfully:', ticketChunk);
                } catch (error) {
                    this.logger.error('Error sending notification chunk:', error);
                }
            }
        } catch (error) {
            this.logger.error('Error chunking notifications:', error);
        }
    }
}
