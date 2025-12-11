import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private supabaseClient: SupabaseClient;
    private supabaseAdminClient: SupabaseClient;
    private channels: Map<string, RealtimeChannel> = new Map();

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
        const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

        if (!supabaseUrl) {
            throw new Error('SUPABASE_URL is not defined');
        }

        if (supabaseAnonKey) {
            this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { autoRefreshToken: true, persistSession: false },
                realtime: { params: { eventsPerSecond: 10 } },
            });
            this.logger.log('Supabase public client initialized');
        }

        if (supabaseServiceKey) {
            this.supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
            this.logger.log('Supabase admin client initialized');
        }
    }

    getClient(): SupabaseClient {
        if (!this.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        return this.supabaseClient;
    }

    getAdminClient(): SupabaseClient {
        if (!this.supabaseAdminClient) {
            throw new Error('Supabase admin client not initialized');
        }
        return this.supabaseAdminClient;
    }

    getRealtimeChannel(channelName: string): RealtimeChannel {
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName)!;
        }
        const channel = this.getClient().channel(channelName);
        this.channels.set(channelName, channel);
        return channel;
    }

    async broadcastMessage(conversationId: string, message: any): Promise<void> {
        const channelName = `conversation:${conversationId}`;
        this.logger.log(`Attempting to broadcast to channel: ${channelName}`);

        // Crear un canal nuevo y efímero para este mensaje
        const channel = this.getClient().channel(channelName);

        return new Promise((resolve, reject) => {
            channel
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        this.logger.log(`Subscribed to ${channelName}, sending message...`);
                        try {
                            await channel.send({
                                type: 'broadcast',
                                event: 'message',
                                payload: message
                            });
                            this.logger.log(`Message broadcasted successfully to ${channelName}`);

                            // Limpiar suscripción
                            await this.supabaseClient.removeChannel(channel);
                            resolve();
                        } catch (error) {
                            this.logger.error(`Error sending broadcast: ${error.message}`);
                            // Intentar limpiar incluso si falla
                            await this.supabaseClient.removeChannel(channel);
                            reject(error);
                        }
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        this.logger.error(`Failed to subscribe to ${channelName}: ${status}`);
                        await this.supabaseClient.removeChannel(channel);
                        reject(new Error(`Failed to subscribe: ${status}`));
                    }
                });
        });
    }

    async unsubscribe(channelName: string): Promise<void> {
        const channel = this.channels.get(channelName);
        if (channel) {
            await channel.unsubscribe();
            this.channels.delete(channelName);
        }
    }
}
