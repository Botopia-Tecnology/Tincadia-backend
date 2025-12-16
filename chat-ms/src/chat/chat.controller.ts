import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';

@Controller()
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly correctionService: CorrectionService,
    ) { }

    @MessagePattern('correct_text')
    correctText(@Payload() data: { text: string }) {
        return this.correctionService.correctText(data.text);
    }

    @MessagePattern('start_conversation')
    startConversation(@Payload() data: StartConversationDto) {
        return this.chatService.startConversation(data);
    }

    @MessagePattern('send_message')
    sendMessage(@Payload() data: SendMessageDto) {
        return this.chatService.sendMessage(data);
    }

    @MessagePattern('get_messages')
    getMessages(@Payload() data: GetMessagesDto) {
        return this.chatService.getMessages(data);
    }

    @MessagePattern('get_conversations')
    getConversations(@Payload() data: GetConversationsDto) {
        return this.chatService.getConversations(data);
    }

    @MessagePattern('mark_as_read')
    markAsRead(@Payload() data: { conversationId: string; userId: string }) {
        return this.chatService.markAsRead(data.conversationId, data.userId);
    }

    @MessagePattern('edit_message')
    editMessage(@Payload() data: EditMessageDto) {
        return this.chatService.editMessage(data);
    }

    @MessagePattern('delete_message')
    deleteMessage(@Payload() data: DeleteMessageDto) {
        return this.chatService.deleteMessage(data);
    }

    @MessagePattern('correct_text_stream')
    async *correctTextStream(@Payload() data: { text: string }) {
        for await (const chunk of this.correctionService.correctTextStream(data.text)) {
            yield chunk;
        }
    }
}
