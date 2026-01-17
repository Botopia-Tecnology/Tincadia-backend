import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller()
export class SubscriptionsController {
    constructor(private readonly subscriptionsService: SubscriptionsService) { }

    @MessagePattern('subscriptions.create')
    create(@Payload() dto: CreateSubscriptionDto) {
        return this.subscriptionsService.create(dto);
    }

    @MessagePattern('subscriptions.findAll')
    findAll(@Payload() query: any) {
        return this.subscriptionsService.findAll(query || {});
    }

    @MessagePattern('subscriptions.findByUser')
    findByUser(@Payload() userId: string) {
        // Handle case where payload might be an object { userId: '...' } or just string
        const id = typeof userId === 'object' ? (userId as any).userId : userId;
        return this.subscriptionsService.findByUserId(id);
    }

    @MessagePattern('subscriptions.getStatus')
    getStatus(@Payload() userId: string) {
        const id = typeof userId === 'object' ? (userId as any).userId : userId;
        return this.subscriptionsService.getStatus(id);
    }

    @MessagePattern('subscriptions.findOne')
    findOne(@Payload() id: string) {
        const subId = typeof id === 'object' ? (id as any).id : id;
        return this.subscriptionsService.findOne(subId);
    }

    @MessagePattern('subscriptions.update')
    update(@Payload() data: { id: string, dto: UpdateSubscriptionDto }) {
        return this.subscriptionsService.update(data.id, data.dto);
    }

    @MessagePattern('subscriptions.cancel')
    cancel(@Payload() data: { id: string, immediate: boolean }) {
        return this.subscriptionsService.cancel(data.id, data.immediate);
    }

    @MessagePattern('subscriptions.updatePaymentSource')
    updatePaymentSource(@Payload() data: { id: string, paymentSourceId: string, cardLastFour?: string, cardBrand?: string }) {
        return this.subscriptionsService.updatePaymentSource(
            data.id,
            data.paymentSourceId,
            data.cardLastFour,
            data.cardBrand
        );
    }

    @MessagePattern('subscriptions.renew')
    async processRenewal(@Payload() id: string) {
        const subId = typeof id === 'object' ? (id as any).id : id;
        const subscription = await this.subscriptionsService.findOne(subId);
        const success = await this.subscriptionsService.processRenewal(subscription);
        return { success };
    }
}
