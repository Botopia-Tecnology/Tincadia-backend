import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CorrectionService } from './correction.service';
import { EncryptionService } from './encryption.service';
import { ContactService } from './contact.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'COMMUNICATION_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.communicationHost || '127.0.0.1',
                    port: parseInt(process.env.communicationPort || '3005'),
                },
            },
            {
                name: 'CONTENT_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.contentHost || '127.0.0.1',
                    port: parseInt(process.env.contentPort || '3008'),
                },
            },
        ]),
    ],
    controllers: [ChatController],
    providers: [ChatService, CorrectionService, EncryptionService, ContactService],
    exports: [ChatService, CorrectionService, EncryptionService, ContactService],
})
export class ChatModule { }
