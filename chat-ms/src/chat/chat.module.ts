import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';
import { EncryptionService } from './encryption.service';
import { ContactService } from './contact.service';

@Module({
    controllers: [ChatController],
    providers: [ChatService, CorrectionService, EncryptionService, ContactService],
    exports: [ChatService, CorrectionService, EncryptionService, ContactService],
})
export class ChatModule { }
