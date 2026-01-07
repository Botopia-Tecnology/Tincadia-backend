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
import { CreateGroupDto } from './dto/create-group.dto';
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
     * Crear nuevo grupo
     */
    async createGroup(data: CreateGroupDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // 1. Create conversation of type 'group'
            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .insert({
                    type: 'group',
                    title: data.title,
                    description: data.description || '',
                    image_url: data.imageUrl || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (convError || !conversation) {
                this.logger.error(`Error creating group conversation: ${convError?.message}`);
                throw new BadRequestException('Error al crear grupo');
            }

            // 2. Add participants (Admin + Members)
            const participantsToAdd = [
                // Creator as Admin
                {
                    conversation_id: conversation.id,
                    user_id: data.creatorId,
                    role: 'admin',
                    added_by: data.creatorId,
                    joined_at: new Date().toISOString(),
                },
                // Other participants as Members
                ...data.participants
                    .filter(id => id !== data.creatorId) // Ensure creator isn't added twice
                    .map(userId => ({
                        conversation_id: conversation.id,
                        user_id: userId,
                        role: 'member',
                        added_by: data.creatorId,
                        joined_at: new Date().toISOString(),
                    }))
            ];

            const { error: partError } = await supabase
                .from('conversation_participants')
                .insert(participantsToAdd);

            if (partError) {
                this.logger.error(`Error adding participants: ${partError.message}`);
                // Rollback conversation creation? Or just fail? (Supabase doesn't support transactions easily here unless using rpc)
                // For now, let's try to delete the conversation if participants fail.
                await supabase.from('conversations').delete().eq('id', conversation.id);
                throw new BadRequestException('Error al añadir participantes al grupo');
            }

            return { conversationId: conversation.id };
        } catch (error) {
            this.logger.error(`Create group error: ${error.message}`);
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al crear grupo');
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

            // Notify via Broadcast and Push
            const { data: conversation } = await supabase
                .from('conversations')
                .select('*') // Get full conversation to check type
                .eq('id', data.conversationId)
                .single();

            if (conversation) {
                // Determine recipients
                let recipientIds: string[] = [];
                let groupTitle = null;

                if (conversation.type === 'group') {
                    groupTitle = conversation.title;
                    const { data: participants } = await supabase
                        .from('conversation_participants')
                        .select('user_id')
                        .eq('conversation_id', conversation.id);

                    if (participants) {
                        recipientIds = participants
                            .map(p => p.user_id)
                            .filter(id => id !== data.senderId);
                    }
                } else {
                    // Direct chat
                    recipientIds = [conversation.user1_id === data.senderId ? conversation.user2_id : conversation.user1_id];
                }

                // Fetch sender profile once
                const { data: senderProfile } = await supabase
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', data.senderId)
                    .single();

                const senderName = senderProfile
                    ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim()
                    : 'Alguien';

                // Fetch push tokens for all recipients
                const { data: recipientsProfiles } = await supabase
                    .from('profiles')
                    .select('id, push_token')
                    .in('id', recipientIds);

                // Send Notifications and Broadcasts
                for (const recipient of recipientsProfiles || []) {
                    if (recipient.push_token) {
                        const isCall = data.type === 'call';
                        const isCallEnded = data.type === 'call_ended';

                        // Customize title: Group Name or Sender Name
                        const notifTitle = groupTitle ? `${groupTitle} (${senderName})` : senderName;

                        this.notificationsService.sendPushNotification(
                            recipient.push_token,
                            isCall ? '📞 Llamada Entrante' : (notifTitle || 'Nuevo Mensaje'),
                            isCall
                                ? 'Toca para contestar...'
                                : ((data.type === 'text' || isCallEnded) ? data.content : (data.type === 'image' ? '📷 Foto' : (data.type === 'audio' ? '🎤 Audio' : '📎 Archivo'))),
                            {
                                conversationId: data.conversationId,
                                type: (isCall || isCallEnded || String(data.type) === 'call_rejected') ? data.type : 'new_message',
                                senderId: data.senderId,
                                senderName: senderName,
                                roomName: isCall ? data.metadata?.roomName : undefined,
                                isGroup: conversation.type === 'group' ? 'true' : 'false'
                            },
                            // Options
                            isCall ? {
                                channelId: 'incoming_calls',
                                priority: 'high',
                                sound: 'default'
                            } : undefined
                        );
                    }

                    // 🚀 BROADCAST TO RECIPIENT'S USER CHANNEL
                    const recipientChannel = supabase.channel(`user:${recipient.id}`);
                    await recipientChannel.send({
                        type: 'broadcast',
                        event: 'new_message',
                        payload: {
                            id: message.id,
                            conversationId: data.conversationId,
                            senderId: data.senderId,
                            content: data.type === 'text' ? data.content : (data.type === 'image' ? '📷 Foto' : '🎤 Audio'),
                            type: data.type,
                            createdAt: message.created_at,
                            isMine: false,
                            // Add group info for frontend update if needed
                            isGroup: conversation.type === 'group',
                            groupTitle: groupTitle
                        }
                    });
                    supabase.removeChannel(recipientChannel);
                }
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

            // 1. Get Direct Chats (where user is user1 or user2)
            const { data: directConversations, error: directError } = await supabase
                .from('conversations')
                .select('*')
                .or(`user1_id.eq.${data.userId},user2_id.eq.${data.userId}`)
                .eq('type', 'direct') // Optimization if type col exists now
                .order('updated_at', { ascending: false });

            // 2. Get Group Chats (from conversation_participants)
            const { data: participations, error: partError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', data.userId);

            let groupConversations: any[] = [];
            if (participations && participations.length > 0) {
                const groupIds = participations.map(p => p.conversation_id);
                const { data: groups, error: groupsError } = await supabase
                    .from('conversations')
                    .select('*')
                    .in('id', groupIds)
                    .order('updated_at', { ascending: false });

                if (groups) groupConversations = groups;
            }

            // 3. Merge and Deduplicate (though types shouldn't overlap usually if migrated correctly, but for safety)
            const allConversationsMap = new Map();
            [...(directConversations || []), ...(groupConversations || [])].forEach(conv => {
                allConversationsMap.set(conv.id, conv);
            });
            const allConversations = Array.from(allConversationsMap.values())
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

            this.logger.log(`📋 Found ${allConversations.length} total conversations`);

            if (allConversations.length === 0) {
                return { conversations: [] };
            }

            // 4. Enrich Data
            // Get other user IDs for Direct Chats only
            const directChatUserIds = allConversations
                .filter(c => c.type === 'direct' || (!c.type && (c.user1_id || c.user2_id))) // Handle legacy or direct
                .map(conv => conv.user1_id === data.userId ? conv.user2_id : conv.user1_id)
                .filter(Boolean); // Filter nulls just in case

            // Fetch profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, phone, avatar_url')
                .in('id', directChatUserIds);

            const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

            // Fetch Last Messages and Unread Counts
            const conversationIds = allConversations.map(c => c.id);

            // Last Messages (simplified query, might need optimization for huge datasets)
            // Ideally we use a view or lateral join, but here:
            const { data: lastMessages } = await supabase
                .from('messages')
                .select('conversation_id, content, created_at, sender_id, type')
                .in('conversation_id', conversationIds)
                .order('created_at', { ascending: false });

            // Map last messages (only keep first found per conv as it's sorted desc)
            const lastMessageMap = new Map();
            for (const msg of lastMessages || []) {
                if (!lastMessageMap.has(msg.conversation_id)) {
                    let content = msg.content;
                    if (msg.type === 'text' && this.encryptionService.isEncrypted(content)) {
                        try { content = this.encryptionService.decrypt(content); } catch { }
                    }
                    lastMessageMap.set(msg.conversation_id, { ...msg, content });
                }
            }

            const { data: unreadCounts } = await supabase
                .from('messages')
                .select('conversation_id')
                .in('conversation_id', conversationIds)
                .neq('sender_id', data.userId)
                .is('read_at', null);

            const unreadMap = new Map<string, number>();
            for (const msg of unreadCounts || []) {
                unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
            }

            // 5. Build Final Result
            const conversationsWithOther = allConversations.map(conv => {
                const isGroup = conv.type === 'group';
                let otherUser = null;

                if (!isGroup) {
                    const otherId = conv.user1_id === data.userId ? conv.user2_id : conv.user1_id;
                    otherUser = profileMap.get(otherId);
                }

                const lastMsg = lastMessageMap.get(conv.id);

                return {
                    ...conv,
                    // For Group: Use group title/image. For Direct: Use other user name/avatar.
                    title: isGroup ? conv.title : (otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() : 'Chat'),
                    imageUrl: isGroup ? conv.image_url : (otherUser?.avatar_url || null),

                    // Legacy fields for frontend compatibility (if it expects otherUser...)
                    otherUserId: !isGroup ? (conv.user1_id === data.userId ? conv.user2_id : conv.user1_id) : null,
                    otherUserName: !isGroup ? (otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() : null) : conv.title,
                    otherUserAvatar: !isGroup ? (otherUser?.avatar_url || null) : conv.image_url,

                    // Common fields
                    lastMessage: lastMsg?.content || null,
                    lastMessageAt: lastMsg?.created_at || null,
                    unreadCount: unreadMap.get(conv.id) || 0,
                    isGroup: isGroup
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

    /**
     * Invitar intérpretes a una llamada
     */
    async inviteInterpreters(data: { roomName: string; userId: string; username: string }) {
        try {
            const supabase = this.supabaseService.getAdminClient();
            this.logger.log(`📞 Inviting interpreters for call ${data.roomName} by ${data.username}`);

            // 1. Find all users with role 'interpreter'
            const { data: interpreters, error } = await supabase
                .from('profiles')
                .select('id, push_token')
                .eq('role', 'interpreter');

            if (error) {
                this.logger.error(`Error fetching interpreters: ${error.message}`);
                return { success: false, message: 'Error buscando intérpretes' };
            }

            if (!interpreters || interpreters.length === 0) {
                return { success: false, message: 'No hay intérpretes disponibles' };
            }

            this.logger.log(`Found ${interpreters.length} interpreters`);

            // 2. Notify them
            const notifications = interpreters.map(async (interpreter) => {
                if (interpreter.push_token) {
                    await this.notificationsService.sendPushNotification(
                        interpreter.push_token,
                        '📞 Solicitud de Intérprete',
                        `${data.username} requiere un intérprete en una llamada.`,
                        {
                            type: 'call_invite',
                            roomName: data.roomName,
                            senderId: data.userId,
                            senderName: data.username,
                        },
                        {
                            channelId: 'incoming_calls',
                            priority: 'high',
                            sound: 'default'
                        }
                    );
                }

                const channel = supabase.channel(`user:${interpreter.id}`);
                await channel.send({
                    type: 'broadcast',
                    event: 'call_invite',
                    payload: {
                        roomName: data.roomName,
                        senderId: data.userId,
                        senderName: data.username,
                    }
                });
                supabase.removeChannel(channel);
            });

            await Promise.all(notifications);

            return { success: true, count: interpreters.length };

        } catch (error) {
            this.logger.error(`Error inviting interpreters: ${error.message}`);
            throw new BadRequestException('Error al invitar intérpretes');
        }
    }
}
