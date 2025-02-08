import { createOllama } from "ollama-ai-provider";
import { streamText, StreamData } from "ai";

const chat = createOllama({
    baseURL: "http://127.0.0.1:11434/api", //NOTE: Use a different URL prefix for API calls, e.g., to use proxy servers.
});

export const runtime = "edge";

export default async function POST(req: Request) {
    const { messages } = await req.json();
    console.log(messages);

    const result = await streamText({
        model: chat("deepseek-r1:1.5b"),
        messages,
    });

    return result.toDataStreamResponse();
}
