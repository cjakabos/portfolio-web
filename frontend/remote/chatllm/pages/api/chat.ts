import { createChatHandler, getOllamaBaseUrl } from '@portfolio/api-clients/ai-server';
import { createOllama } from 'ollama-ai-provider-v2';
import { streamText, convertToModelMessages, createUIMessageStream, JsonToSseTransformStream } from 'ai';

export const runtime = 'edge';
const ollama = createOllama({ baseURL: getOllamaBaseUrl() });
export default createChatHandler({
  model: (name) => ollama(name), convertMessages: convertToModelMessages,
  streamText, createStream: createUIMessageStream,
  sseTransform: () => new JsonToSseTransformStream(),
}, false);
