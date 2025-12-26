import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommunicationController, AppNotificationsController } from './communication.controller';
import { CommunicationService } from './communication.service';

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
    ]),
  ],
  controllers: [CommunicationController, AppNotificationsController],
  providers: [CommunicationService],
})
export class CommunicationModule { }
