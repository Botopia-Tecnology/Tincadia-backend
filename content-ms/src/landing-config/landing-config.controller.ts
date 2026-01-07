import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LandingConfigService } from './landing-config.service';
import { UpdateLandingConfigDto } from './dto/update-landing-config.dto';

@Controller()
export class LandingConfigController {
    constructor(private readonly landingConfigService: LandingConfigService) { }

    @MessagePattern('get_landing_config')
    findAll() {
        return this.landingConfigService.findAll();
    }

    @MessagePattern('get_landing_config_by_key')
    findOne(@Payload() data: { key: string }) {
        return this.landingConfigService.findOne(data.key);
    }

    @MessagePattern('update_landing_config')
    update(@Payload() updateLandingConfigDto: UpdateLandingConfigDto) {
        return this.landingConfigService.update(updateLandingConfigDto);
    }
}
