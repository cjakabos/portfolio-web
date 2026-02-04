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

  // Fetch available models from Ollama
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/llm/models`);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data: OllamaModelsResponse = await response.json();

      setModels(data.models);
      setOllamaUrl(data.ollama_url);
      setIsConnected(data.connected);

      if (!data.connected && data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // Fetch current model settings
  const fetchCurrentSettings = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/llm/current`);

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
  }, [apiBaseUrl]);

  // Set model for chat/rag/both
  const setModel = useCallback(async (model: string, target: ModelTarget): Promise<boolean> => {
    try {
      const response = await fetch(`${apiBaseUrl}/llm/current`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
  }, [apiBaseUrl]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchModels();
      fetchCurrentSettings();
    }
  }, [autoFetch, fetchModels, fetchCurrentSettings]);

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