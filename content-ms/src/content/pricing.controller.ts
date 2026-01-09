import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PricingService } from './pricing.service';
import { PricingPlan } from './entities/pricing-plan.entity';

@Controller()
export class PricingController {
    constructor(private readonly pricingService: PricingService) { }

    @MessagePattern('pricing.findAll')
    async findAll(@Payload() activeOnly: boolean = true) {
        // Init defaults if empty
        await this.pricingService.seedDefaults();
        return this.pricingService.findAll(activeOnly);
    }

    @MessagePattern('pricing.findOne')
    async findOne(@Payload() id: string) {
        return this.pricingService.findOne(id);
    }

    @MessagePattern('pricing.create')
    async create(@Payload() data: Partial<PricingPlan>) {
        return this.pricingService.create(data);
    }

    @MessagePattern('pricing.update')
    async update(@Payload() payload: { id: string, data: Partial<PricingPlan> }) {
        return this.pricingService.update(payload.id, payload.data);
    }
}
