import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ModelService } from './model.service';

@WebSocketGateway({
    namespace: 'model-stream',
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
})
export class ModelGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(private readonly modelService: ModelService) { }

    handleConnection(client: Socket) {
        console.log(`[ModelGateway] Client connected: ${client.id}`);
        client.emit('status', 'connected');
    }

    handleDisconnect(client: Socket) {
        console.log(`[ModelGateway] Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('landmarks')
    async handleLandmarks(
        @MessageBody() payload: { data: number[] },
        @ConnectedSocket() client: Socket,
    ) {
        if (!payload || !payload.data || payload.data.length !== 226) {
            // Invalid data ignore
            return;
        }

        // Call Python service via HTTP
        const result = await this.modelService.predictLandmarks(payload.data);

        // Emit result back to specific client
        client.emit('prediction', result);
    }

    @SubscribeMessage('reset')
    handleReset(@ConnectedSocket() client: Socket) {
        // Optional: clear any buffer if we implemented stateful RNN
        // For now successful confirmation can just be ack
        client.emit('reset_ack');
    }
}
