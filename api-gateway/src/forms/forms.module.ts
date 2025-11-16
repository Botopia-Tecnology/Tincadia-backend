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
          host: process.env.formsHost || 'localhost',
          port: parseInt(process.env.formsPort || '3004'),
        },
      },
    ]),
  ],
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}

