import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Text correction backed by any OpenAI-compatible chat-completions endpoint.
 *
 * NVIDIA NIM is the default, but the provider is entirely env-driven: pointing
 * AI_BASE_URL/AI_API_KEY/AI_MODEL at another vendor (Gemini's OpenAI-compatible
 * endpoint, Groq, a self-hosted vLLM) switches provider with no code change.
 * That is why this talks raw HTTP instead of a vendor SDK — one wire format
 * covers every provider, streaming included.
 */

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'minimaxai/minimax-m3';
const DEFAULT_TIMEOUT_MS = 20_000;

interface ChatCompletionChoice {
    // Reasoning models (MiniMax M3 among them) may return their chain of thought
    // in a separate reasoning_content field, which must never reach the user.
    message?: { content?: string; reasoning_content?: string };
    delta?: { content?: string; reasoning_content?: string };
    finish_reason?: string | null;
}

/**
 * Strips chain-of-thought that some reasoning models inline into the content as
 * <think>...</think> instead of a separate field. Providers differ here, and a
 * leaked reasoning block would be shown to the user as their corrected message.
 */
function stripThinking(text: string): string {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        // An unclosed <think> means the output was cut mid-reasoning; drop the tail.
        .replace(/<think>[\s\S]*$/i, '')
        // Removing a block mid-sentence can leave doubled whitespace behind.
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * The prompt quotes the original text, and models tend to mirror that by
 * wrapping their answer in the same quotes. Only strip a matching pair that
 * encloses the whole string, so quotes the user actually wrote survive.
 */
function unwrapQuotes(text: string): string {
    const trimmed = text.trim();
    const pairs: Array<[string, string]> = [['"', '"'], ['“', '”'], ["'", "'"], ['«', '»']];

    for (const [open, close] of pairs) {
        if (trimmed.length >= open.length + close.length &&
            trimmed.startsWith(open) &&
            trimmed.endsWith(close)) {
            const inner = trimmed.slice(open.length, trimmed.length - close.length);
            // Bail out if the quotes are not actually wrapping a single span.
            if (!inner.includes(close)) return inner.trim();
        }
    }
    return trimmed;
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

/**
 * Stateful <think> filter for streamed output.
 *
 * A per-chunk regex is not enough: the tags themselves can be split across SSE
 * frames ("<thi" + "nk>"), so any partial tag must be held back until the next
 * chunk decides whether it really is one.
 */
export class ThinkingFilter {
    private buffer = '';
    private inThinking = false;

    push(delta: string): string {
        this.buffer += delta;
        let output = '';

        while (this.buffer.length > 0) {
            if (this.inThinking) {
                const closeIndex = this.buffer.toLowerCase().indexOf(THINK_CLOSE);
                if (closeIndex === -1) {
                    // Keep only what could still be a partial closing tag.
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

            // No tag in sight: emit everything except a possible partial tag tail.
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

    /** Emits whatever is left once the stream ends. */
    flush(): string {
        if (this.inThinking) return '';
        const rest = this.buffer;
        this.buffer = '';
        return rest;
    }
}

interface ChatCompletionResponse {
    choices?: ChatCompletionChoice[];
}

@Injectable()
export class CorrectionService {
    private readonly logger = new Logger(CorrectionService.name);
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly model: string;
    private readonly temperature: number;
    private readonly maxTokens: number;
    private readonly timeoutMs: number;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.normalizeBaseUrl(
            this.configService.get<string>('AI_BASE_URL') || DEFAULT_BASE_URL,
        );
        // NVIDIA_API_KEY is accepted as an alias so the service reads naturally
        // when running against NVIDIA, which is the default provider.
        this.apiKey =
            this.configService.get<string>('AI_API_KEY') ||
            this.configService.get<string>('NVIDIA_API_KEY');
        this.model = this.configService.get<string>('AI_MODEL') || DEFAULT_MODEL;
        this.temperature = this.readNumber('AI_TEMPERATURE', 0.3);
        this.maxTokens = this.readNumber('AI_MAX_TOKENS', 1024);
        this.timeoutMs = this.readNumber('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

        if (!this.apiKey) {
            this.logger.warn(
                'AI_API_KEY (or NVIDIA_API_KEY) is not set; text correction will return the original text unchanged.',
            );
        } else {
            this.logger.log(`Text correction ready: model=${this.model} baseUrl=${this.baseUrl}`);
        }
    }

    private normalizeBaseUrl(url: string): string {
        return url.replace(/\/+$/, '');
    }

    private readNumber(key: string, fallback: number): number {
        const raw = this.configService.get<string>(key);
        if (raw == null || String(raw).trim() === '') return fallback;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            this.logger.warn(`${key} is not a valid number ("${raw}"); using ${fallback}.`);
            return fallback;
        }
        return parsed;
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

    private async requestCompletion(text: string, stream: boolean): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                    Accept: stream ? 'text/event-stream' : 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: this.getPrompt(text) }],
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                    stream,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                throw new Error(`${response.status} ${response.statusText} ${detail}`.trim());
            }

            return response;
        } finally {
            clearTimeout(timer);
        }
    }

    async correctText(text: string): Promise<string> {
        if (!this.apiKey) {
            this.logger.error('Text correction skipped: no API key configured.');
            return text;
        }

        try {
            const response = await this.requestCompletion(text, false);
            const body = (await response.json()) as ChatCompletionResponse;
            const raw = body.choices?.[0]?.message?.content ?? '';
            const corrected = unwrapQuotes(stripThinking(raw));

            if (!corrected) {
                this.logger.warn('Model returned an empty correction; keeping the original text.');
                return text;
            }
            return corrected;
        } catch (error) {
            this.logger.error(`Error correcting text with ${this.model}:`, error);
            return text;
        }
    }

    /**
     * Streams the correction as it is generated, yielding text deltas.
     * Falls back to yielding the original text if the provider fails.
     */
    async *correctTextStream(text: string): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            this.logger.error('Text correction skipped: no API key configured.');
            yield text;
            return;
        }

        try {
            const response = await this.requestCompletion(text, true);
            if (!response.body) {
                yield await this.correctText(text);
                return;
            }

            const decoder = new TextDecoder();
            // SSE frames can split mid-chunk, so hold the tail until a newline.
            let buffer = '';
            let emitted = false;
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
                        const parsed = JSON.parse(payload) as ChatCompletionResponse;
                        // reasoning_content is the model's chain of thought; only
                        // content is meant for the user.
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (!delta) continue;

                        const visible = thinking.push(delta);
                        if (visible) {
                            emitted = true;
                            yield visible;
                        }
                    } catch {
                        // Ignore keep-alive comments and partial frames.
                    }
                }
            }

            const tail = thinking.flush();
            if (tail) {
                emitted = true;
                yield tail;
            }

            // A stream that produced nothing would leave the caller with an empty
            // message, so fall back to the original text rather than silence.
            if (!emitted) {
                this.logger.warn('Stream produced no content; falling back to the original text.');
                yield text;
            }
        } catch (error) {
            this.logger.error(`Error streaming correction with ${this.model}:`, error);
            yield text;
        }
    }
}
