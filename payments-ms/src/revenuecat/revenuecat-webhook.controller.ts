import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Controller()
export class RevenueCatWebhookController {

    constructor(private readonly revenueCatService: RevenueCatWebhookService) {}

    @MessagePattern('revenuecat.webhook')
    handleWebhook(@Payload() event: any) {
        return this.revenueCatService.handleEvent(event);
    }
}
