import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EmergencyService } from './emergency.service';

@Controller('emergency')
export class EmergencyController {
    constructor(private readonly emergencyService: EmergencyService) { }

    @MessagePattern({ cmd: 'generate-emergency-audio' })
    async generateAudio(@Payload() data: { emergencyType: string; location: string; language?: string }) {
        return this.emergencyService.generateAudio(data.emergencyType, data.location, data.language);
    }
}
