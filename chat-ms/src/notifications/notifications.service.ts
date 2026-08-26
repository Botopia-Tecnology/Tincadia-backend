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

    private isApnProduction(): boolean {
        const explicit = process.env.APN_PRODUCTION;
        if (explicit !== undefined) {
            return ['1', 'true', 'yes', 'production'].includes(explicit.trim().toLowerCase());
        }

        return process.env.NODE_ENV === 'production';
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
                    production: this.isApnProduction()
                });
                this.logger.log(`APNs provider initialized for VoIP push (${this.isApnProduction() ? 'production' : 'sandbox'})`);
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
     * The same call session must produce the same CallKit UUID across pushes
     * (call + call_ended/call_missed/call_rejected) so the terminal push can
     * end the original native call instead of orphaning it.
     */
    private stableCallUUID(seed?: string): string {
        if (!seed) return crypto.randomUUID();
        const hash = crypto.createHash('sha1').update(`tincadia-call:${seed}`).digest();
        hash[6] = (hash[6] & 0x0f) | 0x50;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.subarray(0, 16).toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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
        notification.priority = 10;
        // Give APNs a short retry window; expiry=0 means single delivery attempt
        // and the push is dropped if the device is momentarily offline.
        notification.expiry = Math.floor(Date.now() / 1000) + 30;

        // apn@2.2.0 does not expose apns-push-type, but iOS 13+ requires it for PushKit.
        const originalHeaders = (notification as any).headers.bind(notification);
        (notification as any).headers = () => ({
            ...originalHeaders(),
            'apns-push-type': 'voip'
        });

        notification.payload = {
            callUUID: this.stableCallUUID(payload.callSessionId || payload.call_session_id), // Stable UUID per call session for CallKit
            // Lets the client discard a push that APNs held/retried past the ring
            // window. FCM exposes sentTime natively; PushKit has no equivalent, so
            // the timestamp has to travel inside the payload.
            sentAt: Date.now(),
            ...payload
        };

        try {
            const result = await this.apnProvider.send(notification, voipToken);
            if (result.failed.length > 0) {
                const reasons = result.failed.map((f: any) => ({
                    device: f.device,
                    status: f.status,
                    reason: f.response?.reason,
                    error: f.error?.message,
                }));
                this.logger.error(`🍏 VoIP Push failed: ${JSON.stringify(reasons)}`);
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
                callSessionId: String(payload.callSessionId || payload.call_session_id || ''),
                callUUID: String(
                    payload.callUUID ||
                    this.stableCallUUID(payload.callSessionId || payload.call_session_id || payload.conversationId)
                ),
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
