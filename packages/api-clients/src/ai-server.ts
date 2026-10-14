const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Request-ID';
const DEFAULT_PREFLIGHT_MAX_AGE = '600';

const parseAllowedOrigins = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const appendVaryHeader = (headers: Headers, value: string) => {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', value);
    return;
  }

  const values = existing
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    headers.set('Vary', `${existing}, ${value}`);
  }
};

export const getOllamaBaseUrl = () => {
  const ollamaRoot = process.env.OLLAMA_URL || 'http://localhost:11434';
  return `${ollamaRoot.replace(/\/+$/, '')}/api`;
};

export const isAllowedOrigin = (req: Request, origin: string) => {
  const requestOrigin = new URL(req.url).origin;
  if (origin === requestOrigin) {
    return true;
  }

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  return allowedOrigins.includes(origin);
};

export const buildCorsHeaders = (
  req: Request,
  methods: string,
  extraHeaders?: HeadersInit,
) => {
  const headers = new Headers(extraHeaders);
  appendVaryHeader(headers, 'Origin');

  const origin = req.headers.get('origin');
  if (!origin || !isAllowedOrigin(req, origin)) {
    return headers;
  }

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', methods);
  headers.set(
    'Access-Control-Allow-Headers',
    req.headers.get('access-control-request-headers') || DEFAULT_ALLOWED_HEADERS,
  );
  headers.set('Access-Control-Max-Age', DEFAULT_PREFLIGHT_MAX_AGE);
  appendVaryHeader(headers, 'Access-Control-Request-Headers');
  return headers;
};

export const jsonResponse = (
  req: Request,
  methods: string,
  body: unknown,
  init: ResponseInit = {},
) => {
  const headers = buildCorsHeaders(req, methods, {
    'Content-Type': 'application/json',
    ...init.headers,
  });

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

export const preflightResponse = (req: Request, methods: string) => {
  const origin = req.headers.get('origin');
  if (origin && !isAllowedOrigin(req, origin)) {
    return jsonResponse(
      req,
      methods,
      { error: 'origin_not_allowed' },
      { status: 403 },
    );
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(req, methods),
  });
};

export const getMessageMetrics = (messages: any[] = []) => {
  let promptCharacters = 0;

  for (const message of messages) {
    if (Array.isArray(message?.parts)) {
      promptCharacters += message.parts
        .filter((part: any) => part?.type === 'text')
        .reduce((total: number, part: any) => total + String(part?.text || '').length, 0);
      continue;
    }

    promptCharacters += String(message?.content || '').length;
  }

  return {
    messageCount: messages.length,
    promptCharacters,
  };
};

export const authorizeAiRequest = async (req: Request, methods: string, admin = false): Promise<Response | null> => {
  if (req.method === 'OPTIONS') return preflightResponse(req, methods);
  const origin = req.headers.get('origin');
  if (origin && !isAllowedOrigin(req, origin)) return jsonResponse(req, methods, { error: 'origin_not_allowed' }, { status: 403 });
  const headers = new Headers();
  for (const name of ['Authorization', 'Cookie']) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('Authorization') && !headers.has('Cookie')) return jsonResponse(req, methods, { error: 'authentication_required' }, { status: 401 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const base = (process.env.CLOUDAPP_URL || 'http://cloudapp:8099/cloudapp').replace(/\/+$/, '');
    const response = await fetch(`${base}/user/${admin ? 'admin/' : ''}auth-check`, {
      headers, redirect: 'manual', cache: 'no-store', signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return jsonResponse(req, methods, { error: 'access_denied' }, { status: response.status });
    if (response.status !== 200) return jsonResponse(req, methods, { error: 'identity_unavailable' }, { status: 503 });
    const identity = await response.json();
    if (typeof identity?.username !== 'string' || !identity.username.trim()) return jsonResponse(req, methods, { error: 'identity_unavailable' }, { status: 503 });
    if (admin && (!Array.isArray(identity.roles) || !identity.roles.includes('ROLE_ADMIN'))) return jsonResponse(req, methods, { error: 'administrator_required' }, { status: 403 });
    return null;
  } catch {
    return jsonResponse(req, methods, { error: 'identity_unavailable' }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
};

export const readChatBody = async (req: Request): Promise<any> => {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('invalid_request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let deadline: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => { reject(new Error('request_timeout')); void reader.cancel().catch(() => undefined); }, 5000);
  });
  try {
    while (true) {
      const item = await Promise.race([reader.read(), timeout]);
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new Error('request_too_large'); }
      chunks.push(item.value);
    }
  } finally { clearTimeout(deadline!); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof body.model !== 'string' || !/^[\w][\w./:-]{0,127}$/.test(body.model)
      || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 64
      || body.messages.some((message: any) => !['user', 'assistant', 'system'].includes(message?.role))) throw new Error('invalid_request');
  return body;
};

export const fetchOllama = async (path: string, init: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`${getOllamaBaseUrl()}${path}`, { ...init, signal: controller.signal });
    // Consume finite probe/catalog responses before releasing the deadline.
    const text = await response.text();
    return new Response(text, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } });
  } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
};

export const createModelsHandler = (admin = false) => async (req: Request) => {
  const methods = 'GET, OPTIONS';
  const denied = await authorizeAiRequest(req, methods, admin);
  if (denied) return denied;
  if (req.method !== 'GET') return jsonResponse(req, methods, { error: 'method_not_allowed' }, { status: 405 });
  try {
    const response = await fetchOllama('/tags', { signal: req.signal });
    if (!response.ok) throw new Error('provider_unavailable');
    const data = await response.json();
    if (!Array.isArray(data.models)) throw new Error('provider_unavailable');
    return jsonResponse(req, methods, { models: data.models });
  } catch { return jsonResponse(req, methods, { error: 'connection_failed', models: [] }, { status: 503 }); }
};

export interface ChatRuntime {
  model: (name: string) => any;
  convertMessages: (messages: any) => any;
  streamText: (options: any) => any;
  createStream: (options: any) => ReadableStream;
  sseTransform: () => TransformStream;
}

export const createChatHandler = (sdk: ChatRuntime, admin = false) => {
  const thinkingCache = new Map<string, boolean>();
  return async (req: Request) => {
    const methods = 'POST, OPTIONS';
    const denied = await authorizeAiRequest(req, methods, admin);
    if (denied) return denied;
    if (req.method !== 'POST') return jsonResponse(req, methods, { error: 'method_not_allowed' }, { status: 405 });
    let body;
    try { body = await readChatBody(req); } catch (error) {
      const large = error instanceof Error && error.message === 'request_too_large';
      const timedOut = error instanceof Error && error.message === 'request_timeout';
      return jsonResponse(req, methods, { error: large ? 'request_too_large' : timedOut ? 'request_timeout' : 'invalid_request' }, { status: large ? 413 : timedOut ? 408 : 400 });
    }
    const { model, messages } = body;
    try {
      const catalog = await fetchOllama('/tags', { signal: req.signal });
      const data = await catalog.json();
      if (!catalog.ok || !Array.isArray(data.models)) throw new Error('unavailable');
      if (!data.models.some((item: any) => item.name === model && !item.name.toLowerCase().includes('embed'))) return jsonResponse(req, methods, { error: 'model_not_available' }, { status: 400 });
    } catch { return jsonResponse(req, methods, { error: 'connection_failed' }, { status: 503 }); }
    let canThink = thinkingCache.get(model) ?? false;
    if (!thinkingCache.has(model)) {
      try {
        const probe = await fetchOllama('/chat', { method: 'POST', signal: req.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: '.' }], think: true, stream: false, options: { num_predict: 1 } }) });
        if (probe.ok || probe.status === 400) {
          canThink = probe.ok;
          if (thinkingCache.size >= 256) { const first = thinkingCache.keys().next().value; if (first) thinkingCache.delete(first); }
          thinkingCache.set(model, canThink);
        }
      } catch { /* A failed probe does not enable or cache reasoning support. */ }
    }
    let modelMessages;
    try { modelMessages = await sdk.convertMessages(messages); }
    catch { return jsonResponse(req, methods, { error: 'invalid_request' }, { status: 400 }); }
    const suppliedId = req.headers.get('x-request-id') || '';
    const requestId = /^[\w.:-]{1,80}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
    const controller = new AbortController();
    if (req.signal.aborted) return jsonResponse(req, methods, { error: 'request_cancelled' }, { status: 408 });
    const timer = setTimeout(() => controller.abort(), 120000);
    const abort = () => { controller.abort(); clearTimeout(timer); };
    req.signal.addEventListener('abort', abort, { once: true });
    const metrics = getMessageMetrics(messages);
    console.info(`[ai-remote] request_id=${requestId} model=${model} message_count=${metrics.messageCount} prompt_characters=${metrics.promptCharacters}`);
    const stream = sdk.createStream({ execute: async ({ writer }: any) => {
      const result = sdk.streamText({ model: sdk.model(model), messages: modelMessages, abortSignal: controller.signal,
        ...(canThink && { providerOptions: { ollama: { think: true } } }),
        onFinish: () => { clearTimeout(timer); req.signal.removeEventListener('abort', abort); },
        onError: () => { abort(); req.signal.removeEventListener('abort', abort); },
      });
      result.consumeStream();
      writer.merge(result.toUIMessageStream(canThink ? { sendReasoning: true } : {}));
    }, onError: () => { abort(); console.error(`[ai-remote] request_id=${requestId} stream_error`); return 'AI service unavailable'; } });
    const reader = stream.pipeThrough(sdk.sseTransform()).getReader();
    const finish = () => { clearTimeout(timer); req.signal.removeEventListener('abort', abort); };
    const wire = new ReadableStream({
      async pull(output) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { finish(); output.close(); } else output.enqueue(chunk.value);
        } catch { abort(); finish(); output.error(new Error('AI stream unavailable')); }
      },
      async cancel(reason) { abort(); finish(); await reader.cancel(reason); },
    });
    return new Response(wire, { headers: buildCorsHeaders(req, methods, {
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Request-ID': requestId,
    }) });
  };
};
