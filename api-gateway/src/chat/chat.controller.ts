import { Controller, Post, Get, Put, Delete, Body, Param, Query, Inject, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { map } from 'rxjs/operators';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StartConversationDto } from './dto/start-conversation.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendChatMessageDto } from './dto/send-message.dto';
import { GetMessagesDto, GetConversationsDto, MarkAsReadDto, EditMessageDto, DeleteMessageDto } from './dto/chat.dto';
import { AddContactDto, UpdateContactDto } from './dto/contact.dto';
import { RemoveParticipantDto, PromoteToAdminDto, LeaveGroupDto, UpdateGroupDto, AddParticipantDto } from './dto/group-management.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(
        @Inject('CHAT_SERVICE') private readonly client: ClientProxy,
        private readonly configService: ConfigService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        }
    }

    @Post('conversations')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Iniciar o obtener conversación 1:1' })
    @ApiResponse({ status: 201, description: 'Conversación creada/obtenida' })
    startConversation(@Body() dto: StartConversationDto) {
        return this.client.send('start_conversation', dto);
    }

    @Post('groups')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Crear nuevo grupo' })
    @ApiResponse({ status: 201, description: 'Grupo creado' })
    createGroup(@Body() dto: CreateGroupDto) {
        return this.client.send('create_group', dto);
    }

    @Get('conversations/:userId')
    @ApiOperation({ summary: 'Obtener todas las conversaciones de un usuario' })
    @ApiResponse({ status: 200, description: 'Lista de conversaciones' })
    getConversations(@Param('userId') userId: string) {
        return this.client.send('get_conversations', { userId });
    }

    @Post('messages')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Enviar mensaje' })
    @ApiResponse({ status: 201, description: 'Mensaje enviado' })
    sendMessage(@Body() dto: SendChatMessageDto) {
        return this.client.send('send_message', dto);
    }

    @Get('messages/:conversationId')
    @ApiOperation({ summary: 'Obtener mensajes de una conversación' })
    @ApiResponse({ status: 200, description: 'Lista de mensajes' })
    getMessages(
        @Param('conversationId') conversationId: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        return this.client.send('get_messages', { conversationId, limit, offset });
    }

    @Post('messages/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Marcar mensajes como leídos' })
    @ApiResponse({ status: 200, description: 'Mensajes marcados como leídos' })
    markAsRead(@Body() dto: MarkAsReadDto) {
        return this.client.send('mark_as_read', dto);
    }

    @Put('messages/:messageId')
    @ApiOperation({ summary: 'Editar mensaje' })
    @ApiResponse({ status: 200, description: 'Mensaje editado' })
    editMessage(@Param('messageId') messageId: string, @Body() dto: Omit<EditMessageDto, 'messageId'>) {
        return this.client.send('edit_message', { ...dto, messageId });
    }

    @Delete('messages/:messageId')
    @ApiOperation({ summary: 'Eliminar mensaje (soft delete)' })
    @ApiResponse({ status: 200, description: 'Mensaje eliminado' })
    deleteMessage(@Param('messageId') messageId: string, @Body() dto: { userId: string }) {
        return this.client.send('delete_message', { messageId, userId: dto.userId });
    }

    @Post('correct-text')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Corregir texto usando IA' })
    @ApiResponse({ status: 200, description: 'Texto corregido' })
    correctText(@Body('text') text: string) {
        return this.client.send('correct_text', { text }).pipe(
            map((correctedText) => ({ correctedText })),
        );
    }

    // ===== CONTACTS =====

    @Post('contacts')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Agregar contacto por número de teléfono' })
    @ApiResponse({ status: 201, description: 'Contacto agregado' })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
    @ApiResponse({ status: 409, description: 'Contacto ya existe' })
    addContact(@Body() dto: AddContactDto) {
        return this.client.send('add_contact', dto);
    }

    @Get('contacts/:userId')
    @ApiOperation({ summary: 'Obtener lista de contactos' })
    @ApiResponse({ status: 200, description: 'Lista de contactos' })
    getContacts(
        @Param('userId') userId: string,
        @Query('since') since?: string
    ) {
        return this.client.send('get_contacts', { ownerId: userId, since });
    }

    @Put('contacts/:contactId')
    @ApiOperation({ summary: 'Actualizar contacto (alias, nombre)' })
    @ApiResponse({ status: 200, description: 'Contacto actualizado' })
    updateContact(
        @Param('contactId') contactId: string,
        @Body() dto: UpdateContactDto & { ownerId: string },
    ) {
        return this.client.send('update_contact', { ...dto, contactId });
    }

    @Delete('contacts/:contactId')
    @ApiOperation({ summary: 'Eliminar contacto' })
    @ApiResponse({ status: 200, description: 'Contacto eliminado' })
    deleteContact(
        @Param('contactId') contactId: string,
        @Body() dto: { ownerId: string },
    ) {
        return this.client.send('delete_contact', { contactId, ownerId: dto.ownerId });
    }

    @Post('calls/interpreters')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Invitar intérpretes a una llamada' })
    @ApiResponse({ status: 200, description: 'Invitaciones enviadas' })
    inviteInterpreters(@Body() dto: { roomName: string; userId: string; username: string }) {
        return this.client.send('invite_interpreters', dto);
    }

    @Post('interpreter/status')
    @ApiOperation({ summary: 'Update interpreter busy status' })
    @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string' }, isBusy: { type: 'boolean' } } } })
    setInterpreterStatus(@Body() body: { userId: string; isBusy: boolean }) {
        return this.client.send('set_interpreter_status', body);
    }

    // ===== GESTIÓN DE GRUPOS =====

    @Post('groups/add')
    @ApiOperation({ summary: 'Añadir participante al grupo' })
    addParticipant(@Body() dto: AddParticipantDto) {
        return this.client.send('add_participant', dto);
    }

    @Post('groups/remove')
    @ApiOperation({ summary: 'Eliminar participante del grupo' })
    removeParticipant(@Body() dto: RemoveParticipantDto) {
        return this.client.send('remove_participant', dto);
    }

    @Post('groups/promote')
    @ApiOperation({ summary: 'Promover a administrador del grupo' })
    promoteToAdmin(@Body() dto: PromoteToAdminDto) {
        return this.client.send('promote_to_admin', dto);
    }

    @Post('groups/leave')
    @ApiOperation({ summary: 'Salir del grupo' })
    leaveGroup(@Body() dto: LeaveGroupDto) {
        return this.client.send('leave_group', dto);
    }

    @Put('groups')
    @ApiOperation({ summary: 'Actualizar información del grupo' })
    updateGroup(@Body() dto: UpdateGroupDto) {
        return this.client.send('update_group', dto);
    }

    @Get('groups/:conversationId/participants')
    @ApiOperation({ summary: 'Obtener participantes de un grupo' })
    getParticipants(@Param('conversationId') conversationId: string) {
        return this.client.send('get_group_participants', { conversationId });
    }

    @Post('correct-text/stream')
    @ApiOperation({ summary: 'Corregir texto usando IA con streaming (SSE)' })
    @ApiResponse({ status: 200, description: 'Stream de texto corregido' })
    async correctTextStream(@Body('text') text: string, @Res() res: Response) {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        if (!this.model) {
            res.write(`data: ${JSON.stringify({ error: 'Gemini API not configured' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        try {
            const prompt = `Eres un asistente experto en corrección de textos en español. Tu tarea es corregir la gramática, ortografía y puntuación del siguiente texto, convirtiéndolo en un español claro y legible. El texto original puede provenir de una persona sorda con estructuras gramaticales no convencionales.
      
Instrucciones:
1. Mantén el sentido original del mensaje.
2. No agregues explicaciones, saludos ni despedidas. Solo devuelve el texto corregido.
3. Si el texto ya es correcto, devuélvelo tal cual.
      
Texto original: "${text}"`;

            const result = await this.model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error('❌ Gemini Streaming Error:', error);
            res.write(`data: ${JSON.stringify({ error: 'Error generating correction' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
}
