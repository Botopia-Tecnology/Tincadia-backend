import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GenerateTokenDto } from './dto/generate-token.dto';

@ApiTags('Video Calls')
@ApiBearerAuth()
@Controller('calls')
export class CallsController {
    constructor(
        @Inject('CHAT_SERVICE') private readonly chatClient: ClientProxy,
    ) { }

    @Post('token')
    @ApiOperation({ summary: 'Generar token de acceso para video llamada' })
    @ApiResponse({ status: 201, description: 'Token generado exitosamente' })
    async getToken(@Body() dto: GenerateTokenDto) {
        return this.chatClient.send('generate_video_token', {
            roomName: dto.roomName || 'default-room',
            username: dto.username || 'Guest',
        });
    }
}
