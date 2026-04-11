import { ContractApiError } from '@portfolio/contracts';

import { createCloudAppApiClient, resolveCloudAppApiUrl } from './core';

export class BrowserApiError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly path: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'BrowserApiError';
  }

  get status(): number {
    return this.statusCode;
  }
}

export type BrowserRequestContext = {
  method: string;
  path: string;
};

export type BrowserHeaderProvider = (
  context: BrowserRequestContext
) => HeadersInit | Promise<HeadersInit>;

export type CloudAppBrowserClientConfig = {
  baseUrl?: string;
  defaultCredentials?: RequestCredentials;
  defaultHeaders?: HeadersInit;
  headerProvider?: BrowserHeaderProvider;
  fetchImpl?: typeof fetch;
};

export type BrowserRequestOptions = {
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
};

const JSON_CONTENT_TYPE = 'application/json';
const DEFAULT_METHOD = 'GET';

const buildUrl = (baseUrl: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

const mergeHeaders = async (
  config: CloudAppBrowserClientConfig,
  context: BrowserRequestContext,
  headers?: HeadersInit
) => {
  const nextHeaders = new Headers(config.defaultHeaders);

  if (config.headerProvider) {
    const providedHeaders = await config.headerProvider(context);
    new Headers(providedHeaders).forEach((value, key) => nextHeaders.set(key, value));
  }

  if (headers) {
    new Headers(headers).forEach((value, key) => nextHeaders.set(key, value));
  }

  return nextHeaders;
};

const toBodyInit = (headers: Headers, body: BrowserRequestOptions['body']) => {
  if (body === undefined) {
    return undefined;
  }
  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE);
  }

  const contentType = headers.get('Content-Type') ?? '';
  if (contentType.includes(JSON_CONTENT_TYPE)) {
    return JSON.stringify(body);
  }

  return body as BodyInit;
};

const readErrorText = async (response: Response) => response.text().catch(() => '');

export const createCloudAppBrowserClient = (config: CloudAppBrowserClientConfig = {}) => {
  const baseUrl = resolveCloudAppApiUrl(config.baseUrl);
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const request = async <T>(
    method: string,
    path: string,
    options: BrowserRequestOptions = {},
    responseType: 'json' | 'text' | 'blob' | 'void' = 'json'
  ): Promise<T> => {
    const context = { method, path };
    const headers = await mergeHeaders(config, context, options.headers);
    const response = await fetchImpl(buildUrl(baseUrl, path), {
      method,
      headers,
      body: toBodyInit(headers, options.body),
      credentials: options.credentials ?? config.defaultCredentials ?? 'include',
      signal: options.signal,
    });

    if (!response.ok) {
      const responseBody = await readErrorText(response);
      throw new BrowserApiError(
        `Browser request failed (${method} ${path}): ${response.status} ${responseBody}`,
        method,
        path,
        response.status,
        responseBody
      );
    }

    if (responseType === 'void' || response.status === 204) {
      return undefined as T;
    }
    if (responseType === 'blob') {
      return (await response.blob()) as T;
    }
    if (responseType === 'text') {
      return (await response.text()) as T;
    }

    const text = await response.text().catch(() => '');
    return text ? (JSON.parse(text) as T) : (undefined as T);
  };

  return {
    contract: createCloudAppApiClient({
      baseUrl,
      fetchImpl,
      defaultHeaders: config.defaultHeaders,
      defaultCredentials: config.defaultCredentials ?? 'include',
    }),
    requestJson: <T>(
      path: string,
      options: BrowserRequestOptions & { method?: string } = {}
    ) => request<T>(options.method ?? DEFAULT_METHOD, path, options, 'json'),
    requestText: (
      path: string,
      options: BrowserRequestOptions & { method?: string } = {}
    ) => request<string>(options.method ?? DEFAULT_METHOD, path, options, 'text'),
    requestBlob: (
      path: string,
      options: BrowserRequestOptions & { method?: string } = {}
    ) => request<Blob>(options.method ?? DEFAULT_METHOD, path, options, 'blob'),
    requestVoid: (
      path: string,
      options: BrowserRequestOptions & { method?: string } = {}
    ) => request<void>(options.method ?? DEFAULT_METHOD, path, options, 'void'),
  };
};

export const isExpectedBrowserApiError = (
  error: unknown,
  statuses: number[] = [401, 403]
) => {
  if (error instanceof ContractApiError) {
    return statuses.includes(error.statusCode);
  }
  if (error instanceof BrowserApiError) {
    return statuses.includes(error.statusCode);
  }
  return false;
};
