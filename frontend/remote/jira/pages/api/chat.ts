import { createOllama } from "ollama-ai-provider";
import { streamText } from "ai";

const chat = createOllama({
    baseURL: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":11434/api", //NOTE: Use a different URL prefix for API calls, e.g., to use proxy servers.
});

export const runtime = "edge";

export default async function POST(req: Request) {
    //  CORS
    if (req.method === 'OPTIONS') {
        const headers = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return new Response(null, { headers });
    }
    const { messages } = await req.json();
    console.log(messages);

    const result = await streamText({
        model: chat("deepseek-r1:1.5b"),
        messages,
    });

    return result.toDataStreamResponse();
}
