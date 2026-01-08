import { Injectable, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ModelService {
    private readonly pythonServiceUrl = 'http://127.0.0.1:8000';
    // Asumiendo que api-gateway está en Tincadia-backend/api-gateway
    // y Model-ms está en Tincadia-backend/Model-ms
    private readonly pythonScriptPath = path.resolve(process.cwd(), '..', 'Model-ms');

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

            console.log(`[Gateway] Enviando archivo a ${this.pythonServiceUrl}/predict...`);

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

            console.log(`[Gateway] Enviando archivo a ${this.pythonServiceUrl}/predict/audio...`);

            const response = await fetch(`${this.pythonServiceUrl}/predict/audio`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Microservice responded with ${response.status}: ${errorText}`);
            }

            // Devolvemos el ArrayBuffer (o Stream)
            return await response.arrayBuffer();

        } catch (error) {
            console.error('[Gateway] Audio Error:', error);
            throw new BadRequestException(`Error generando audio: ${error.message || error}`);
        }
    }

    private async ensureServiceIsRunning() {
        if (await this.isServiceReachable()) {
            return;
        }

        console.log('[Gateway] El microservicio no responde. Iniciando uvicorn...');

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
                console.log('[Gateway] Microservicio iniciado correctamente.');
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
}
