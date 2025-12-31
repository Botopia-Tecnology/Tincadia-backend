import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'FORMS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.formsHost || '127.0.0.1',
          port: parseInt(process.env.formsPort || '3004'),
          // Increase max message size for large form submissions
          maxMessageSize: 10 * 1024 * 1024, // 10MB
        },
      },
    ]),
  ],
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule { }

