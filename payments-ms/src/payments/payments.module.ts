import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PricingPlan } from './entities/pricing-plan.entity';
import { Purchase } from './entities/purchase.entity';
import { Course } from './entities/course.entity';
import { PurchasesService } from './purchases.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { WompiModule } from '../wompi/wompi.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment, PricingPlan, Subscription, Purchase, Course]),
        WompiModule,
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService, PurchasesService],
    exports: [PaymentsService, PurchasesService],
})
export class PaymentsModule { }

