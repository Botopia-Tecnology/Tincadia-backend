import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createClient,
    SupabaseClient,
    RealtimeChannel,
} from '@supabase/supabase-js';

/**
 * Servicio compartido de Supabase para todos los microservicios
 * Provee acceso al cliente de Supabase y funcionalidades de Realtime
 */
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

        // Cliente público (anon key) - Para operaciones de usuarios
        if (supabaseAnonKey) {
            this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: false,
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10,
                    },
                },
            });
            this.logger.log('Supabase public client initialized');
        }

        // Cliente admin (service role key) - Para operaciones privilegiadas
        if (supabaseServiceKey) {
            this.supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            });
            this.logger.log('Supabase admin client initialized');
        }
    }

    /**
     * Obtiene el cliente público de Supabase (anon key)
     * Usar para operaciones de usuarios autenticados
     */
    getClient(): SupabaseClient {
        if (!this.supabaseClient) {
            throw new Error('Supabase public client not initialized. Check SUPABASE_ANON_KEY');
        }
        return this.supabaseClient;
    }

    /**
     * Obtiene el cliente admin de Supabase (service role key)
     * Usar para operaciones privilegiadas (CRUD de usuarios, etc.)
     */
    getAdminClient(): SupabaseClient {
        if (!this.supabaseAdminClient) {
            throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_KEY');
        }
        return this.supabaseAdminClient;
    }

    /**
     * Crea o recupera un canal de Realtime
     * @param channelName Nombre único del canal
     */
    getRealtimeChannel(channelName: string): RealtimeChannel {
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName)!;
        }

        const client = this.getClient();
        const channel = client.channel(channelName);
        this.channels.set(channelName, channel);

        this.logger.log(`Realtime channel created: ${channelName}`);
        return channel;
    }

    /**
     * Suscribe a cambios en una tabla específica
     * @param table Nombre de la tabla
     * @param callback Función a ejecutar cuando hay cambios
     */
    subscribeToTable(
        table: string,
        callback: (payload: any) => void,
        filter?: string,
    ): RealtimeChannel {
        const client = this.getClient();
        const channelName = `table:${table}`;

        const channel = client
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                    filter: filter,
                },
                callback,
            )
            .subscribe();

        this.channels.set(channelName, channel);
        this.logger.log(`Subscribed to table changes: ${table}`);

        return channel;
    }

    /**
     * Suscribe a un canal de broadcast para mensajes en tiempo real
     * @param roomId ID de la sala
     * @param callback Función a ejecutar cuando llega un mensaje
     */
    subscribeToBroadcast(
        roomId: string,
        callback: (payload: any) => void,
    ): RealtimeChannel {
        const channelName = `room:${roomId}`;
        const channel = this.getRealtimeChannel(channelName);

        channel
            .on('broadcast', { event: 'message' }, callback)
            .subscribe();

        this.logger.log(`Subscribed to broadcast: ${channelName}`);
        return channel;
    }

    /**
     * Envía un mensaje por broadcast a una sala
     * @param roomId ID de la sala
     * @param message Mensaje a enviar
     */
    async broadcastMessage(roomId: string, message: any): Promise<void> {
        const channelName = `room:${roomId}`;
        const channel = this.getRealtimeChannel(channelName);

        await channel.send({
            type: 'broadcast',
            event: 'message',
            payload: message,
        });
    }

    /**
     * Rastrear presencia de usuarios en una sala
     * @param roomId ID de la sala
     * @param userId ID del usuario
     * @param userData Datos adicionales del usuario
     */
    async trackPresence(
        roomId: string,
        userId: string,
        userData: Record<string, any> = {},
    ): Promise<RealtimeChannel> {
        const channelName = `presence:${roomId}`;
        const channel = this.getRealtimeChannel(channelName);

        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    user_id: userId,
                    online_at: new Date().toISOString(),
                    ...userData,
                });
            }
        });

        return channel;
    }

    /**
     * Desuscribirse de un canal
     * @param channelName Nombre del canal
     */
    async unsubscribe(channelName: string): Promise<void> {
        const channel = this.channels.get(channelName);
        if (channel) {
            await channel.unsubscribe();
            this.channels.delete(channelName);
            this.logger.log(`Unsubscribed from channel: ${channelName}`);
        }
    }

    /**
     * Desuscribirse de todos los canales
     */
    async unsubscribeAll(): Promise<void> {
        for (const [name, channel] of this.channels) {
            await channel.unsubscribe();
            this.logger.log(`Unsubscribed from channel: ${name}`);
        }
        this.channels.clear();
    }
}
