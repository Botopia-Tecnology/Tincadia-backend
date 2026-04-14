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
        return `Eres un intérprete experto capaz de dar coherencia a mensajes escritos en español por personas cuya lengua nativa es la Lengua de Señas. 
Tu tarea es transformar el texto original en una frase fluida y natural, pero manteniendo una fidelidad ESTRICTA al significado original.

INSTRUCCIÓN DE EQUILIBRIO:
1. COHERENCIA: Si faltan conectores o el orden es caótico, arréglalo para que sea legible.
2. FIDELIDAD: No añadas ideas, adjetivos o acciones que no estén presentes en el mensaje original. Tu interpretación debe limitarse a lo que el usuario realmente quiso expresar, sin inventar contexto extra.

Instrucciones:
- Devuelve exclusivamente el texto corregido.
- Si el mensaje es incomprensible, intenta la reconstrucción más simple y directa posible.
- Mantén el tono y la intención del usuario original.

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
