import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';
import { EncryptionService } from './encryption.service';

@Module({
    controllers: [ChatController],
    providers: [ChatService, CorrectionService, EncryptionService],
    exports: [ChatService, CorrectionService, EncryptionService],
})
export class ChatModule { }
