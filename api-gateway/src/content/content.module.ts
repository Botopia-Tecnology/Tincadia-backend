import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ContentController } from './content.controller';
import { PricingController } from './pricing.controller';
import { PaymentsModule } from '../payments/payments.module';

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
            {
                name: 'AUTH_SERVICE',
                transport: Transport.TCP,
                options: {
                    host: process.env.authHost || '127.0.0.1',
                    port: parseInt(process.env.authPort || '3001'),
                },
            },
        ]),
        PaymentsModule,
    ],
    controllers: [ContentController, PricingController],
})
export class ContentModule { }
