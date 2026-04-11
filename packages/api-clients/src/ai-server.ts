const DEFAULT_ALLOWED_HEADERS = 'Content-Type, X-Request-ID';
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
