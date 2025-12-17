import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class CorrectionService {
    private readonly logger = new Logger(CorrectionService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY is not set in environment variables');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        }
    }

    private getPrompt(text: string): string {
        return `Eres un asistente experto en corrección de textos en español. Tu tarea es corregir la gramática, el sentido de la oración, ortografía y puntuación del siguiente texto, convirtiéndolo en un español claro y legible. El texto original proviene de una persona sorda con estructuras gramaticales no convencionales.
      
Instrucciones:
1. Mantén el sentido original del mensaje.
2. No agregues explicaciones, saludos ni despedidas. Solo devuelve el texto corregido.
3. Si el texto ya es correcto, devuélvelo tal cual.
      
Texto original: "${text}"`;
    }

    async correctText(text: string): Promise<string> {
        if (!this.model) {
            this.logger.error('Gemini model not initialized due to missing API Key');
            return text;
        }

        try {
            const prompt = this.getPrompt(text);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            this.logger.error('Error generating content with Gemini:', error);
            return text;
        }
    }

    /**
     * Stream text correction using Gemini's generateContentStream
     * Yields chunks of text as they are generated
     */
    async *correctTextStream(text: string): AsyncGenerator<string, void, unknown> {
        if (!this.model) {
            this.logger.error('Gemini model not initialized due to missing API Key');
            yield text;
            return;
        }

        try {
            const prompt = this.getPrompt(text);
            const result = await this.model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    yield chunkText;
                }
            }
        } catch (error) {
            this.logger.error('Error streaming content with Gemini:', error);
            yield text;
        }
    }
}
