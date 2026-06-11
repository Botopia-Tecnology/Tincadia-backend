import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GenerateAudioDto } from './dto/generate-audio.dto';

@ApiTags('Emergency')
@ApiBearerAuth()
@Controller('emergency')
export class EmergencyController {
    constructor(
        @Inject('EMERGENCY_SERVICE') private readonly emergencyClient: ClientProxy,
    ) { }

    @Post('generate-audio')
    @ApiOperation({
        summary: 'Generar audio de emergencia',
        description: 'Genera un audio de alerta para el tipo de emergencia indicado. Útil para usuarios con discapacidad auditiva que necesitan comunicar una emergencia a terceros.'
    })
    @ApiResponse({ status: 201, description: 'Audio generado exitosamente', schema: { example: { audioUrl: 'https://res.cloudinary.com/.../emergencia_incendio.mp3' } } })
    @ApiResponse({ status: 400, description: 'Error al generar el audio de emergencia' })
    async generateAudio(@Body() dto: GenerateAudioDto) {
        try {
            return await firstValueFrom(
                this.emergencyClient.send({ cmd: 'generate-emergency-audio' }, dto),
            );
        } catch (error) {
            throw new BadRequestException(error.message || 'Error al generar el audio de emergencia');
        }
    }
}
