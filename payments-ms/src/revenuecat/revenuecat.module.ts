import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Subscription])],
    controllers: [RevenueCatWebhookController],
    providers: [RevenueCatWebhookService],
})
export class RevenueCatModule {}
