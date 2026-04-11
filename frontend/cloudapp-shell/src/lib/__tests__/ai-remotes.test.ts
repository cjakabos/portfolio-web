import {
  assertAiModelServiceHealthy,
  buildCorsHeaders,
  buildRemoteApiUrl,
  fetchAiModels,
  preflightResponse,
  type OllamaModel,
} from '@portfolio/api-clients';

const testGlobals = globalThis as typeof globalThis & {
  Headers?: typeof Headers;
  Request?: typeof Request;
  Response?: typeof Response;
};

class TestHeaders {
  private readonly values = new Map<string, string>();

  constructor(init?: Record<string, string> | Array<[string, string]>) {
    if (Array.isArray(init)) {
      for (const [key, value] of init) {
        this.set(key, value);
      }
      return;
    }

    for (const [key, value] of Object.entries(init ?? {})) {
      this.set(key, value);
    }
  }

  append(key: string, value: string) {
    const existing = this.get(key);
    this.set(key, existing ? `${existing}, ${value}` : value);
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }
}

class TestRequest {
  headers: TestHeaders;

  constructor(
    public readonly url: string,
    init?: { headers?: Record<string, string> }
  ) {
    this.headers = new TestHeaders(init?.headers);
  }
}

class TestResponse {
  headers: TestHeaders;
  status: number;
  private readonly bodyText: string;

  constructor(body?: string | null, init?: { status?: number; headers?: Record<string, string> }) {
    this.status = init?.status ?? 200;
    this.headers = new TestHeaders(init?.headers);
    this.bodyText = body ?? '';
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  async json() {
    return this.bodyText ? JSON.parse(this.bodyText) : null;
  }
}

testGlobals.Headers = (testGlobals.Headers || TestHeaders) as typeof Headers;
testGlobals.Request = (testGlobals.Request || TestRequest) as typeof Request;
testGlobals.Response = (testGlobals.Response || TestResponse) as typeof Response;

const Headers = testGlobals.Headers!;
const Request = testGlobals.Request!;
const Response = testGlobals.Response!;

const makeModel = (name: string): OllamaModel => ({
  name,
  model: name,
  modified_at: '2026-01-01T00:00:00Z',
  size: 1_500_000_000,
  digest: `${name}-digest`,
  details: {
    parent_model: '',
    format: 'gguf',
    family: 'qwen',
    families: ['qwen'],
    parameter_size: '1.7B',
    quantization_level: 'Q4_K_M',
  },
});

describe('shared AI remote helpers', () => {
  const originalAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = originalAllowedOrigins;
    jest.restoreAllMocks();
  });

  it('builds remote API URLs with and without an explicit base URL', () => {
    expect(buildRemoteApiUrl(undefined, '/api/chat')).toBe('/api/chat');
    expect(buildRemoteApiUrl('http://localhost:5333/', 'api/models')).toBe('http://localhost:5333/api/models');
  });

  it('filters embedding models when reading the shared model catalog', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(
        JSON.stringify({
          models: [makeModel('qwen3:1.7b'), makeModel('nomic-embed-text')],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const models = await fetchAiModels('http://localhost:5333/api/models', { fetchImpl });

    expect(models.map((model) => model.name)).toEqual(['qwen3:1.7b']);
  });

  it('surfaces empty model catalogs as no_models when checking service health', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(JSON.stringify({ models: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      assertAiModelServiceHealthy('http://localhost:5333/api/models', { fetchImpl })
    ).rejects.toMatchObject({ code: 'no_models' });
  });

  it('surfaces timeout failures distinctly from connection failures', async () => {
    const fetchImpl = jest.fn(async () => {
      const error = new Error('Request timed out');
      (error as Error & { name: string }).name = 'AbortError';
      throw error;
    });

    await expect(fetchAiModels('http://localhost:5333/api/models', { fetchImpl })).rejects.toMatchObject({
      code: 'timeout',
    });
  });

  it('allows configured shell origins and rejects unknown origins for preflight requests', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5001';

    const allowedRequest = new Request('http://localhost:5333/api/chat', {
      headers: {
        Origin: 'http://localhost:5001',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowedHeaders = buildCorsHeaders(allowedRequest, 'POST, OPTIONS');

    expect(allowedHeaders.get('Access-Control-Allow-Origin')).toBe('http://localhost:5001');
    expect(allowedHeaders.get('Access-Control-Allow-Headers')).toBe('content-type');

    const blockedRequest = new Request('http://localhost:5333/api/chat', {
      headers: {
        Origin: 'http://evil.example',
      },
    });
    const response = preflightResponse(blockedRequest, 'POST, OPTIONS');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'origin_not_allowed' });
  });
});
