import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PricingPlan } from './entities/pricing-plan.entity';
import { WompiModule } from '../wompi/wompi.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment, PricingPlan]),
        WompiModule,
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
