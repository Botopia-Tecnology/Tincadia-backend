import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { EmergencyController } from './emergency.controller';

@Module({
    imports: [
        ClientsModule.registerAsync([
            {
                name: 'EMERGENCY_SERVICE',
                useFactory: (configService: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host: process.env.emergencyHost || '127.0.0.1',
                        port: parseInt(process.env.emergencyPort || '3009'),
                    },
                }),
                inject: [ConfigService],
            },
        ]),
    ],
    controllers: [EmergencyController],
})
export class EmergencyModule { }
