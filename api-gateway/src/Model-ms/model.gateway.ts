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
    cors: {
        origin: (requestOrigin, callback) => {
            callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket']
})
export class ModelGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private readonly logsEnabled = process.env.LOGS_ENABLED?.toLowerCase() !== 'false';

    constructor(private readonly modelService: ModelService) { }

    async handleConnection(client: Socket) {
        if (this.logsEnabled) {
            console.log(`[ModelGateway] Client connected: ${client.id}`);
        }
        client.emit('status', 'connected');
        // Initialize Python session for this client
        await this.modelService.connectToPython(client);
    }

    handleDisconnect(client: Socket) {
        if (this.logsEnabled) {
            console.log(`[ModelGateway] Client disconnected: ${client.id}`);
        }
        this.modelService.disconnectFromPython(client.id);
    }

    @SubscribeMessage('landmarks')
    handleLandmarks(
        @MessageBody() payload: { data: number[] },
        @ConnectedSocket() client: Socket,
    ) {
        if (!payload || !payload.data || payload.data.length !== 226) {
            // Invalid data ignore
            return;
        }

        // Just forward to Python via ModelService proxy
        this.modelService.sendLandmarks(client.id, payload.data);
    }

    @SubscribeMessage('reset')
    handleReset(@ConnectedSocket() client: Socket) {
        this.modelService.resetSession(client.id);
    }

    @SubscribeMessage('set_context')
    handleSetContext(
        @MessageBody() data: { context: string | null },
        @ConnectedSocket() client: Socket,
    ) {
        this.modelService.setContext(client.id, data.context);
    }

    @SubscribeMessage('word_accepted')
    handleWordAccepted(
        @MessageBody() data: { word: string },
        @ConnectedSocket() client: Socket,
    ) {
        if (this.logsEnabled) console.log(`[ModelGateway] Received 'word_accepted' from ${client.id}:`, data);
        this.modelService.sendConfirmedWord(client.id, data.word);
    }
}
