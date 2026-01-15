import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(private readonly subscriptionsService: SubscriptionsService) { }

    @Post()
    create(@Body() dto: CreateSubscriptionDto) {
        return this.subscriptionsService.create(dto);
    }

    @Get('user/:userId')
    findByUser(@Param('userId') userId: string) {
        return this.subscriptionsService.findByUserId(userId);
    }

    @Get('user/:userId/status')
    getStatus(@Param('userId') userId: string) {
        return this.subscriptionsService.getStatus(userId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.subscriptionsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
        return this.subscriptionsService.update(id, dto);
    }

    @Post(':id/cancel')
    cancel(
        @Param('id') id: string,
        @Query('immediate') immediate?: string
    ) {
        return this.subscriptionsService.cancel(id, immediate === 'true');
    }

    @Patch(':id/payment-source')
    updatePaymentSource(
        @Param('id') id: string,
        @Body() body: { paymentSourceId: string; cardLastFour?: string; cardBrand?: string }
    ) {
        return this.subscriptionsService.updatePaymentSource(
            id,
            body.paymentSourceId,
            body.cardLastFour,
            body.cardBrand
        );
    }

    @Post(':id/renew')
    async processRenewal(@Param('id') id: string) {
        const subscription = await this.subscriptionsService.findOne(id);
        const success = await this.subscriptionsService.processRenewal(subscription);
        return { success };
    }
}
