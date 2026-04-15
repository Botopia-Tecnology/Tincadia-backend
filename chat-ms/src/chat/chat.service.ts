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
import {
    RemoveParticipantDto,
    PromoteToAdminDto,
    LeaveGroupDto,
    UpdateGroupDto,
    AddParticipantDto
} from './dto/group-management.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { Expo } from 'expo-server-sdk';

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
                // Rollback conversation creation? Or just fail?
                await supabase.from('conversations').delete().eq('id', conversation.id);
                throw new BadRequestException('Error al añadir participantes al grupo');
            }

            // 3. Send Initial System Message to ensure visibility
            // (Empty groups are filtered out by getConversations, so we need a message)
            await this.sendMessage({
                conversationId: conversation.id,
                senderId: data.creatorId,
                content: '👥 Grupo creado',
                type: 'text' as any, // Cast to avoid TS error with MessageType enum
                metadata: { isSystem: true }
            });

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
                    // Store replyTo in dedicated columns for proper querying
                    reply_to_id: data.metadata?.replyToId || null,
                    reply_to_content: data.metadata?.replyToContent || null,
                    reply_to_sender: data.metadata?.replyToSender || null,
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
                let allParticipantIds: string[] = []; // Track ALL participants for interpreter check
                let groupTitle = null;

                if (conversation.type === 'group') {
                    groupTitle = conversation.title;
                    const { data: participants } = await supabase
                        .from('conversation_participants')
                        .select('user_id')
                        .eq('conversation_id', conversation.id);

                    if (participants) {
                        allParticipantIds = participants.map(p => p.user_id);
                        recipientIds = allParticipantIds.filter(id => id !== data.senderId);
                    }
                } else {
                    // Direct chat
                    allParticipantIds = [conversation.user1_id, conversation.user2_id];
                    recipientIds = [conversation.user1_id === data.senderId ? conversation.user2_id : conversation.user1_id];
                }

                // --- AUTO-FREE INTERPRETERS ON CALL END ---
                if (data.type === 'call_ended') {
                    // We don't need to await this critically, but we want to log errors.
                    // Using a separate async operation or just awaiting it here safely.
                    const { error: updateError, count } = await supabase
                        .from('profiles')
                        .update({ is_busy: false })
                        .in('id', allParticipantIds)
                        .eq('role', 'interpreter')
                        .eq('is_busy', true); // Only update if currently busy

                    if (updateError) {
                        this.logger.error(`Error freeing interpreters: ${updateError.message}`);
                    } else {
                        // Optional: Log success if count > 0
                        // (count is null unless count option is used, but update usually returns it or data)
                        this.logger.log(`Call ended: Released interpreters checks completed.`);
                    }
                }
                // ------------------------------------------

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

                // Send Notifications and Broadcasts (sin push para mensajes de sistema del grupo)
                const skipPushForSystem = data.metadata?.isSystem === true;
                for (const recipient of recipientsProfiles || []) {
                    if (recipient.push_token && !skipPushForSystem) {
                        const isCall = data.type === 'call';
                        const isCallEnded = data.type === 'call_ended';

                        // Customize title: Group Name or Sender Name
                        const notifTitle = groupTitle ? `${groupTitle} (${senderName})` : senderName;

                        await this.notificationsService.sendPushNotification(
                            recipient.push_token,
                            isCall ? `📞 Llamada de ${senderName}` : (notifTitle || 'Nuevo Mensaje'),
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
                            // Options — both call and call_ended use high-priority channel
                            (isCall || isCallEnded || String(data.type) === 'call_rejected') ? {
                                channelId: 'incoming_calls',
                                priority: 'high',
                                sound: isCall ? 'default' : undefined
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
                            isGroup: conversation.type === 'group',
                            groupTitle: groupTitle
                        }
                    });

                    // For call_ended/call_rejected, send an additional broadcast so the
                    // global notification listener can dismiss the incoming-call modal
                    // even if the user is NOT inside the chat screen.
                    if (data.type === 'call_ended' || String(data.type) === 'call_rejected') {
                        await recipientChannel.send({
                            type: 'broadcast',
                            event: 'call_ended',
                            payload: {
                                conversationId: data.conversationId,
                                senderId: data.senderId,
                            }
                        });
                    }

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

            let query = supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', data.conversationId)
                // .is('deleted_at', null) // Include deleted messages to show placeholder
                .order('created_at', { ascending: false });

            // Delta sync
            if (data.after) {
                query = query.gt('created_at', data.after);
            }

            const { data: messages, error } = await query
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
                        try {
                            content = this.encryptionService.decrypt(msg.content);
                        } catch (decryptError) {
                            this.logger.warn(`Failed to decrypt message ${msg.id}: ${decryptError.message}`);
                            // Keep content as is (encrypted) or set to placeholder?
                            // Returning raw encrypted text confuses users, but hiding it is also bad.
                            // Let's log it and maybe prefix? No, frontend handles strings.
                        }
                    }

                    // 2. Sign Media URLs (Image/Video/Audio)
                    if (['image', 'video', 'audio'].includes(msg.type) && msg.metadata?.publicId) {
                        try {
                            const response = await this.contentClient.send('generateSignedUrl', {
                                publicId: msg.metadata.publicId,
                                resourceType: msg.type === 'audio' ? 'video' : msg.type
                            }).toPromise();

                            if (response?.url) {
                                content = response.url;
                            }
                        } catch (signError) {
                            this.logger.error(`Failed to sign URL for msg ${msg.id}: ${signError.message}`);
                        }
                    }

                    return {
                        ...msg,
                        content: content,
                        // Read replyTo from dedicated columns (preferred) or fallback to metadata
                        replyToId: msg.reply_to_id || msg.metadata?.replyToId || null,
                        replyToContent: msg.reply_to_content || msg.metadata?.replyToContent || null,
                        replyToSender: msg.reply_to_sender || msg.metadata?.replyToSender || null,
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

            // 4b. Fetch CONTACTS to resolve aliases (overrides/augments profile names)
            const { data: contacts } = await supabase
                .from('contacts')
                .select('contact_user_id, alias, custom_first_name, custom_last_name')
                .eq('owner_id', data.userId);

            const contactMap = new Map(contacts?.map(c => [c.contact_user_id, c]) || []);

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

                    // 1. Decrypt if encrypted (REGARDLESS of type, because sendMessage encrypts everything)
                    if (this.encryptionService.isEncrypted(content)) {
                        try {
                            content = this.encryptionService.decrypt(content);
                        } catch (e) {
                            this.logger.warn(`Last message decryption failed for conv ${msg.conversation_id}: ${e.message}`);
                        }
                    }

                    // 2. Format System Messages (Calls)
                    if (['call', 'call_ended', 'call_rejected', 'call_missed'].includes(msg.type)) {
                        if (content === 'call_ended') content = '📞 Llamada finalizada';
                        else if (content === 'call_rejected') content = '📞 Llamada rechazada';
                        else if (content === 'call_missed') content = '📞 Llamada perdida';
                        else if (msg.type === 'call') content = '📞 Llamada entrante';
                        // If checks fail, it might be custom content, allow it or fallback
                    } else if (msg.type === 'image') {
                        content = '📷 Foto';
                    } else if (msg.type === 'audio') {
                        content = '🎤 Audio';
                    } else if (msg.type === 'video') {
                        content = '🎥 Video';
                    }

                    lastMessageMap.set(msg.conversation_id, { ...msg, content });
                }
            }

            // Filter out conversations that have no messages
            // This prevents User B from seeing a conversation until User A sends a message
            const conversationsWithMessages = allConversations.filter(conv =>
                lastMessageMap.has(conv.id)
            );

            this.logger.log(`📋 Filtered to ${conversationsWithMessages.length} conversations with messages`);

            // 4c. Fetch Unread Counts correctly handling message_reads for groups
            // We need messages that are NOT from the current user AND (read_at is null for direct OR no entry in message_reads for current user)

            // First, get IDs of messages the current user HAS read in these conversations
            const { data: userReads } = await supabase
                .from('message_reads')
                .select('message_id')
                .eq('user_id', data.userId);

            const readMessageIds = new Set(userReads?.map(r => r.message_id) || []);

            const { data: unreadCounts } = await supabase
                .from('messages')
                .select('id, conversation_id')
                .in('conversation_id', conversationIds)
                .neq('sender_id', data.userId)
                .is('read_at', null);

            const unreadMap = new Map<string, number>();
            for (const msg of unreadCounts || []) {
                // Only count as unread if the user hasn't explicitly read it via message_reads
                if (!readMessageIds.has(msg.id)) {
                    unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
                }
            }

            // 5. Build Final Result
            const conversationsWithOther = conversationsWithMessages.map(conv => {
                const isGroup = conv.type === 'group';
                let otherUser = null;

                if (!isGroup) {
                    const otherId = conv.user1_id === data.userId ? conv.user2_id : conv.user1_id;
                    otherUser = profileMap.get(otherId);

                    // Try to get contact info
                    const contact = contactMap.get(otherId);
                    if (contact) {
                        // Create a synthetic "otherUser" or augment it
                        // Preference: Alias > Custom Name > Profile Name
                        const contactName = contact.alias ||
                            ((contact.custom_first_name || contact.custom_last_name) ? `${contact.custom_first_name || ''} ${contact.custom_last_name || ''}`.trim() : null);

                        if (contactName) {
                            // Override profile name logic below by patching otherUser or just handling it in assignment
                            if (!otherUser) {
                                // If they don't have a profile but they are in contacts
                                otherUser = { first_name: contactName, last_name: '', avatar_url: null, id: otherId } as any;
                            } else {
                                // They have a profile, but we prefer contact name
                                otherUser = { ...otherUser, first_name: contactName, last_name: '' };
                            }
                        }
                    }
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
                    otherUserPhone: !isGroup ? (otherUser?.phone || null) : null,

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

            // 1. Obtener la conversación para saber si es grupo o directa
            const { data: conv } = await supabase
                .from('conversations')
                .select('type')
                .eq('id', conversationId)
                .single();

            if (conv?.type === 'group') {
                // 2. Cuántos participantes hay en total
                const { count: totalParticipants } = await supabase
                    .from('conversation_participants')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', conversationId);

                // 3. Obtener mensajes sin read_at que no son del propio usuario
                const { data: unreadMessages } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('conversation_id', conversationId)
                    .neq('sender_id', userId)
                    .is('read_at', null);

                if (!unreadMessages || unreadMessages.length === 0) {
                    return { success: true };
                }

                // 4. Insertar lecturas del usuario actual (upsert para evitar duplicados)
                const readsToInsert = unreadMessages.map(msg => ({
                    message_id: msg.id,
                    user_id: userId,
                }));

                await supabase
                    .from('message_reads')
                    .upsert(readsToInsert, { onConflict: 'message_id, user_id' });

                // 5. Para cada mensaje sin read_at, verificar si todos los demás participantes ya leyeron
                // El sender no necesita registro en message_reads (se asume que ya lo vio al enviarlo)
                const readThreshold = (totalParticipants || 1) - 1;

                // Optimización: Contar lecturas para todos los mensajes pendientes de una vez
                const messageIds = unreadMessages.map(m => m.id);
                const { data: readCounts, error: countError } = await supabase
                    .from('message_reads')
                    .select('message_id')
                    .in('message_id', messageIds);

                if (!countError && readCounts) {
                    // Agrupar conteos por message_id
                    const countMap = new Map<string, number>();
                    readCounts.forEach(r => {
                        countMap.set(r.message_id, (countMap.get(r.message_id) || 0) + 1);
                    });

                    // Identificar cuáles mensajes llegaron al umbral
                    const messagesToMarkAsRead = messageIds.filter(id => (countMap.get(id) || 0) >= readThreshold);

                    if (messagesToMarkAsRead.length > 0) {
                        await supabase
                            .from('messages')
                            .update({ read_at: new Date().toISOString() })
                            .in('id', messagesToMarkAsRead)
                            .is('read_at', null);
                    }
                }
            } else {
                // Lógica para chats directos (1:1)
                const { error } = await supabase
                    .from('messages')
                    .update({ read_at: new Date().toISOString() })
                    .eq('conversation_id', conversationId)
                    .neq('sender_id', userId)
                    .is('read_at', null);

                if (error) {
                    throw new BadRequestException('Error al marcar como leído');
                }
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
     * Eliminar mensaje (soft delete para todos)
     */
    async deleteMessage(data: DeleteMessageDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            this.logger.log(`🗑️ Attempting delete: msgId=${data.messageId}, userId=${data.userId}`);

            // 1. Update message content and type
            // We set deleted_at for auditing, but the main logic is changing type to 'deleted'
            const { data: updatedMessage, error } = await supabase
                .from('messages')
                .update({
                    content: 'Mensaje eliminado',
                    type: 'text', // Changed from 'deleted' to satisfy DB constraint
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.messageId)
                .eq('sender_id', data.userId)
                .select()
                .single();

            if (error || !updatedMessage) {
                this.logger.error(`❌ Delete failed. Error: ${error?.message}, Found msg: ${!!updatedMessage}`);
                // Check if message exists at all to give better error
                const { data: check } = await supabase.from('messages').select('sender_id').eq('id', data.messageId).single();
                if (check) {
                    this.logger.error(`👉 Message exists but sender_id is ${check.sender_id} (requested by ${data.userId})`);
                } else {
                    this.logger.error(`👉 Message ID ${data.messageId} does not exist`);
                }

                throw new NotFoundException('Mensaje no encontrado o no tienes permiso');
            }

            // 2. Broadcast update to all participants
            // (We reuse the 'new_message' or send a specific 'message_updated' event)
            // Ideally use Supabase Realtime UPDATE event which is already automatic for the table.
            // But we can also push a notification if needed, though usually not for deletion.

            // Note: The `useChat` hook on frontend listens to Postgres UPDATE events, 
            // so it should automatically pick up the change in content and type.

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

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
            });

            const token = await at.toJwt();

            // 🚀 TRIGGER TRANSCRIPTION AGENT
            try {
                const modelMsUrl = (process.env.MODEL_MS_URL || '').trim();

                if (!modelMsUrl) {
                    this.logger.error(`❌ [Transcription Agent] ERROR: Variable MODEL_MS_URL no definida.`);
                    return;
                }

                const triggerAgent = async (url: string, isFallback = false) => {
                    this.logger.log(`📡 [Transcription Agent] Triggering (${isFallback ? 'Fallback' : 'Primary'}) at: ${url}/transcribe`);

                    try {
                        const res = await fetch(`${url}/transcribe`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ room_name: roomName }),
                            signal: AbortSignal.timeout(5000) // 5 seconds timeout
                        });

                        if (res.ok) {
                            this.logger.log(`✅ [Transcription Agent] Trigger exitoso en ${isFallback ? 'Pública' : 'Privada'}`);
                            return true;
                        } else {
                            const errorBody = await res.text();
                            this.logger.warn(`⚠️ [Transcription Agent] El modelo respondió error (${res.status}): ${errorBody}`);
                            return false;
                        }
                    } catch (e) {
                        this.logger.error(`❌ [Transcription Agent] Error en ${isFallback ? 'Pública' : 'Privada'}: ${e.message}`);
                        return false;
                    }
                };

                // Intento 1: URL configurada (Privada)
                const success = await triggerAgent(modelMsUrl);

                // Intento 2: Fallback a URL Pública si la primera falló y no es ya la pública
                if (!success && modelMsUrl.includes('.internal')) {
                    const publicUrl = modelMsUrl.replace('.railway.internal', '.up.railway.app').replace(':8000', '');
                    this.logger.log(`🔄 [Transcription Agent] Reintentando vía URL Pública: ${publicUrl}`);
                    await triggerAgent(publicUrl, true);
                }

            } catch (err) {
                this.logger.warn(`⚠️ Error inesperado lanzando transcripción: ${err.message}`);
            }

            const livekitUrl = process.env.LIVEKIT_URL;
            if (!livekitUrl) {
                this.logger.error('LIVEKIT_URL not found in environment variables');
                throw new BadRequestException('Servicio de video no configurado correctamente');
            }
            return { token, url: livekitUrl };
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

            // 1. Persist the invite to handle concurrency
            const { data: invite, error: inviteError } = await supabase
                .from('interpreter_invites')
                .insert({
                    room_name: data.roomName,
                    sender_id: data.userId,
                    status: 'pending'
                })
                .select()
                .single();

            if (inviteError) {
                this.logger.error(`Error creating interpreter invite: ${inviteError.message}`);
                throw new BadRequestException('Error al crear invitación');
            }

            // 2. Find all users with role 'interpreter' AND not busy
            const { data: interpreters, error } = await supabase
                .from('profiles')
                .select('id, push_token')
                .eq('role', 'interpreter')
                .eq('is_busy', false); // Only available interpreters

            if (error) {
                this.logger.error(`Error fetching interpreters: ${error.message}`);
                return { success: false, message: 'Error buscando intérpretes' };
            }

            if (!interpreters || interpreters.length === 0) {
                return { success: false, message: 'No hay intérpretes disponibles' };
            }

            this.logger.log(`Found ${interpreters.length} interpreters`);

            // 3. Notify them
            const notifications = interpreters.map(async (interpreter) => {
                if (interpreter.push_token) {
                    await this.notificationsService.sendPushNotification(
                        interpreter.push_token,
                        '📞 Solicitud de Intérprete',
                        `${data.username} requiere un intérprete en una llamada.`,
                        {
                            type: 'call_invite',
                            inviteId: invite.id,
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
                        inviteId: invite.id,
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
    async setInterpreterStatus(userId: string, isBusy: boolean) {
        const supabase = this.supabaseService.getAdminClient();
        const { error } = await supabase
            .from('profiles')
            .update({ is_busy: isBusy })
            .eq('id', userId);

        if (error) {
            this.logger.error(`Error updating interpreter status: ${error.message}`);
            throw new BadRequestException('Error actualizando estado');
        }

        if (isBusy) {
            try {
                const { data: others } = await supabase
                    .from('profiles')
                    .select('id, push_token')
                    .eq('role', 'interpreter')
                    .neq('id', userId);

                if (others?.length) {
                    for (const other of others) {
                        // 1. Broadcast en tiempo real (funciona si la app está en foreground/background activo)
                        const ch = supabase.channel(`user:${other.id}`);
                        await ch.send({
                            type: 'broadcast',
                            event: 'call_invite_taken',
                            payload: { acceptedBy: userId },
                        });
                        supabase.removeChannel(ch);

                        // 2. Silent push (funciona aunque el celular esté bloqueado o la app cerrada)
                        // sound: null → no suena, title: '' → no se muestra en el drawer
                        // data._action: 'dismiss_invite' → el app lo procesa y limpia la notificación
                        if (other.push_token && Expo.isExpoPushToken(other.push_token)) {
                            await this.notificationsService.sendPushNotification(
                                other.push_token,
                                '',
                                '',
                                { _action: 'dismiss_invite', acceptedBy: userId, type: 'call_invite_taken' },
                                { sound: null, priority: 'high' }
                            );
                        }
                    }
                    this.logger.log(`Notified ${others.length} interpreters that invite was taken (broadcast + silent push)`);
                }
            } catch (e) {
                this.logger.warn(`Could not broadcast invite cancellation: ${e.message}`);
            }
        }

        return { success: true };
    }


    /**
     * Reclamar una invitación de intérprete de forma atómica
     */
    async claimInterpreterInvite(data: { inviteId: string; userId: string }) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // 1. Intento atómico de reclamar la invitación
            const { data: updated, error } = await supabase
                .from('interpreter_invites')
                .update({
                    status: 'accepted',
                    accepted_by: data.userId
                })
                .eq('id', data.inviteId)
                .eq('status', 'pending')
                .select()
                .single();

            if (error || !updated) {
                this.logger.warn(`Claim failed for invite ${data.inviteId} by user ${data.userId}: ${error?.message || 'Already taken'}`);
                return {
                    success: false,
                    message: 'Esta solicitud ya ha sido atendida por otro intérprete o ha expirado.'
                };
            }

            // 2. Marcar al intérprete como busy (lo hacemos aquí para garantizar atomicidad global del flujo)
            await this.setInterpreterStatus(data.userId, true);

            return {
                success: true,
                inviteId: updated.id,
                roomName: updated.room_name
            };

        } catch (error) {
            this.logger.error(`Error claiming invite: ${error.message}`);
            throw new BadRequestException('Error al procesar la solicitud');
        }
    }

    /**
     * Verificar si un usuario es administrador de una conversación
     */
    private async verifyAdmin(conversationId: string, userId: string) {
        const supabase = this.supabaseService.getAdminClient();
        const { data, error } = await supabase
            .from('conversation_participants')
            .select('role')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .single();

        if (error || !data || data.role !== 'admin') {
            throw new BadRequestException('El usuario no tiene permisos de administrador en este grupo');
        }
        return true;
    }

    private async getProfileDisplayName(userId: string): Promise<string> {
        const supabase = this.supabaseService.getAdminClient();
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
        if (!profile) return '';
        return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }

    /** Mensaje de sistema en el hilo del grupo (no interrumpe con push). */
    private async notifyGroupMemberLeft(conversationId: string, userId: string): Promise<void> {
        try {
            const name = await this.getProfileDisplayName(userId);
            const text = name ? `${name} salió del grupo` : 'Un miembro salió del grupo';
            await this.sendMessage({
                conversationId,
                senderId: userId,
                content: text,
                type: 'text' as any,
                metadata: { isSystem: true, systemEvent: 'member_left' },
            });
        } catch (e) {
            const err = e as Error;
            this.logger.warn(`Group leave system message failed: ${err?.message ?? e}`);
        }
    }

    private async notifyGroupMemberRemoved(conversationId: string, userIdToRemove: string): Promise<void> {
        try {
            const name = await this.getProfileDisplayName(userIdToRemove);
            const text = name ? `${name} fue eliminado del grupo` : 'Un miembro fue eliminado del grupo';
            await this.sendMessage({
                conversationId,
                senderId: userIdToRemove,
                content: text,
                type: 'text' as any,
                metadata: { isSystem: true, systemEvent: 'member_removed' },
            });
        } catch (e) {
            const err = e as Error;
            this.logger.warn(`Group remove system message failed: ${err?.message ?? e}`);
        }
    }

    /**
     * Eliminar un participante del grupo
     */
    async removeParticipant(data: RemoveParticipantDto) {
        try {
            await this.verifyAdmin(data.conversationId, data.adminId);
            const supabase = this.supabaseService.getAdminClient();

            const { error } = await supabase
                .from('conversation_participants')
                .delete()
                .eq('conversation_id', data.conversationId)
                .eq('user_id', data.userIdToRemove);

            if (error) {
                this.logger.error(`Error removing participant: ${error.message}`);
                throw new BadRequestException('Error al eliminar participante');
            }

            await this.notifyGroupMemberRemoved(data.conversationId, data.userIdToRemove);

            return { success: true };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al eliminar participante');
        }
    }

    /**
     * Añadir un participante al grupo
     */
    async addParticipant(data: AddParticipantDto) {
        try {
            await this.verifyAdmin(data.conversationId, data.adminId);
            const supabase = this.supabaseService.getAdminClient();

            // Check if already a participant
            const { data: existing } = await supabase
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', data.conversationId)
                .eq('user_id', data.userIdToAdd)
                .single();

            if (existing) {
                throw new BadRequestException('El usuario ya es miembro de este grupo');
            }

            const { error } = await supabase
                .from('conversation_participants')
                .insert({
                    conversation_id: data.conversationId,
                    user_id: data.userIdToAdd,
                    role: 'member',
                    added_by: data.adminId,
                    joined_at: new Date().toISOString()
                });

            if (error) {
                this.logger.error(`Error adding participant: ${error.message}`);
                throw new BadRequestException('Error al añadir participante');
            }

            return { success: true };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al añadir participante');
        }
    }

    /**
     * Promover un participante a administrador
     */
    async promoteToAdmin(data: PromoteToAdminDto) {
        try {
            await this.verifyAdmin(data.conversationId, data.adminId);
            const supabase = this.supabaseService.getAdminClient();

            const { error } = await supabase
                .from('conversation_participants')
                .update({ role: 'admin' })
                .eq('conversation_id', data.conversationId)
                .eq('user_id', data.userIdToPromote);

            if (error) {
                this.logger.error(`Error promoting to admin: ${error.message}`);
                throw new BadRequestException('Error al promover a administrador');
            }

            return { success: true };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al promover a administrador');
        }
    }

    /**
     * Salir de un grupo
     */
    async leaveGroup(data: LeaveGroupDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Check if user is the last admin
            const { data: admins, error: adminsError } = await supabase
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', data.conversationId)
                .eq('role', 'admin');

            if (!adminsError && admins?.length === 1 && admins[0].user_id === data.userId) {
                // Si es el último administrador, obtenemos a los demás miembros
                const { data: otherMembers, error: membersError } = await supabase
                    .from('conversation_participants')
                    .select('user_id')
                    .eq('conversation_id', data.conversationId)
                    .neq('user_id', data.userId);

                if (!membersError && otherMembers && otherMembers.length > 0) {
                    // Seleccionar un miembro aleatoriamente
                    const randomIndex = Math.floor(Math.random() * otherMembers.length);
                    const newAdminId = otherMembers[randomIndex].user_id;

                    // Promoverlo a admin
                    await supabase
                        .from('conversation_participants')
                        .update({ role: 'admin' })
                        .eq('conversation_id', data.conversationId)
                        .eq('user_id', newAdminId);
                }
            }

            const { error } = await supabase
                .from('conversation_participants')
                .delete()
                .eq('conversation_id', data.conversationId)
                .eq('user_id', data.userId);

            if (error) {
                this.logger.error(`Error leaving group: ${error.message}`);
                throw new BadRequestException('Error al salir del grupo');
            }

            await this.notifyGroupMemberLeft(data.conversationId, data.userId);

            return { success: true };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al salir del grupo');
        }
    }

    /**
     * Actualizar información del grupo (título, imagen, descripción)
     */
    async updateGroup(data: UpdateGroupDto) {
        try {
            await this.verifyAdmin(data.conversationId, data.adminId);
            const supabase = this.supabaseService.getAdminClient();

            const updates: any = { updated_at: new Date().toISOString() };
            if (data.title) updates.title = data.title;
            if (data.imageUrl) updates.image_url = data.imageUrl;
            if (data.description) updates.description = data.description;

            const { data: group, error } = await supabase
                .from('conversations')
                .update(updates)
                .eq('id', data.conversationId)
                .select()
                .single();

            if (error) {
                this.logger.error(`Error updating group: ${error.message}`);
                throw new BadRequestException('Error al actualizar la información del grupo');
            }

            return { group };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al actualizar el grupo');
        }
    }

    /**
     * Obtener participantes de un grupo con sus perfiles
     */
    async getGroupParticipants(conversationId: string) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // 1. Obtener los IDs de los participantes y sus roles
            const { data: participants, error: partError } = await supabase
                .from('conversation_participants')
                .select('user_id, role')
                .eq('conversation_id', conversationId);

            if (partError) {
                this.logger.error(`Error fetching participants: ${partError.message}`);
                throw new BadRequestException(`No se pudieron obtener los participantes: ${partError.message}`);
            }

            if (!participants || participants.length === 0) {
                return [];
            }

            const participantIds = participants.map(p => p.user_id);

            // 2. Obtener los perfiles de esos participantes
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, phone, avatar_url')
                .in('id', participantIds);

            if (profError) {
                this.logger.error(`Error fetching profiles: ${profError.message}`);
                throw new BadRequestException(`No se pudieron obtener los perfiles: ${profError.message}`);
            }

            // 3. Mapear datos
            return participantIds.map(id => {
                const profile = profiles.find(p => p.id === id);
                const participation = participants.find(p => p.user_id === id);
                return {
                    id,
                    firstName: profile?.first_name,
                    lastName: profile?.last_name,
                    phone: profile?.phone,
                    avatarUrl: profile?.avatar_url,
                    role: participation?.role || 'member'
                };
            });
        } catch (error) {
            this.logger.error(`Error in getGroupParticipants: ${error.message}`);
            throw new BadRequestException('Error al obtener participantes del grupo');
        }
    }
}

