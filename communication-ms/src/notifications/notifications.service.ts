import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private expo: Expo;

    constructor() {
        this.expo = new Expo();
    }

    async sendPushNotification(data: {
        to: string;
        title: string;
        body: string;
        data?: any;
    }) {
        this.logger.log(`Push notification request - Token: ${data.to.substring(0, 20)}...`);

        if (!Expo.isExpoPushToken(data.to)) {
            this.logger.error(`Invalid Expo push token: ${data.to}`);
            return { success: false, error: 'Invalid token' };
        }

        const message: ExpoPushMessage = {
            to: data.to,
            sound: 'default',
            title: data.title,
            body: data.body,
            data: data.data || {},
            priority: 'high',
        };

        this.logger.log(`Prepared notification: ${data.title}`);

        try {
            const chunks = this.expo.chunkPushNotifications([message]);
            this.logger.log(`Created ${chunks.length} chunk(s)`);

            for (const chunk of chunks) {
                try {
                    this.logger.log('Sending to Expo servers...');
                    const tickets = await this.expo.sendPushNotificationsAsync(chunk);
                    this.logger.log('SUCCESS - Tickets:', JSON.stringify(tickets));
                } catch (error) {
                    this.logger.error('Error sending chunk:', error);
                }
            }
            return { success: true };
        } catch (error) {
            this.logger.error('Error preparing notification:', error);
            return { success: false, error: error.message };
        }
    }
}
