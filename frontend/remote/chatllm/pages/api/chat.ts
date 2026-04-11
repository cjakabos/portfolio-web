// app/api/chat/route.ts
import { createOllama } from "ollama-ai-provider-v2";
import { streamText, convertToModelMessages, createUIMessageStream, JsonToSseTransformStream } from "ai";
import { buildCorsHeaders, getMessageMetrics, getOllamaBaseUrl, isAllowedOrigin, jsonResponse, preflightResponse } from "../../lib/aiApi";

const OLLAMA_BASE = getOllamaBaseUrl();

const ollama = createOllama({ baseURL: OLLAMA_BASE });

export const runtime = "edge";

const thinkingCache = new Map<string, boolean>();

async function supportsThinking(model: string): Promise<boolean> {
    if (thinkingCache.has(model)) return thinkingCache.get(model)!;

    try {
        const res = await fetch(`${OLLAMA_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "." }],
                think: true,
                stream: false,
                options: { num_predict: 1 },
            }),
        });
        // 400 = "does not support thinking", anything else = it works
        const canThink = res.status !== 400;
        thinkingCache.set(model, canThink);
        return canThink;
    } catch {
        return false;
    }
}

export default async function POST(req: Request) {
    if (req.method === 'OPTIONS') {
        return preflightResponse(req, 'POST, OPTIONS');
    }

    const origin = req.headers.get('origin');
    if (origin && !isAllowedOrigin(req, origin)) {
        return jsonResponse(req, 'POST, OPTIONS', { error: 'origin_not_allowed' }, { status: 403 });
    }

    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
    const startedAt = Date.now();
    const body = await req.json();
    const { messages, model } = body;

    if (!model || !Array.isArray(messages)) {
        return jsonResponse(
            req,
            'POST, OPTIONS',
            { error: 'invalid_request' },
            { status: 400, headers: { 'X-Request-ID': requestId } },
        );
    }

    const { messageCount, promptCharacters } = getMessageMetrics(messages);
    const canThink = await supportsThinking(model);

    console.info(
        `[chatllm/api/chat] request_id=${requestId} model=${model} message_count=${messageCount} prompt_characters=${promptCharacters} thinking_supported=${canThink}`,
    );

    // Convert UI messages (parts format) to model messages (content format)
    // Need to await if it's async, or manually convert
    let modelMessages;
    try {
        modelMessages = await convertToModelMessages(messages);
    } catch (e) {
        // Fallback: manually convert the parts-based format to content format
        modelMessages = messages.map((msg: any) => {
            if (msg.parts) {
                // Extract text from parts
                const textContent = msg.parts
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('\n');
                return {
                    role: msg.role,
                    content: textContent
                };
            }
            return {
                role: msg.role,
                content: msg.content || ''
            };
        });
    }

    const stream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
            const result = streamText({
                model: ollama(model),
                messages: modelMessages,
                ...(canThink && {
                    providerOptions: { ollama: { think: true } }
                })
            });

            result.consumeStream();

            dataStream.merge(
                result.toUIMessageStream({
                    ...(canThink && { sendReasoning: true }),
                }),
            );
        },
        onError: (error) => {
            console.error(
                `[chatllm/api/chat] request_id=${requestId} model=${model} stream_error=${error instanceof Error ? error.message : String(error)}`,
            );
            return 'Oops, an error occurred!';
        },
    });

    console.info(
        `[chatllm/api/chat] request_id=${requestId} model=${model} duration_ms=${Date.now() - startedAt}`,
    );

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
        headers: buildCorsHeaders(req, 'POST, OPTIONS', {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Request-ID': requestId,
        }),
    });
}
