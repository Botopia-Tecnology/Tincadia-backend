import { Injectable, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { Socket as ServerSocket } from 'socket.io'; // Import server socket type for type safety

@Injectable()
export class ModelService {
    private readonly pythonServiceUrl = process.env.MODEL_MS_URL || 'http://127.0.0.1:8000';
    private readonly logsEnabled = process.env.LOGS_ENABLED?.toLowerCase() !== 'false';
    // Asumiendo que api-gateway está en Tincadia-backend/api-gateway
    // y Model-ms está en Tincadia-backend/Model-ms
    private readonly pythonScriptPath = path.resolve(process.cwd(), '..', 'Model-ms', 'app');

    // Store Python sockets mapped by Frontend Client ID
    private pythonSessions: Map<string, ClientSocket> = new Map();

    async videoToText(file?: Express.Multer.File): Promise<any> {
        if (!file) {
            throw new BadRequestException('Por favor sube un archivo de video (url support pending)');
        }

        try {
            await this.ensureServiceIsRunning();

            const formData = new FormData();
            const blob = new Blob([file.buffer as any], { type: file.mimetype });
            formData.append('file', blob, file.originalname);

            if (this.logsEnabled) {
                console.log(`[Gateway] Enviando video completo a ${this.pythonServiceUrl}/predict...`);
            }

            // Enviar video completo al endpoint /predict
            const response = await fetch(`${this.pythonServiceUrl}/predict`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            // Adaptar respuesta para mantener compatibilidad si es necesario
            // El endpoint /predict devuelve { success: true, text: "Letra" }
            return data;

        } catch (error) {
            if (this.logsEnabled) {
                console.error('[Gateway] Error:', error);
            }
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
            if (this.logsEnabled) {
                console.error(`[Gateway] Python Connection Error for ${clientId}:`, err.message);
            }
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

    setContext(clientId: string, context: string | null) {
        const pythonSocket = this.pythonSessions.get(clientId);
        if (pythonSocket) {
            pythonSocket.emit('set_context', { context });
        }
    }

    private async ensureServiceIsRunning() {

        if (await this.isServiceReachable()) {
            return;
        }

        if (this.logsEnabled) {
            console.log(`[Gateway] El microservicio en ${this.pythonServiceUrl} no responde.`);
        }

        // Check if we are in production (remote URL)
        const isLocal = this.pythonServiceUrl.includes('localhost') || this.pythonServiceUrl.includes('127.0.0.1');

        if (!isLocal) {
            // In production/Railway, we cannot spawn python.
            throw new Error(`Cloud Model Service at ${this.pythonServiceUrl} is not reachable. Please ensure the 'Model-ms' service is running and accessible.`);
        }

        if (this.logsEnabled) {
            console.log('[Gateway] Local environment detected. Attempting to spawn uvicorn...');
        }

        // Iniciar uvicorn en segundo plano
        // Usamos 'python -m uvicorn' para asegurar que usa el python del entorno
        const child = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: this.pythonScriptPath,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        // Esperar a que arranque (polling)
        for (let i = 0; i < 20; i++) { // 20 intentos de 1s = 20s timeout
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (await this.isServiceReachable()) {
                if (this.logsEnabled) {
                    console.log('[Gateway] Microservicio local iniciado correctamente.');
                }
                return;
            }
        }

        throw new Error('No se pudo iniciar el microservicio de Python local después de varios intentos.');
    }

    private async isServiceReachable(): Promise<boolean> {
        try {
            // Usamos un timeout corto para chequear
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

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

    private async _saveTempVideo(file: Express.Multer.File): Promise<string> {
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        const tempPath = path.join(tempDir, file.originalname);
        fs.writeFileSync(tempPath, file.buffer);
        return tempPath;
    }

    private async _extractCoordinatesFromVideo(videoPath: string): Promise<number[]> {
        // Crear script temporal en lugar de inline
        const scriptPath = path.join(this.pythonScriptPath, 'extract_coords.py');
        const scriptContent = `import sys
import os
import json
import numpy as np
sys.path.append(r"${this.pythonScriptPath}")
from exacto_predictor_colnumword import ExactoPredictorCOLNUMWORD
import cv2
import mediapipe as mp

def extract_coords():
    predictor = ExactoPredictorCOLNUMWORD(
        r"${this.pythonScriptPath}\\Modelo-COL-NUM-WORD-1101-2-EXPORT\\weights.hdf5",
        r"${this.pythonScriptPath}\\Modelo-COL-NUM-WORD-1101-2-EXPORT\\model_config.json"
    )
    
    # Usar la ruta directamente sin comillas para evitar problemas
    video_path = r"${videoPath}"
    cap = cv2.VideoCapture(video_path)
    
    mp_holistic = mp.solutions.holistic
    holistic = mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    coords_list = []
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = holistic.process(image_rgb)
            
            if results.pose_landmarks or results.right_hand_landmarks or results.left_hand_landmarks:
                coords = predictor._extract_coords(results)
                coords = np.nan_to_num(coords)
                coords_list.extend(coords.tolist())
                break

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cap.release()
    
    print(','.join(map(str, coords_list)))
if __name__ == "__main__":
    extract_coords()
`;

        // Escribir script temporal
        fs.writeFileSync(scriptPath, scriptContent);

        return new Promise((resolve, reject) => {
            const child = spawn('python', [scriptPath], {
                cwd: this.pythonScriptPath,
                stdio: ['pipe', 'pipe']
            });

            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                if (this.logsEnabled) {
                    console.error('Python Error:', data.toString());
                }
            });

            child.on('close', (code) => {
                // Limpiar script temporal
                try {
                    fs.unlinkSync(scriptPath);
                } catch (e) {
                    // Ignorar error de limpieza
                }

                if (code !== 0) {
                    reject(new Error('Error extrayendo coordenadas'));
                } else {
                    const coords = output.trim().split(',').map(Number);
                    resolve(coords);
                }
            });
        });
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
            if (this.logsEnabled) {
                console.error('[Gateway] Error saving confirmed word:', error);
            }
            throw new BadRequestException(`Error guardando palabra: ${error.message || error}`);
        }
    }

    async startTranscription(roomName: string) {
        try {
            await this.ensureServiceIsRunning();

            if (this.logsEnabled) {
                console.log(`[Gateway] Iniciando transcripción para sala: ${roomName}`);
            }

            const response = await fetch(`${this.pythonServiceUrl}/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_name: roomName }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice/transcribe responded with ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[Gateway] Error starting transcription:', error);
            throw new BadRequestException(`Error starting transcription: ${error.message || error}`);
        }
    }

    async stopTranscription(roomName: string) {
        try {
            await this.ensureServiceIsRunning();

            if (this.logsEnabled) {
                console.log(`[Gateway] Deteniendo transcripción para sala: ${roomName}`);
            }

            const response = await fetch(`${this.pythonServiceUrl}/transcribe/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_name: roomName }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice/transcribe/stop responded with ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[Gateway] Error stopping transcription:', error);
            throw new BadRequestException(`Error stopping transcription: ${error.message || error}`);
        }
    }
}
