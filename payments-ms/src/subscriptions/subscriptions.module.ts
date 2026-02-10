import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { PricingPlan } from '../payments/entities/pricing-plan.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { WompiModule } from '../wompi/wompi.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Subscription, PricingPlan]),
        WompiModule,
    ],
    controllers: [SubscriptionsController],
    providers: [SubscriptionsService],
    exports: [SubscriptionsService],
})
export class SubscriptionsModule { }
