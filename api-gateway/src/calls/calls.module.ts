import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { CallsController } from './calls.controller';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'CHAT_SERVICE',
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: configService.get('CHAT_HOST', 'localhost'),
                        port: parseInt(configService.get('CHAT_PORT', '3006')),
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    controllers: [CallsController],
})
export class CallsModule { }
