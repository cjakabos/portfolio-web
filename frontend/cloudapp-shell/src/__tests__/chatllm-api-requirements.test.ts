/** @jest-environment node */
import POST from "../../../remote/chatllm/pages/api/chat";

const mockOllama = jest.fn((model: string) => ({ model }));
const mockStreamText = jest.fn();
const mockConvert = jest.fn(async (messages: any) => messages);
jest.mock("ollama-ai-provider-v2", () => ({ createOllama: () => (model: string) => mockOllama(model) }));
jest.mock("ai", () => ({
  convertToModelMessages: (messages: any) => mockConvert(messages),
  streamText: (options: any) => mockStreamText(options),
  createUIMessageStream: ({ execute }: any) => new ReadableStream({
    async start(controller) {
      await execute({ writer: { merge: async (stream: ReadableStream) => {
        const reader = stream.getReader();
        while (true) { const item = await reader.read(); if (item.done) break; controller.enqueue(item.value); }
        controller.close();
      } } });
    },
  }),
  JsonToSseTransformStream: class extends TransformStream {
    constructor() { super({ transform: (chunk, controller) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)) }); }
  },
}));

const request = (model: string) => new Request("http://test/api/chat", { method: "POST",
  body: JSON.stringify({ model, messages: [{ role: "user", content: "hello" }] }) });

beforeEach(() => {
  mockStreamText.mockImplementation(() => ({ consumeStream: jest.fn(), toUIMessageStream: jest.fn(() =>
    new ReadableStream({ start(c) { c.enqueue({ type: "text-delta", delta: "first" }); c.enqueue({ type: "text-delta", delta: "second" }); c.close(); } }),
  ) }));
});

test("Chat adapter streams successive answer chunks from the selected model", async () => {
  global.fetch = jest.fn(async () => new Response("{}", { status: 200 })) as any;
  const response = await POST(request("stream-model"));
  const reader = response.body!.getReader();
  const first = await reader.read();
  const second = await reader.read();
  expect(new TextDecoder().decode(first.value)).toContain("first");
  expect(new TextDecoder().decode(second.value)).toContain("second");
  expect((await reader.read()).done).toBe(true);
  expect(mockStreamText).toHaveBeenCalledWith(expect.objectContaining({ model: { model: "stream-model" }, messages: [{ role: "user", content: "hello" }] }));
});

test("Chat adapter enables reasoning only after a successful support probe", async () => {
  const fetchMock = jest.fn(async () => new Response("{}", { status: 200 }));
  global.fetch = fetchMock as any;
  await (await POST(request("thinking-model"))).text();
  expect(mockStreamText.mock.calls[0][0].providerOptions).toEqual({ ollama: { think: true } });
  const result = mockStreamText.mock.results[0].value;
  expect(result.toUIMessageStream).toHaveBeenCalledWith({ sendReasoning: true });
  await (await POST(request("thinking-model"))).text();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  global.fetch = jest.fn(async () => new Response("unsupported", { status: 400 })) as any;
  await (await POST(request("no-thinking-model"))).text();
  expect(mockStreamText.mock.calls.at(-1)?.[0].providerOptions).toBeUndefined();
  expect(mockStreamText.mock.results.at(-1)?.value.toUIMessageStream).toHaveBeenCalledWith({});
});

test("Failed reasoning probes do not enable reasoning or poison the support cache", async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(new Response("down", { status: 503 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  global.fetch = fetchMock;
  await (await POST(request("retry-thinking-model"))).text();
  expect(mockStreamText.mock.calls[0][0].providerOptions).toBeUndefined();
  await (await POST(request("retry-thinking-model"))).text();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(mockStreamText.mock.calls.at(-1)?.[0].providerOptions).toEqual({ ollama: { think: true } });
});
