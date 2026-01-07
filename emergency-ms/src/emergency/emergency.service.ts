import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import * as path from 'path';
import * as fs from 'fs';
import * as wav from 'wav';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class EmergencyService {
    private readonly logger = new Logger(EmergencyService.name);
    private readonly outputDir = path.resolve(__dirname, '../../output');
    private genAI: GoogleGenAI;

    // ==================== CONFIGURATION KEYS ====================
    private readonly CONFIG_KEYS = {
        GEMINI_API_KEY: 'GEMINI_API_KEY',
        CLOUDINARY_CLOUD_NAME: 'CLOUDINARY_CLOUD_NAME',
        CLOUDINARY_API_KEY: 'CLOUDINARY_API_KEY',
        CLOUDINARY_API_SECRET: 'CLOUDINARY_API_SECRET',
    };
    // ==============================================================

    constructor(private configService: ConfigService) {
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Load configuration
        const geminiApiKey = this.configService.get<string>(this.CONFIG_KEYS.GEMINI_API_KEY);
        const cloudName = this.configService.get<string>(this.CONFIG_KEYS.CLOUDINARY_CLOUD_NAME);
        const cloudApiKey = this.configService.get<string>(this.CONFIG_KEYS.CLOUDINARY_API_KEY);
        const cloudApiSecret = this.configService.get<string>(this.CONFIG_KEYS.CLOUDINARY_API_SECRET);

        // Initialize Gemini API
        if (!geminiApiKey) {
            this.logger.error(`${this.CONFIG_KEYS.GEMINI_API_KEY} not found in environment variables`);
        } else {
            const maskedKey = geminiApiKey.substring(0, 4) + '...' + geminiApiKey.substring(geminiApiKey.length - 4);
            this.logger.debug(`Initializing Gemini API with key: ${maskedKey}`);
            this.genAI = new GoogleGenAI({ apiKey: geminiApiKey });
        }

        // Initialize Cloudinary
        if (cloudName && cloudApiKey && cloudApiSecret) {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: cloudApiKey,
                api_secret: cloudApiSecret,
            });
            this.logger.log('Cloudinary initialized successfully.');
        } else {
            this.logger.warn('Cloudinary credentials missing. Audio will not be uploaded.');
        }
    }

    private async saveWaveFile(filename: string, pcmData: Buffer, channels: number = 1, rate: number = 24000, sampleWidth: number = 2): Promise<void> {
        return new Promise((resolve, reject) => {
            const writer = new wav.FileWriter(filename, {
                channels,
                sampleRate: rate,
                bitDepth: sampleWidth * 8,
            });

            writer.on('finish', () => resolve());
            writer.on('error', (err) => reject(err));

            writer.write(pcmData);
            writer.end();
        });
    }

    private async uploadToCloudinary(filePath: string, filename: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.logger.log(`Uploading ${filename} to Cloudinary...`);
            cloudinary.uploader.upload(
                filePath,
                {
                    resource_type: 'video', // 'video' is often used for audio in Cloudinary to allow playback controls/handling
                    folder: 'tincadia/emergency-audio',
                    public_id: filename.replace('.wav', ''),
                    timeout: 60000
                },
                (error, result) => {
                    if (error) {
                        this.logger.error('Cloudinary upload failed:', error);
                        reject(error);
                    } else {
                        this.logger.log(`Cloudinary upload success: ${result?.secure_url}`);
                        resolve(result!.secure_url);
                    }
                }
            );
        });
    }

    async generateAudio(emergencyType: string, location: string, language: string = 'es'): Promise<{ url: string; path: string }> {
        this.logger.log(`Generated audio request for type: "${emergencyType}" at "${location}"`);

        try {
            if (!this.genAI) {
                this.logger.error('Gemini API client is not initialized.');
                throw new Error('Gemini API client not initialized. Check API Key.');
            }

            // Construct the emergency message
            const textToSpeak = `
                ¡Emergencia! Soy una persona sorda. 
                Ayuda urgente: ${emergencyType}. 
                Ubicación: ${location}. 
                Repito: ${location}.
            `.trim();

            this.logger.log(`Preparing to call Gemini TTS (gemini-2.5-flash-preview-tts) with text length: ${textToSpeak.length}`);

            // Use Gemini 2.5 Flash Preview TTS as requested
            const response = await this.genAI.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: textToSpeak }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            this.logger.log('Gemini API response received.');

            const candidate = response.candidates?.[0];
            if (!candidate) {
                this.logger.error('No candidates returned in API response.');
                throw new Error('No candidates returned from Gemini TTS.');
            }

            const part = candidate.content?.parts?.[0];
            if (!part?.inlineData?.data) {
                this.logger.error('No inlineData.data found in the first candidate part.');
                this.logger.debug(`Part content keys: ${part ? Object.keys(part) : 'undefined'}`);
                throw new Error('No audio data returned from Gemini TTS.');
            }

            const data = part.inlineData.data;
            this.logger.log(`Audio data extracted. Size: ${data.length} characters (base64).`);

            const audioBuffer = Buffer.from(data, 'base64');
            const filename = `emergency_${Date.now()}.wav`;
            const outputPath = path.join(this.outputDir, filename);

            this.logger.log(`Saving audio WAV to: ${outputPath}`);

            // Save to WAV file
            await this.saveWaveFile(outputPath, audioBuffer);
            this.logger.log(`Audio successfully saved locally.`);

            // Upload to Cloudinary
            let cloudUrl = '';
            try {
                cloudUrl = await this.uploadToCloudinary(outputPath, filename);
            } catch (uploadError) {
                this.logger.error('Failed to upload to Cloudinary, returning local path only logic.', uploadError);
                // We might still want to return success if local file exists, but user requested upload.
                // For now, let's allow it to partially fail but logged.
            }

            return {
                url: cloudUrl || `/emergency-audio/${filename}`, // Return Cloudinary URL if success, else local path (which might not work if not served statically)
                path: outputPath,
            };

        } catch (error) {
            this.logger.error('Error in generateAudio:', error);
            if (error instanceof Error) {
                this.logger.error(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }
}
