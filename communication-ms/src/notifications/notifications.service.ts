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
        this.logger.log(`🚀 Sending Push to: ${data.to} | Title: ${data.title}`);

        if (!Expo.isExpoPushToken(data.to)) {
            this.logger.error(`❌ Invalid Expo push token: ${data.to}`);
            return { success: false, error: 'Invalid token' };
        }

        const message: ExpoPushMessage = {
            to: data.to,
            sound: 'default',
            title: data.title,
            body: data.body,
            data: data.data || {},
            priority: 'high',
            channelId: 'default',
        };

        try {
            const chunks = this.expo.chunkPushNotifications([message]);

            for (const chunk of chunks) {
                try {
                    const ticketChunks = await this.expo.sendPushNotificationsAsync(chunk);
                    this.logger.log(`✅ Expo API Response (Tickets): ${JSON.stringify(ticketChunks)}`);

                    // Check for errors in tickets
                    for (const ticket of ticketChunks) {
                        if (ticket.status === 'error') {
                            this.logger.error(`❌ Expo Delivery Error: ${ticket.message} (${ticket.details?.error})`);
                            // Examples: DeviceNotRegistered, MessageTooBig, MessageRateExceeded
                        } else {
                            this.logger.log(`✨ Notification Ticket ID: ${ticket.id}`);
                        }
                    }
                } catch (error) {
                    this.logger.error('❌ Error sending chunk to Expo:', error);
                }
            }
            return { success: true };
        } catch (error) {
            this.logger.error('Error preparing notification:', error);
            return { success: false, error: error.message };
        }
    }
}
