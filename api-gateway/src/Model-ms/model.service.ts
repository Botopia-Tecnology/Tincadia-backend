import { Injectable, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import io, { Socket as ClientSocket } from 'socket.io-client';
import { Socket as ServerSocket } from 'socket.io'; // Import server socket type for type safety

@Injectable()
export class ModelService {
    private readonly pythonServiceUrl = process.env.MODEL_MS_URL || 'http://127.0.0.1:8000';
    private readonly logsEnabled = process.env.LOGS_ENABLED?.toLowerCase() !== 'false';
    // Asumiendo que api-gateway está en Tincadia-backend/api-gateway
    // y Model-ms está en Tincadia-backend/Model-ms
    private readonly pythonScriptPath = path.resolve(process.cwd(), '..', 'Model-ms');

    // Store Python sockets mapped by Frontend Client ID
    private pythonSessions: Map<string, ClientSocket> = new Map();

    async videoToText(file?: Express.Multer.File, url?: string) {
        if (!file) {
            // Por ahora priorizamos soporte de archivo ya que main.py espera multipart
            throw new BadRequestException('Por favor sube un archivo de video (url support pending)');
        }

        try {
            await this.ensureServiceIsRunning();

            const formData = new FormData();
            // Convertir buffer a Blob para enviarlo vía fetch
            // Casting a 'any' para evitar conflicto de tipos entre Buffer de Node y BlobPart del estándar Web
            const blob = new Blob([file.buffer as any], { type: file.mimetype });
            formData.append('file', blob, file.originalname);

            if (this.logsEnabled) {
                console.log(`[Gateway] Enviando archivo a ${this.pythonServiceUrl}/predict...`);
            }

            const response = await fetch(`${this.pythonServiceUrl}/predict`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('[Gateway] Error:', error);
            throw new BadRequestException(`Error procesando video: ${error.message || error}`);
        }
    }

    async videoToAudio(file?: Express.Multer.File): Promise<any> {
        if (!file) {
            throw new BadRequestException('Por favor sube un archivo de video');
        }

        try {
            await this.ensureServiceIsRunning();

            const formData = new FormData();
            const blob = new Blob([file.buffer as any], { type: file.mimetype });
            formData.append('file', blob, file.originalname);

            if (this.logsEnabled) {
                console.log(`[Gateway] Enviando archivo a ${this.pythonServiceUrl}/predict/audio...`);
            }

            const response = await fetch(`${this.pythonServiceUrl}/predict/audio`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            if (this.logsEnabled) {
                console.error('[Gateway] Audio Error:', error);
            }
            throw new BadRequestException(`Error generando audio: ${error.message || error}`);
        }
    }

    async connectToPython(frontendClient: ServerSocket) {
        await this.ensureServiceIsRunning();

        const clientId = frontendClient.id;
        if (this.pythonSessions.has(clientId)) {
            return;
        }

        if (this.logsEnabled) {
            console.log(`[Gateway] Creating Python session for client ${clientId}`);
        }

        // Connect to Python Socket.IO
        const pythonSocket = io(this.pythonServiceUrl, {
            transports: ['websocket'],
            reconnection: true
        });

        this.pythonSessions.set(clientId, pythonSocket);

        // Forward Python events to Frontend
        pythonSocket.on('connect', () => {
            if (this.logsEnabled) console.log(`[Gateway] Connected to Python for ${clientId}`);
        });

        pythonSocket.on('prediction', (data) => {
            frontendClient.emit('prediction', data);
        });

        pythonSocket.on('reset_ack', (data) => {
            frontendClient.emit('reset_ack', data);
        });

        pythonSocket.on('disconnect', () => {
            if (this.logsEnabled) console.log(`[Gateway] Disconnected from Python for ${clientId}`);
        });

        pythonSocket.on('connect_error', (err) => {
            console.error(`[Gateway] Python Connection Error for ${clientId}:`, err.message);
        });
    }

    disconnectFromPython(clientId: string) {
        const pythonSocket = this.pythonSessions.get(clientId);
        if (pythonSocket) {
            pythonSocket.disconnect();
            this.pythonSessions.delete(clientId);
            if (this.logsEnabled) console.log(`[Gateway] Closed Python session for ${clientId}`);
        }
    }

    sendLandmarks(clientId: string, landmarks: number[]) {
        const pythonSocket = this.pythonSessions.get(clientId);
        if (pythonSocket) {
            pythonSocket.emit('landmarks', { data: landmarks });
        }
    }

    resetSession(clientId: string) {
        const pythonSocket = this.pythonSessions.get(clientId);
        if (pythonSocket) {
            pythonSocket.emit('reset');
        }
    }

    private async ensureServiceIsRunning() {

        if (await this.isServiceReachable()) {
            return;
        }

        if (this.logsEnabled) {
            console.log('[Gateway] El microservicio no responde. Iniciando uvicorn...');
        }

        // Iniciar uvicorn en segundo plano
        // Usamos 'python -m uvicorn' para asegurar que usa el python del entorno
        const child = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: this.pythonScriptPath,
            shell: true,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        // Esperar a que arranque (polling)
        for (let i = 0; i < 20; i++) { // 20 intentos de 1s = 20s timeout
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (await this.isServiceReachable()) {
                if (this.logsEnabled) {
                    console.log('[Gateway] Microservicio iniciado correctamente.');
                }
                return;
            }
        }

        throw new Error('No se pudo iniciar el microservicio de Python después de varios intentos.');
    }

    private async isServiceReachable(): Promise<boolean> {
        try {
            // Usamos un timeout corto para chequear
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            // Hacemos GET /docs o similar para ver si responde, 
            // como main.py no tiene root, probamos /docs que FastAPI genera por defecto
            const response = await fetch(`${this.pythonServiceUrl}/docs`, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok || response.status === 405; // 405 en /predict GET también indicaría vida
        } catch (e) {
            return false;
        }
    }

    async confirmWord(word: string, userId?: string, timestamp?: Date): Promise<any> {
        /**
         * Guarda una palabra confirmada por el usuario.
         * Por ahora usamos un archivo JSON simple. Para producción, se debería migrar a base de datos.
         */
        try {
            const dataDir = path.resolve(process.cwd(), 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir);
            }
            const confirmedWordsPath = path.join(dataDir, 'confirmed_words.json');

            let confirmedWords: Array<{ word: string; userId: string; timestamp: string | Date }> = [];

            // Leer archivo existente si existe
            if (fs.existsSync(confirmedWordsPath)) {
                const content = fs.readFileSync(confirmedWordsPath, 'utf-8');
                confirmedWords = JSON.parse(content);
            }

            // Añadir nueva palabra
            confirmedWords.push({
                word,
                userId: userId || 'anonymous',
                timestamp: timestamp || new Date().toISOString(),
            });

            // Guardar
            fs.writeFileSync(confirmedWordsPath, JSON.stringify(confirmedWords, null, 2));

            if (this.logsEnabled) {
                console.log(`[Gateway] Palabra confirmada: ${word} (Total: ${confirmedWords.length})`);
            }

            return {
                success: true,
                message: 'Word confirmed and saved',
                totalConfirmed: confirmedWords.length,
            };
        } catch (error) {
            console.error('[Gateway] Error saving confirmed word:', error);
            throw new BadRequestException(`Error guardando palabra: ${error.message || error}`);
        }
    }
}
