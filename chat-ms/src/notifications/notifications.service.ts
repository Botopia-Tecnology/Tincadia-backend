import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import * as apn from 'apn';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private expo: Expo;
    private apnProvider: apn.Provider | null = null;
    private fcmInitialized = false;

    constructor() {
        this.expo = new Expo();
        this.initializeApn();
        this.initializeFcm();
    }

    private initializeApn() {
        try {
            // Usually configured via env variables
            if (process.env.APN_KEY_PATH || process.env.APN_KEY) {
                const rawKey = process.env.APN_KEY ? process.env.APN_KEY.replace(/\\n/g, '\n') : '';
                this.apnProvider = new apn.Provider({
                    token: {
                        key: rawKey || process.env.APN_KEY_PATH || '',
                        keyId: process.env.APN_KEY_ID || '',
                        teamId: process.env.APN_TEAM_ID || ''
                    },
                    production: process.env.NODE_ENV === 'production'
                });
                this.logger.log('🍏 APNs provider initialized for VoIP push');
            } else {
                this.logger.warn('🍏 APNs credentials not found. VoIP push will be simulated.');
            }
        } catch (error) {
            this.logger.error(`Error initializing APNs: ${error.message}`);
        }
    }

    private initializeFcm() {
        try {
            if (!getApps().length) {
                if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
                    initializeApp({
                        credential: cert({
                            projectId: process.env.FIREBASE_PROJECT_ID,
                            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                        })
                    });
                    this.fcmInitialized = true;
                    this.logger.log('🤖 Firebase Admin initialized for FCM Data Push (using env variables)');
                } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                    let creds: any = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                    if (creds.startsWith('{')) {
                        creds = JSON.parse(creds);
                    }
                    initializeApp({ credential: cert(creds) });
                    this.fcmInitialized = true;
                    this.logger.log('🤖 Firebase Admin initialized for FCM Data Push (using GOOGLE_APPLICATION_CREDENTIALS)');
                } else {
                    this.logger.warn('🤖 Firebase credentials not found. FCM Data Push will be simulated.');
                }
            } else {
                this.fcmInitialized = true;
            }
        } catch (error) {
            this.logger.error(`Error initializing Firebase Admin: ${error.message}`);
        }
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
    ): Promise<{ success: boolean; tokenInvalid?: boolean }> {
        if (!Expo.isExpoPushToken(pushToken)) {
            this.logger.error(`Push token ${pushToken} is not a valid Expo push token`);
            return { success: false, tokenInvalid: true };
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
                    for (const ticket of ticketChunk) {
                        if (ticket.status === 'error') {
                            const errorMsg = ticket.details?.error || 'unknown';
                            this.logger.error(`Expo push error for ${pushToken.substring(0, 15)}...: ${errorMsg}`);
                            if (errorMsg === 'DeviceNotRegistered') {
                                return { success: false, tokenInvalid: true };
                            }
                        }
                    }
                    this.logger.log('Notification sent successfully');
                    return { success: true };
                } catch (error) {
                    this.logger.error('Error sending notification chunk:', error);
                    return { success: false };
                }
            }
            return { success: false };
        } catch (error) {
            this.logger.error('Error chunking notifications:', error);
            return { success: false };
        }
    }

    /**
     * Send native VoIP Push via APNs (Apple Push Notification service)
     */
    async sendVoipPushNotification(voipToken: string, payload: any) {
        this.logger.log(`🍏 Sending VoIP Push to token: ${voipToken.substring(0, 10)}...`);
        
        if (!this.apnProvider) {
            this.logger.warn('🍏 Simulated VoIP Push (No APN credentials configured)', payload);
            return;
        }

        const notification = new apn.Notification();
        // VoIP pushes do not require alert/sound. They wake the app up in the background.
        notification.topic = `${process.env.BUNDLE_ID || 'com.tincadia.app'}.voip`;
        notification.payload = {
            callUUID: crypto.randomUUID(), // Unique UUID for CallKit
            ...payload
        };

        try {
            const result = await this.apnProvider.send(notification, voipToken);
            if (result.failed.length > 0) {
                this.logger.error(`🍏 VoIP Push failed:`, result.failed);
            } else {
                this.logger.log(`🍏 VoIP Push sent successfully.`);
            }
        } catch (error) {
            this.logger.error(`🍏 Error sending VoIP Push: ${error.message}`);
        }
    }

    /**
     * Send Data-Only Message via Firebase Cloud Messaging for Android
     */
    async sendFcmDataNotification(fcmToken: string, payload: any) {
        this.logger.log(`🤖 Sending FCM Data Message to token: ${fcmToken.substring(0, 10)}...`);
        
        if (!this.fcmInitialized) {
            this.logger.warn('🤖 Simulated FCM Data Push (No Firebase credentials configured)', payload);
            return;
        }

        const message: Message = {
            token: fcmToken,
            data: {
                // FCM data payload requires all values to be strings
                conversationId: String(payload.conversationId || ''),
                type: String(payload.type || ''),
                senderId: String(payload.senderId || ''),
                senderName: String(payload.senderName || ''),
                roomName: String(payload.roomName || ''),
                isGroup: String(payload.isGroup || 'false')
            },
            android: {
                priority: 'high', // Required for background wakeup
                ttl: 0 // Required for VoIP to bypass aggressive Doze on older devices
            }
        };

        try {
            const response = await getMessaging().send(message);
            this.logger.log(`🤖 FCM Data Message sent successfully: ${response}`);
        } catch (error) {
            this.logger.error(`🤖 Error sending FCM Data Message: ${error.message}`);
        }
    }

}
