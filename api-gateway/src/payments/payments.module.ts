import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PAYMENTS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.paymentsHost || 'localhost',
          port: parseInt(process.env.paymentsPort || '3003'),
        },
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

