// app/api/chat/route.ts
import { createOllama } from "ollama-ai-provider-v2";
import { streamText, convertToModelMessages, createUIMessageStream, JsonToSseTransformStream } from "ai";

const ollama = createOllama({
    baseURL: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":11434/api",
});

export const runtime = "edge";

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
                providerOptions: {
                    ollama: {
                        think: true
                    }
                }
            });

            result.consumeStream();

            dataStream.merge(
                result.toUIMessageStream({
                    sendReasoning: true,
                }),
            );
        },
        onError: (error) => {
            console.error('Stream error:', error);
            return 'Oops, an error occurred!';
        },
        onFinish: ({ messages, isContinuation, responseMessage }) => {
            console.log('Stream finished with messages:', messages);
        }
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}