import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('calls')
export class CallsController {
    constructor(
        @Inject('CHAT_SERVICE') private readonly chatClient: ClientProxy,
    ) { }

    @Post('token')
    async getToken(
        @Body('roomName') roomName: string,
        @Body('username') username: string,
    ) {
        return this.chatClient.send('generate_video_token', {
            roomName: roomName || 'default-room',
            username: username || 'Guest',
        });
    }
}
