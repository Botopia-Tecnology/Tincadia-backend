import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatController } from './chat.controller';
import { CorrectionStreamService } from './correction-stream.service';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'CHAT_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.chatHost || '127.0.0.1',
                    port: parseInt(process.env.chatPort || '3006'),
                },
            },
        ]),
    ],
    controllers: [ChatController],
    providers: [CorrectionStreamService],
})
export class ChatModule { }
