import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ContentController } from './content.controller';

@Module({
    imports: [
        ClientsModule.register([
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
    controllers: [ContentController],
})
export class ContentModule { }
