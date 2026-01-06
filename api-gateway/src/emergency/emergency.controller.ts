import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('emergency')
export class EmergencyController {
    constructor(
        @Inject('EMERGENCY_SERVICE') private readonly emergencyClient: ClientProxy,
    ) { }

    @Post('generate-audio')
    async generateAudio(@Body() body: { emergencyType: string; location: string; language?: string }) {
        try {
            return await firstValueFrom(
                this.emergencyClient.send({ cmd: 'generate-emergency-audio' }, body),
            );
        } catch (error) {
            throw new BadRequestException(error.message || 'Error generating emergency audio');
        }
    }
}
