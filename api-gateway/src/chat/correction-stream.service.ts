import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Streaming text correction for the SSE endpoint, backed by any
 * OpenAI-compatible chat-completions API.
 *
 * Mirrors chat-ms' CorrectionService so both the streaming and non-streaming
 * paths use the same provider, model and prompt. The provider is env-driven
 * (AI_BASE_URL / AI_API_KEY / AI_MODEL), defaulting to NVIDIA NIM.
 */

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'minimaxai/minimax-m3';
const DEFAULT_TIMEOUT_MS = 20_000;

interface ChatCompletionChunk {
    // reasoning_content carries chain of thought on reasoning models (MiniMax M3
    // among them) and is deliberately ignored: only content reaches the user.
    choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

/**
 * Stateful <think> filter for streamed output.
 *
 * A per-chunk regex is not enough: the tags can be split across SSE frames
 * ("<thi" + "nk>"), so any partial tag is held back until the next chunk
 * decides whether it really is one.
 */
class ThinkingFilter {
    private buffer = '';
    private inThinking = false;

    push(delta: string): string {
        this.buffer += delta;
        let output = '';

        while (this.buffer.length > 0) {
            if (this.inThinking) {
                const closeIndex = this.buffer.toLowerCase().indexOf(THINK_CLOSE);
                if (closeIndex === -1) {
                    this.buffer = this.buffer.slice(-THINK_CLOSE.length);
                    break;
                }
                this.buffer = this.buffer.slice(closeIndex + THINK_CLOSE.length);
                this.inThinking = false;
                continue;
            }

            const openIndex = this.buffer.toLowerCase().indexOf(THINK_OPEN);
            if (openIndex !== -1) {
                output += this.buffer.slice(0, openIndex);
                this.buffer = this.buffer.slice(openIndex + THINK_OPEN.length);
                this.inThinking = true;
                continue;
            }

            const safeLength = Math.max(0, this.buffer.length - (THINK_OPEN.length - 1));
            const candidateTail = this.buffer.slice(safeLength);
            if (THINK_OPEN.startsWith(candidateTail.toLowerCase()) && candidateTail.startsWith('<')) {
                output += this.buffer.slice(0, safeLength);
                this.buffer = candidateTail;
            } else {
                output += this.buffer;
                this.buffer = '';
            }
            break;
        }

        return output;
    }

    flush(): string {
        if (this.inThinking) return '';
        const rest = this.buffer;
        this.buffer = '';
        return rest;
    }
}

@Injectable()
export class CorrectionStreamService {
    private readonly logger = new Logger(CorrectionStreamService.name);
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly model: string;
    private readonly temperature: number;
    private readonly maxTokens: number;
    private readonly timeoutMs: number;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl = (this.configService.get<string>('AI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.apiKey =
            this.configService.get<string>('AI_API_KEY') ||
            this.configService.get<string>('NVIDIA_API_KEY');
        this.model = this.configService.get<string>('AI_MODEL') || DEFAULT_MODEL;
        this.temperature = this.readNumber('AI_TEMPERATURE', 0.3);
        this.maxTokens = this.readNumber('AI_MAX_TOKENS', 1024);
        this.timeoutMs = this.readNumber('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

        if (!this.apiKey) {
            this.logger.warn(
                'AI_API_KEY (or NVIDIA_API_KEY) is not set; streaming text correction is disabled.',
            );
        }
    }

    get isConfigured(): boolean {
        return Boolean(this.apiKey);
    }

    private readNumber(key: string, fallback: number): number {
        const raw = this.configService.get<string>(key);
        if (raw == null || String(raw).trim() === '') return fallback;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private getPrompt(text: string): string {
        return `Eres un intérprete experto capaz de dar coherencia a mensajes escritos en español por personas cuya lengua nativa es la Lengua de Señas.
Tu tarea es transformar el texto original en una frase fluida y natural, pero manteniendo una fidelidad ESTRICTA al significado original.

INSTRUCCIÓN DE EQUILIBRIO:
1. COHERENCIA: Si faltan conectores o el orden es caótico, arréglalo para que sea legible.
2. FIDELIDAD: No añadas ideas, adjetivos o acciones que no estén presentes en el mensaje original. Tu interpretación debe limitarse a lo que el usuario realmente quiso expresar, sin inventar contexto extra.

Instrucciones:
- Devuelve exclusivamente el texto corregido, sin comillas alrededor.
- No añadas explicaciones, prefijos ni comentarios: solo la frase corregida.
- Si el mensaje es incomprensible, intenta la reconstrucción más simple y directa posible.
- Mantén el tono y la intención del usuario original.

Texto original: "${text}"`;
    }

    /** Yields text deltas as the model produces them. */
    async *streamCorrection(text: string): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) return;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: this.getPrompt(text) }],
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                    stream: true,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`${response.status} ${response.statusText} ${detail}`.trim());
            }
            if (!response.body) throw new Error('Empty response body');

            const decoder = new TextDecoder();
            // SSE frames can split across chunks; keep the tail until a newline.
            let buffer = '';
            const thinking = new ThinkingFilter();

            for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;

                    const payload = trimmed.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(payload) as ChatCompletionChunk;
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (!delta) continue;

                        const visible = thinking.push(delta);
                        if (visible) yield visible;
                    } catch {
                        // Ignore keep-alive comments and partial frames.
                    }
                }
            }

            const tail = thinking.flush();
            if (tail) yield tail;
        } finally {
            clearTimeout(timer);
        }
    }
}
