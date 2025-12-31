import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AccessToken } from 'livekit-server-sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { EncryptionService } from './encryption.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly encryptionService: EncryptionService,
        private readonly notificationsService: NotificationsService,
        @Inject('COMMUNICATION_SERVICE') private readonly communicationClient: ClientProxy,
        @Inject('CONTENT_SERVICE') private readonly contentClient: ClientProxy,
    ) { }

    /**
     * Iniciar nueva conversación
     */
    async startConversation(data: StartConversationDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Check if conversation already exists
            const { data: existing, error: findError } = await supabase
                .from('conversations')
                .select('*')
                .or(`and(user1_id.eq.${data.userId},user2_id.eq.${data.otherUserId}),and(user1_id.eq.${data.otherUserId},user2_id.eq.${data.userId})`)
                .single();

            if (existing) {
                return { conversationId: existing.id };
            }

            // Create new conversation
            const { data: conversation, error } = await supabase
                .from('conversations')
                .insert({
                    user1_id: data.userId,
                    user2_id: data.otherUserId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) {
                this.logger.error(`Error creating conversation: ${error.message}`);
                throw new BadRequestException('Error al crear conversación');
            }

            return { conversationId: conversation.id };
        } catch (error) {
            this.logger.error(`Start conv error: ${error.message}`);
            throw new BadRequestException('Error al iniciar conversación');
        }
    }

    /**
     * Enviar mensaje
     */
    async sendMessage(data: SendMessageDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Encrypt content (text/media placeholders)
            const encryptedContent = this.encryptionService.encrypt(data.content);

            const { data: message, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: data.conversationId,
                    sender_id: data.senderId,
                    content: encryptedContent,
                    type: data.type || 'text',
                    metadata: data.metadata || {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) {
                this.logger.error(`Error sending message: ${error.message}`);
                throw new BadRequestException('Error al enviar mensaje');
            }

            // Update conversation updated_at
            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', data.conversationId);

            // Notify via Broadcast (Realtime is separate, but we trigger Push Notifications here)
            // Get other user ID for push notification
            const { data: conversation } = await supabase
                .from('conversations')
                .select('user1_id, user2_id')
                .eq('id', data.conversationId)
                .single();

            if (conversation) {
                const recipientId = conversation.user1_id === data.senderId ? conversation.user2_id : conversation.user1_id;

                // Fetch recipient's push token AND sender's profile (for name)
                const [recipientResult, senderResult] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('id', recipientId)
                        .single(),
                    supabase
                        .from('profiles')
                        .select('first_name, last_name')
                        .eq('id', data.senderId)
                        .single()
                ]);

                const recipientProfile = recipientResult.data;
                const senderProfile = senderResult.data;

                if (recipientProfile?.push_token) {
                    const senderName = senderProfile
                        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim()
                        : 'Alguien';

                    // Use local service directly instead of emitting event
                    this.notificationsService.sendPushNotification(
                        recipientProfile.push_token,
                        senderName || 'Nuevo Mensaje',
                        data.type === 'text' ? data.content : '📷 Foto',
                        {
                            conversationId: data.conversationId,
                            type: 'new_message',
                            senderId: data.senderId
                        }
                    );
                }

                // 🚀 BROADCAST TO RECIPIENT'S USER CHANNEL FOR INSTANT UPDATE
                // This bypasses Postgres replication lag for the chat list
                const recipientChannel = supabase.channel(`user:${recipientId}`);
                await recipientChannel.send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: {
                        id: message.id,
                        conversationId: data.conversationId,
                        senderId: data.senderId,
                        // Send content for preview (frontend handles if it trusts it)
                        // If we want to be secure, we send decrypted content here because the channel is private?
                        // Actually, Broadcast is public to anyone who subscribes to the channel.
                        // Ideally we send encrypted, but we want speed.
                        // Let's send the CLEAN minimal data for the list.
                        content: data.type === 'text' ? data.content : (data.type === 'image' ? '📷 Foto' : '🎤 Audio'),
                        type: data.type,
                        createdAt: message.created_at,
                        isMine: false
                    }
                });
                // We don't await the tracking/unsubscribe, just fire and forget or clean up?
                // Creating a channel for every send is expensive? 
                // Supabase clients are lightweight, but server-side SDK might be different.
                // Actually, supabase-js on Node works same way.
                supabase.removeChannel(recipientChannel);
            }

            // Return decrypted message
            return {
                message: {
                    ...message,
                    content: data.content, // Return original content (decrypted)
                },
            };
        } catch (error) {
            this.logger.error(`Send message error: ${error.message}`);
            throw new BadRequestException('Error al enviar mensaje');
        }
    }

    async getMessages(data: GetMessagesDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();
            const limit = data.limit || 50;
            const offset = data.offset || 0;

            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', data.conversationId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new BadRequestException('Error al obtener mensajes');
            }

            // Process messages: Decrypt text AND sign media URLs
            const processedMessages = await Promise.all(messages?.map(async (msg) => {
                try {
                    // 1. Decrypt Text
                    let content = msg.content;
                    if (msg.type === 'text' && this.encryptionService.isEncrypted(msg.content)) {
                        content = this.encryptionService.decrypt(msg.content);
                    }

                    // 2. Sign Media URLs (Image/Video/Audio)
                    if (['image', 'video', 'audio'].includes(msg.type) && msg.metadata?.publicId) {
                        try {
                            const response = await this.contentClient.send('generateSignedUrl', {
                                publicId: msg.metadata.publicId,
                                resourceType: msg.type === 'audio' ? 'video' : msg.type // Audio in cloudinary often treated as video resource_type or raw
                            }).toPromise();

                            // Replace stored public_id/raw_url with the temporary signed URL for the frontend
                            if (response?.url) {
                                content = response.url;
                            }
                        } catch (signError) {
                            this.logger.error(`Failed to sign URL for msg ${msg.id}: ${signError.message}`);
                        }
                    }

                    return {
                        ...msg,
                        content: content
                    };
                } catch (e) {
                    this.logger.warn(`Failed to process message ${msg.id}`);
                    return msg;
                }
            }) || []);

            return {
                messages: processedMessages.reverse(),
                hasMore: (messages?.length || 0) === limit,
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al obtener mensajes');
        }
    }

    /**
     * Obtener todas las conversaciones de un usuario
     */
    async getConversations(data: GetConversationsDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            this.logger.log(`🔍 Getting conversations for userId: ${data.userId}`);

            const { data: conversations, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`user1_id.eq.${data.userId},user2_id.eq.${data.userId}`)
                .order('updated_at', { ascending: false });

            this.logger.log(`📋 Found ${conversations?.length || 0} conversations`);

            if (error) {
                throw new BadRequestException('Error al obtener conversaciones');
            }

            if (!conversations || conversations.length === 0) {
                return { conversations: [] };
            }

            // Get other user IDs
            const otherUserIds = conversations.map((conv) =>
                conv.user1_id === data.userId ? conv.user2_id : conv.user1_id
            );

            // Fetch profiles for all other users
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, phone, avatar_url')
                .in('id', otherUserIds);

            // Create a map for quick lookup
            const profileMap = new Map(
                profiles?.map((p) => [p.id, p]) || []
            );

            // Get conversation IDs for batch queries
            const conversationIds = conversations.map((c) => c.id);

            // Fetch last message for each conversation
            const { data: lastMessages } = await supabase
                .from('messages')
                .select('conversation_id, content, created_at, sender_id')
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false });

            // Create a map with only the last message per conversation
            const lastMessageMap = new Map<string, { content: string; created_at: string; sender_id: string }>();
            for (const msg of lastMessages || []) {
                if (!lastMessageMap.has(msg.conversation_id)) {
                    // Decrypt the message content
                    let decryptedContent = msg.content;
                    try {
                        decryptedContent = this.encryptionService.decrypt(msg.content);
                    } catch {
                        // If decryption fails, use original content
                    }
                    lastMessageMap.set(msg.conversation_id, {
                        content: decryptedContent,
                        created_at: msg.created_at,
                        sender_id: msg.sender_id,
                    });
                }
            }

            // Fetch unread counts for each conversation
            const { data: unreadCounts } = await supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', conversationIds)
                .neq('sender_id', data.userId)
                .is('read_at', null);

            // Count unread per conversation
            const unreadMap = new Map<string, number>();
            for (const msg of unreadCounts || []) {
                unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
            }

            // Enrich conversations with all info
            const conversationsWithOther = conversations.map((conv) => {
                const otherUserId = conv.user1_id === data.userId ? conv.user2_id : conv.user1_id;
                const profile = profileMap.get(otherUserId);
                const lastMsg = lastMessageMap.get(conv.id);
                const unreadCount = unreadMap.get(conv.id) || 0;

                return {
                    ...conv,
                    otherUserId,
                    otherUserPhone: profile?.phone || null,
                    otherUserName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
                    otherUserAvatar: profile?.avatar_url || null,
                    lastMessage: lastMsg?.content || null,
                    lastMessageAt: lastMsg?.created_at || null,
                    unreadCount,
                };
            });

            return { conversations: conversationsWithOther };
        } catch (error) {
            this.logger.error(`Error getting conversations: ${error.message}`);
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al obtener conversaciones');
        }
    }

    /**
     * Marcar mensajes como leídos
     */
    async markAsRead(conversationId: string, userId: string) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            const { error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .neq('sender_id', userId)
                .is('read_at', null);

            if (error) {
                throw new BadRequestException('Error al marcar como leído');
            }

            return { success: true };
        } catch (error) {
            throw new BadRequestException('Error al marcar como leído');
        }
    }

    /**
     * Editar mensaje
     */
    async editMessage(data: EditMessageDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Encrypt the new content
            const encryptedContent = this.encryptionService.encrypt(data.content);

            const { data: message, error } = await supabase
                .from('messages')
                .update({
                    content: encryptedContent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', data.messageId)
                .eq('sender_id', data.userId)
                .select()
                .single();

            if (error || !message) {
                throw new NotFoundException('Mensaje no encontrado');
            }

            // Return decrypted content
            return {
                message: {
                    ...message,
                    content: this.encryptionService.decrypt(message.content),
                },
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Error al editar mensaje');
        }
    }

    /**
     * Eliminar mensaje (soft delete)
     */
    async deleteMessage(data: DeleteMessageDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            const { error } = await supabase
                .from('messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', data.messageId)
                .eq('sender_id', data.userId);

            if (error) {
                throw new NotFoundException('Mensaje no encontrado');
            }

            return { success: true };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Error al eliminar mensaje');
        }
    }
    /**
     * Generar Token para LiveKit Video Calls
     */
    async generateVideoToken(roomName: string, username: string) {
        try {
            const apiKey = process.env.LIVEKIT_API_KEY;
            const apiSecret = process.env.LIVEKIT_API_SECRET;

            if (!apiKey || !apiSecret) {
                this.logger.error('LiveKit keys not found in environment variables');
                throw new BadRequestException('Servicio de video no configurado correctamente');
            }

            const at = new AccessToken(apiKey, apiSecret, {
                identity: username,
            });

            at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

            const token = await at.toJwt();
            return { token };
        } catch (error) {
            this.logger.error(`Error generating token: ${error.message}`);
            throw new BadRequestException('Error al generar token de video');
        }
    }
}
