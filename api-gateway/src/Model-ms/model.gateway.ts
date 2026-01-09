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
import { Logger } from '@nestjs/common';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

@WebSocketGateway({
    cors: {
        origin: '*', // TODO: Configurar con el origen del frontend en producción
        credentials: true,
    },
    namespace: '/model-stream',
})
export class ModelGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ModelGateway.name);
    private readonly pythonServiceUrl = process.env.MODEL_MS_URL || 'http://127.0.0.1:8000';

    // Map de conexiones: cliente socket.io -> WebSocket de Python
    private readonly clientConnections = new Map<string, WebSocket>();

    handleConnection(client: Socket) {
        this.logger.log(`Frontend client connected: ${client.id}`);

        try {
            // Conectar al WebSocket de Python
            const wsUrl = this.pythonServiceUrl.replace('http://', 'ws://').replace('https://', 'wss://');
            const pythonWs = new WebSocket(`${wsUrl}/ws/predict`);

            pythonWs.onopen = () => {
                this.logger.log(`Connected to Python WebSocket for client ${client.id}`);
            };

            pythonWs.onmessage = (event) => {
                // Reenviar mensaje de Python al cliente frontend
                try {
                    const data = JSON.parse(event.data);
                    client.emit('prediction', data);
                } catch (error) {
                    this.logger.error(`Error parsing Python message: ${error.message}`);
                }
            };

            pythonWs.onerror = (error) => {
                this.logger.error(`Python WebSocket error for client ${client.id}:`, error);
                client.emit('error', { message: 'Error connecting to prediction service' });
            };

            pythonWs.onclose = () => {
                this.logger.log(`Python WebSocket closed for client ${client.id}`);
                this.clientConnections.delete(client.id);
            };

            // Guardar la conexión
            this.clientConnections.set(client.id, pythonWs);

        } catch (error) {
            this.logger.error(`Failed to connect to Python service: ${error.message}`);
            client.emit('error', { message: 'Failed to initialize prediction service' });
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Frontend client disconnected: ${client.id}`);

        // Cerrar la conexión con Python
        const pythonWs = this.clientConnections.get(client.id);
        if (pythonWs) {
            if (pythonWs.readyState === WebSocket.OPEN) {
                pythonWs.send(JSON.stringify({ type: 'close' }));
                pythonWs.close();
            }
            this.clientConnections.delete(client.id);
        }
    }

    @SubscribeMessage('landmarks')
    handleLandmarks(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { data: number[] },
    ) {
        const pythonWs = this.clientConnections.get(client.id);

        if (!pythonWs || pythonWs.readyState !== WebSocket.OPEN) {
            client.emit('error', { message: 'Not connected to prediction service' });
            return;
        }

        // Reenviar landmarks a Python
        try {
            pythonWs.send(JSON.stringify({
                type: 'landmarks',
                data: data.data,
            }));
        } catch (error) {
            this.logger.error(`Error sending landmarks: ${error.message}`);
            client.emit('error', { message: 'Error sending landmarks to prediction service' });
        }
    }

    @SubscribeMessage('reset')
    handleReset(@ConnectedSocket() client: Socket) {
        const pythonWs = this.clientConnections.get(client.id);

        if (!pythonWs || pythonWs.readyState !== WebSocket.OPEN) {
            client.emit('error', { message: 'Not connected to prediction service' });
            return;
        }

        try {
            pythonWs.send(JSON.stringify({ type: 'reset' }));
        } catch (error) {
            this.logger.error(`Error sending reset: ${error.message}`);
            client.emit('error', { message: 'Error resetting prediction buffer' });
        }
    }
}
