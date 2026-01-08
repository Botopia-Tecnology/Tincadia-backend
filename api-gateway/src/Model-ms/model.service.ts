import { Injectable, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ModelService {
    async videoToText(file?: Express.Multer.File, url?: string) {
        if (!file && !url) {
            throw new BadRequestException('Debe enviar un archivo o una URL');
        }

        let videoPath: string;

        if (file) {
            // Guardar archivo temporal
            const tmpPath = path.join(
                process.cwd(),
                'tmp',
                `${Date.now()}-${file.originalname}`,
            );

            fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
            fs.writeFileSync(tmpPath, file.buffer);
            videoPath = tmpPath;
        } else {
            videoPath = url!;
        }

        return this.runPython(videoPath);
    }

    private runPython(input: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(
                process.cwd(),
                '..',
                'Model-ms',
                'run_video_to_text.py',
            );

            const processPy = spawn('python', [scriptPath, input]);

            let output = '';
            let error = '';

            processPy.stdout.on('data', (data) => {
                output += data.toString();
            });

            processPy.stderr.on('data', (data) => {
                error += data.toString();
            });

            processPy.on('close', (code) => {
                if (code !== 0) {
                    return reject(error || 'Error ejecutando modelo');
                }

                try {
                    resolve(JSON.parse(output));
                } catch (e) {
                    reject('Respuesta inválida del modelo');
                }
            });
        });
    }
}
