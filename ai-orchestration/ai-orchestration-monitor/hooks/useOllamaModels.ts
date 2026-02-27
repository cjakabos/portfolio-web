// ============================================================================
// File: frontend-ai/src/hooks/useOllamaModels.ts
// Hook for fetching and managing Ollama model selection
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface OllamaModel {
  name: string;
  model: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: Record<string, unknown>;
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
  total: number;
  ollama_url: string;
  connected: boolean;
  error?: string | null;
}

export interface CurrentModelSettings {
  chat_model: string;
  rag_model: string;
  embedding_model: string;
  ollama_url: string;
}

export interface SetModelResponse {
  success: boolean;
  chat_model: string;
  rag_model: string;
  embedding_model: string;
  message: string;
}

export type ModelTarget = 'chat' | 'rag' | 'embedding' | 'both';

// ============================================================================
// API CONFIGURATION
// ============================================================================

const getApiBaseUrl = (): string => {
  // Check for environment variable first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BASE_URL) {
    return import.meta.env.VITE_AI_BASE_URL;
  }
  // Default to localhost for development
  return 'http://localhost:8700';
};

const CLOUDAPP_TOKEN_STORAGE_KEY = 'AI_MONITOR_CLOUDAPP_TOKEN';
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
// Ollama can be up while the orchestration layer still reports it as disconnected
// during app startup. Retry a couple of times on the initial mount to avoid a
// false "offline" state that only resolves after manual refresh.
const OLLAMA_BOOTSTRAP_RETRY_DELAYS_MS = [500, 1500];

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const getRetryDelayMs = (attempt: number, retryAfterHeader?: string | null): number => {
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }
  return Math.min(300 * (2 ** attempt), 3000);
};

// ============================================================================
// HOOK: useOllamaModels
// ============================================================================

export interface UseOllamaModelsOptions {
  autoFetch?: boolean;
  pollInterval?: number; // In milliseconds, 0 to disable
  /** Filter models - only show models whose name includes this string */
  filter?: string;
  /** Exclude models - hide models whose name includes this string */
  excludeFilter?: string;
}

export interface UseOllamaModelsReturn {
  // Model list
  models: OllamaModel[];
  /** Filtered models based on filter/excludeFilter options */
  filteredModels: OllamaModel[];
  isLoading: boolean;
  error: string | null;
  ollamaUrl: string;
  isConnected: boolean;

  // Current settings
  currentChatModel: string;
  currentRagModel: string;
  embeddingModel: string;

  // Actions
  fetchModels: () => Promise<void>;
  fetchCurrentSettings: () => Promise<void>;
  setModel: (model: string, target: ModelTarget) => Promise<boolean>;

  // Computed
  hasModels: boolean;
}

export function useOllamaModels(options: UseOllamaModelsOptions = {}): UseOllamaModelsReturn {
  const { autoFetch = true, pollInterval = 0, filter, excludeFilter } = options;

  // State for model list
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // State for current settings
  const [currentChatModel, setCurrentChatModel] = useState('');
  const [currentRagModel, setCurrentRagModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');

  const apiBaseUrl = getApiBaseUrl();

  const buildHeaders = useCallback((baseHeaders?: HeadersInit): Headers => {
    const headers = new Headers(baseHeaders || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(CLOUDAPP_TOKEN_STORAGE_KEY);
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', token);
      }
    }

    return headers;
  }, []);

  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit = {},
    maxAttempts: number = 3
  ): Promise<Response> => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          headers: buildHeaders(options.headers),
        });
      } catch (err) {
        if (attempt < maxAttempts - 1) {
          await sleep(getRetryDelayMs(attempt));
          continue;
        }
        throw err;
      }

      if (response.ok) {
        return response;
      }

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts - 1) {
        const delayMs = getRetryDelayMs(attempt, response.headers.get('Retry-After'));
        await sleep(delayMs);
        continue;
      }

      return response;
    }

    throw new Error('Request retries exhausted');
  }, [buildHeaders]);

  const fetchModelsInternal = useCallback(async (bootstrapRetry: boolean) => {
    setIsLoading(true);
    setError(null);

    const retryDelays = bootstrapRetry ? OLLAMA_BOOTSTRAP_RETRY_DELAYS_MS : [];

    try {
      for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
        const response = await fetchWithRetry(`${apiBaseUrl}/llm/models`);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data: OllamaModelsResponse = await response.json();

        setModels(data.models);
        setOllamaUrl(data.ollama_url);
        setIsConnected(data.connected);

        if (data.connected) {
          setError(null);
          return;
        }

        // On the initial load, give the backend a short window to finish
        // establishing its Ollama connection before surfacing "offline".
        if (attempt < retryDelays.length) {
          await sleep(retryDelays[attempt]);
          continue;
        }

        if (data.error) {
          setError(data.error);
        }
        return;
      }
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, fetchWithRetry]);

  // Fetch available models from Ollama
  const fetchModels = useCallback(async () => {
    await fetchModelsInternal(false);
  }, [fetchModelsInternal]);

  // Fetch current model settings
  const fetchCurrentSettings = useCallback(async () => {
    try {
      const response = await fetchWithRetry(`${apiBaseUrl}/llm/current`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: CurrentModelSettings = await response.json();

      setCurrentChatModel(data.chat_model);
      setCurrentRagModel(data.rag_model);
      setEmbeddingModel(data.embedding_model);
      setOllamaUrl(data.ollama_url);
    } catch (err) {
      console.error('Failed to fetch current model settings:', err);
    }
  }, [apiBaseUrl, fetchWithRetry]);

  // Set model for chat/rag/both
  const setModel = useCallback(async (model: string, target: ModelTarget): Promise<boolean> => {
    try {
      const response = await fetchWithRetry(`${apiBaseUrl}/llm/current`, {
        method: 'POST',
        body: JSON.stringify({ model, target }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error: ${response.status}`);
      }

      const data: SetModelResponse = await response.json();

      if (data.success) {
        setCurrentChatModel(data.chat_model);
        setCurrentRagModel(data.rag_model);
        setEmbeddingModel(data.embedding_model);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to set model:', err);
      setError(err instanceof Error ? err.message : 'Failed to set model');
      return false;
    }
  }, [apiBaseUrl, fetchWithRetry]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchModelsInternal(true);
      fetchCurrentSettings();
    }
  }, [autoFetch, fetchModelsInternal, fetchCurrentSettings]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0) {
      const interval = setInterval(() => {
        fetchModels();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [pollInterval, fetchModels]);

  // Compute filtered models based on filter/excludeFilter options
  const filteredModels = models.filter(m => {
    const name = m.name.toLowerCase();
    // If filter is set, model must include the filter string
    if (filter && !name.includes(filter.toLowerCase())) {
      return false;
    }
    // If excludeFilter is set, model must NOT include the excludeFilter string
    if (excludeFilter && name.includes(excludeFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return {
    models,
    filteredModels,
    isLoading,
    error,
    ollamaUrl,
    isConnected,
    currentChatModel,
    currentRagModel,
    embeddingModel,
    fetchModels,
    fetchCurrentSettings,
    setModel,
    hasModels: models.length > 0,
  };
}

// ============================================================================
// UTILITY: Format model size
// ============================================================================

export function formatModelSize(bytes?: number): string {
  if (!bytes) return '';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// ============================================================================
// UTILITY: Format model name for display
// ============================================================================

export function formatModelName(name: string): string {
  // Remove common suffixes for cleaner display
  const cleanName = name
    .replace(/:latest$/, '')
    .replace(/:\d+b$/i, (match) => ` (${match.slice(1).toUpperCase()})`);

  return cleanName;
}

export default useOllamaModels;
