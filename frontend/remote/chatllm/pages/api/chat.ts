// app/api/chat/route.ts
import { createOllama } from "ollama-ai-provider-v2";
import { streamText, convertToModelMessages, createUIMessageStream, JsonToSseTransformStream } from "ai";

const OLLAMA_ROOT =
  process.env.OLLAMA_URL || "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":11434";
const OLLAMA_BASE = `${OLLAMA_ROOT.replace(/\/+$/, "")}/api`;

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
    //  CORS for shell use
    if (req.method === 'OPTIONS') {
        const headers = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return new Response(null, { headers });
    }
    const body = await req.json();
    const { messages, model } = body;
    const canThink = await supportsThinking(model);

    console.log('Received model:', model);
    console.log('Received messages:', JSON.stringify(messages, null, 2));

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

    console.log('Converted messages:', JSON.stringify(modelMessages, null, 2));

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
            console.error('Stream error:', error);
            return 'Oops, an error occurred!';
        },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}
