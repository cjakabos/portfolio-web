/** @jest-environment node */
import POST from "../../../remote/chatllm/pages/api/chat";

const mockOllama = jest.fn((model: string) => ({ model }));
const mockStreamText = jest.fn();
const mockConvert = jest.fn(async (messages: any) => messages);
jest.mock("ollama-ai-provider-v2", () => ({ createOllama: () => (model: string) => mockOllama(model) }));
jest.mock("ai", () => ({
  convertToModelMessages: (messages: any) => mockConvert(messages),
  streamText: (options: any) => mockStreamText(options),
  createUIMessageStream: ({ execute }: any) => {
    let cancelled = false;
    return new ReadableStream({
      async start(controller) {
        const merges: Promise<void>[] = [];
        await execute({ writer: { merge: (stream: ReadableStream) => merges.push((async () => {
          const reader = stream.getReader();
          while (true) {
            const item = await reader.read();
            if (cancelled || item.done) break;
            controller.enqueue(item.value);
          }
          if (!cancelled) controller.close();
        })()) } });
        await Promise.all(merges);
      },
      cancel() { cancelled = true; },
    });
  },
  JsonToSseTransformStream: class extends TransformStream {
    constructor() { super({ transform: (chunk, controller) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)) }); }
  },
}));

const request = (model: string) => new Request("http://test/api/chat", { method: "POST", headers: { Authorization: "Bearer fixture-user" },
  body: JSON.stringify({ model, messages: [{ role: "user", content: "hello" }] }) });

const transport = (probe: any) => {
  global.fetch = jest.fn(async (url: any, init: any) => {
    if (String(url).endsWith('/auth-check')) return new Response(JSON.stringify({ username: 'fixture-user', roles: ['ROLE_USER'] }), { status: 200 });
    if (String(url).endsWith('/tags')) return new Response(JSON.stringify({ models: ['stream-model', 'thinking-model', 'no-thinking-model', 'retry-thinking-model'].map(name => ({ name })) }), { status: 200 });
    return probe(url, init);
  }) as any;
};

beforeEach(() => {
  mockStreamText.mockImplementation((options: any) => ({ consumeStream: jest.fn(), toUIMessageStream: jest.fn(() =>
    new ReadableStream({ start(c) { c.enqueue({ type: "text-delta", delta: "first" }); c.enqueue({ type: "text-delta", delta: "second" }); c.close(); options.onFinish?.(); } }),
  ) }));
});

test("Chat adapter streams successive answer chunks from the selected model", async () => {
  transport(jest.fn(async () => new Response("{}", { status: 200 })));
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
  transport(fetchMock);
  await (await POST(request("thinking-model"))).text();
  expect(mockStreamText.mock.calls[0][0].providerOptions).toEqual({ ollama: { think: true } });
  const result = mockStreamText.mock.results[0].value;
  expect(result.toUIMessageStream).toHaveBeenCalledWith({ sendReasoning: true });
  await (await POST(request("thinking-model"))).text();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  transport(jest.fn(async () => new Response("unsupported", { status: 400 })));
  await (await POST(request("no-thinking-model"))).text();
  expect(mockStreamText.mock.calls.at(-1)?.[0].providerOptions).toBeUndefined();
  expect(mockStreamText.mock.results.at(-1)?.value.toUIMessageStream).toHaveBeenCalledWith({});
});

test("Failed reasoning probes do not enable reasoning or poison the support cache", async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(new Response("down", { status: 503 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  transport(fetchMock);
  await (await POST(request("retry-thinking-model"))).text();
  expect(mockStreamText.mock.calls[0][0].providerOptions).toBeUndefined();
  await (await POST(request("retry-thinking-model"))).text();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(mockStreamText.mock.calls.at(-1)?.[0].providerOptions).toEqual({ ollama: { think: true } });
});

test("Cancelling the response aborts generation and prompt text is absent from logs", async () => {
  transport(jest.fn(async () => new Response("{}", { status: 200 })));
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const response = await POST(new Request('http://test/api/chat', { method: 'POST',
    headers: { Authorization: 'Bearer fixture-user' },
    body: JSON.stringify({ model: 'stream-model', messages: [{ role: 'user', content: 'private-prompt-fixture' }] }),
  }));
  const signal = mockStreamText.mock.calls[0][0].abortSignal;
  await response.body!.cancel();
  expect(signal.aborted).toBe(true);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private-prompt-fixture');
  log.mockRestore();
});
