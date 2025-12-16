import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';
import { ContactService } from './contact.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { GetConversationsDto } from './dto/get-conversations.dto';
import { StartConversationDto } from './dto/start-conversation.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { AddContactDto, UpdateContactDto, DeleteContactDto, GetContactsDto } from './dto/contact.dto';

@Controller()
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly correctionService: CorrectionService,
        private readonly contactService: ContactService,
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

    // ===== CONTACTS =====

    @MessagePattern('add_contact')
    addContact(@Payload() data: AddContactDto) {
        return this.contactService.addContact(data);
    }

    @MessagePattern('get_contacts')
    getContacts(@Payload() data: GetContactsDto) {
        return this.contactService.getContacts(data);
    }

    @MessagePattern('update_contact')
    updateContact(@Payload() data: UpdateContactDto) {
        return this.contactService.updateContact(data);
    }

    @MessagePattern('delete_contact')
    deleteContact(@Payload() data: DeleteContactDto) {
        return this.contactService.deleteContact(data);
    }
}
