import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../../libs/supabase/src';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

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

            // Insertar mensaje
            const { data: message, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: data.conversationId,
                    sender_id: data.senderId,
                    content: data.content,
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

            // Broadcast via Realtime
            await this.supabaseService.broadcastMessage(data.conversationId, message);

            return { message };
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

            return {
                messages: messages?.reverse() || [],
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

            const { data: conversations, error } = await supabase
                .from('conversations')
                .select('*')
                .or(`user1_id.eq.${data.userId},user2_id.eq.${data.userId}`)
                .order('updated_at', { ascending: false });

            if (error) {
                throw new BadRequestException('Error al obtener conversaciones');
            }

            // Agregar info del otro usuario
            const conversationsWithOther = conversations?.map((conv) => ({
                ...conv,
                otherUserId:
                    conv.user1_id === data.userId ? conv.user2_id : conv.user1_id,
            }));

            return { conversations: conversationsWithOther || [] };
        } catch (error) {
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

            const { data: message, error } = await supabase
                .from('messages')
                .update({
                    content: data.content,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', data.messageId)
                .eq('sender_id', data.userId)
                .select()
                .single();

            if (error || !message) {
                throw new NotFoundException('Mensaje no encontrado');
            }

            return { message };
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
