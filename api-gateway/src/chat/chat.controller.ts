import { Controller, Post, Get, Put, Delete, Body, Param, Query, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto, GetConversationsDto, MarkAsReadDto, EditMessageDto, DeleteMessageDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
    constructor(
        @Inject('CHAT_SERVICE') private readonly client: ClientProxy,
    ) { }

    @Post('conversations')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Iniciar o obtener conversación 1:1' })
    @ApiResponse({ status: 201, description: 'Conversación creada/obtenida' })
    startConversation(@Body() dto: StartConversationDto) {
        return this.client.send('start_conversation', dto);
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
    sendMessage(@Body() dto: SendMessageDto) {
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
}
