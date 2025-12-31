import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ContactsController } from './contacts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    ClientsModule.register([
      {
        name: 'CONTACTS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.contactsHost || '127.0.0.1',
          port: parseInt(process.env.contactsPort || '3007', 10),
        },
      },
    ]),
  ],
  controllers: [ContactsController],
})
export class ContactsModule {}










