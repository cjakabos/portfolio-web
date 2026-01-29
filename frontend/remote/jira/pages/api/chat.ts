'use client';
import { createOllama } from "ollama-ai-provider-v2";
import { streamText, convertToModelMessages, createUIMessageStream, JsonToSseTransformStream} from "ai";

const chat = createOllama({
    baseURL: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":11434/api", //NOTE: Use a different URL prefix for API calls, e.g., to use proxy servers.
});

export const runtime = "edge";

export default async function POST(req: Request) {

    const { messages } = await req.json();

    const stream = createUIMessageStream({
        execute: ({writer: dataStream}) => {
            const result = streamText({
                model: chat(process.env.NEXT_PUBLIC_LLM_MODEL),
                messages: convertToModelMessages(messages),
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
        onError: () => {
            return 'Oops, an error occurred!';
        },
        onFinish: ({ messages, isContinuation, responseMessage }) => {
            console.log('Stream finished with messages:', messages);
        }
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
}
