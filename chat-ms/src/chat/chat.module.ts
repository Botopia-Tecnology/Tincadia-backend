import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';

@Module({
    controllers: [ChatController],
    providers: [ChatService, CorrectionService],
    exports: [ChatService, CorrectionService],
})
export class ChatModule { }
