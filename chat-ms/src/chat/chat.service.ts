import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EncryptionService } from './encryption.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly encryptionService: EncryptionService,
    ) { }

    /**
     * Iniciar o obtener conversación 1:1 entre dos usuarios
     */
    async startConversation(data: StartConversationDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Usar función de Supabase para obtener o crear conversación
            const { data: result, error } = await supabase.rpc(
                'get_or_create_conversation',
                {
                    p_user1: data.userId,
                    p_user2: data.otherUserId,
                },
            );

            if (error) {
                this.logger.error(`Error starting conversation: ${error.message}`);
                throw new BadRequestException('Error al iniciar conversación');
            }

            return { conversationId: result };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al iniciar conversación');
        }
    }

    /**
     * Enviar mensaje en una conversación
     */
    async sendMessage(data: SendMessageDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Verificar que el usuario es parte de la conversación
            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select('id, user1_id, user2_id')
                .eq('id', data.conversationId)
                .single();

            if (convError || !conversation) {
                throw new NotFoundException('Conversación no encontrada');
            }

            const isParticipant =
                conversation.user1_id === data.senderId ||
                conversation.user2_id === data.senderId;

            if (!isParticipant) {
                throw new BadRequestException('No eres parte de esta conversación');
            }

            // Encrypt the message content before storing
            const encryptedContent = this.encryptionService.encrypt(data.content);

            // Insertar mensaje
            const { data: message, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: data.conversationId,
                    sender_id: data.senderId,
                    content: encryptedContent,
                    type: data.type || 'text',
                    metadata: data.metadata || {},
                })
                .select()
                .single();

            if (error) {
                this.logger.error(`Error sending message: ${error.message}`);
                throw new BadRequestException('Error al enviar mensaje');
            }

            // Actualizar timestamp de conversación
            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', data.conversationId);

            // Decrypt content before broadcasting so clients receive plaintext
            const decryptedMessage = {
                ...message,
                content: this.encryptionService.decrypt(message.content),
            };

            // Broadcast via Realtime
            await this.supabaseService.broadcastMessage(data.conversationId, decryptedMessage);

            return { message: decryptedMessage };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            )
                throw error;
            throw new BadRequestException('Error al enviar mensaje');
        }
    }

    /**
     * Obtener mensajes de una conversación
     */
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

            // Decrypt message contents
            const decryptedMessages = messages?.map((msg) => {
                try {
                    return {
                        ...msg,
                        content: this.encryptionService.isEncrypted(msg.content)
                            ? this.encryptionService.decrypt(msg.content)
                            : msg.content, // Handle legacy unencrypted messages
                    };
                } catch (e) {
                    this.logger.warn(`Failed to decrypt message ${msg.id}`);
                    return msg; // Return as-is if decryption fails
                }
            });

            return {
                messages: decryptedMessages?.reverse() || [],
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
                .select('id, first_name, last_name, phone')
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
}
