export type AiRemoteErrorCode =
  | 'connection_failed'
  | 'timeout'
  | 'no_models'
  | 'unknown'
  | string;

export class AiRemoteApiError extends Error {
  constructor(
    message: string,
    public readonly code: AiRemoteErrorCode,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AiRemoteApiError';
  }
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export type FetchAiModelsOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 5000;

const normalizeErrorCode = (value: unknown): AiRemoteErrorCode => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return 'connection_failed';
};

export const normalizeRemoteBaseUrl = (value?: string) => (value ? value.replace(/\/+$/, '') : '');

export const buildRemoteApiUrl = (baseUrl: string | undefined, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeRemoteBaseUrl(baseUrl)}${normalizedPath}`;
};

export const formatOllamaModelSize = (bytes: number): string => {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
};

export const filterChatCapableModels = (models: OllamaModel[]) =>
  models.filter((model) => !model.name.toLowerCase().includes('embed'));

const readJsonSafely = async (response: Response) => response.json().catch(() => ({}));

export const fetchAiModels = async (
  modelsApiUrl: string,
  options: FetchAiModelsOptions = {},
): Promise<OllamaModel[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  try {
    const response = await fetchImpl(modelsApiUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    const data = await readJsonSafely(response);

    if (!response.ok) {
      const errorCode = normalizeErrorCode(data?.error);
      throw new AiRemoteApiError(errorCode, errorCode, response.status);
    }

    const models = Array.isArray(data?.models) ? data.models : [];
    return filterChatCapableModels(models);
  } catch (error: any) {
    if (error instanceof AiRemoteApiError) {
      throw error;
    }

    const errorCode =
      error?.name === 'AbortError' || error?.message?.includes('timeout')
        ? 'timeout'
        : 'connection_failed';

    throw new AiRemoteApiError(errorCode, errorCode);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const assertAiModelServiceHealthy = async (
  modelsApiUrl: string,
  options: FetchAiModelsOptions = {},
) => {
  const models = await fetchAiModels(modelsApiUrl, options);
  if (models.length === 0) {
    throw new AiRemoteApiError('no_models', 'no_models');
  }
  return models;
};

export const getAiRemoteErrorCode = (error: unknown): AiRemoteErrorCode => {
  if (error instanceof AiRemoteApiError) {
    return error.code;
  }
  return 'unknown';
};
