// ============================================================================
// File: frontend-ai/src/hooks/useRAG.ts
// RAG Hooks - With Async Upload, Polling, and Job Recovery
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ragClient, RAGApiError } from '../services/ragClient';
import type {
  RAGDocument,
  RAGDocumentListResponse,
  RAGQueryResponse,
  RAGStatsResponse,
  RAGHealthResponse,
  UploadProgress,
  UploadStatusResponse,
  UploadJobStatus,
} from '../types/rag';

// =============================================================================
// LocalStorage Keys
// =============================================================================

const STORAGE_KEYS = {
  ACTIVE_JOBS: 'rag_active_upload_jobs',
};

// =============================================================================
// Generic Fetch Hook
// =============================================================================

interface UseFetchOptions<T> {
  initialData?: T;
  autoFetch?: boolean;
  refetchInterval?: number | null;
}

interface UseFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function useFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const { initialData = null, autoFetch = true, refetchInterval = null } = options;

  const [data, setData] = useState<T | null>(initialData as T | null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (isMounted.current) {
        setData(result);
      }
    } catch (err) {
      if (isMounted.current) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        // Don't log timeout errors - they're expected when server is busy
        if (!(err instanceof RAGApiError && err.statusCode === 408)) {
          console.error('RAG fetch error:', err);
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    isMounted.current = true;
    if (autoFetch) {
      refresh();
    }
    return () => {
      isMounted.current = false;
    };
  }, [autoFetch, refresh]);

  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      const interval = setInterval(refresh, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, refresh]);

  return { data, isLoading, error, refresh };
}

// =============================================================================
// RAG HEALTH HOOK
// =============================================================================

export interface UseRAGHealthOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useRAGHealth(options: UseRAGHealthOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const fetchHealth = useCallback(() => ragClient.getHealth(), []);

  const result = useFetch<RAGHealthResponse>(fetchHealth, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });

  return {
    ...result,
    health: result.data,
    isHealthy: result.data?.status === 'healthy',
    isInitialized: result.data?.initialized ?? false,
  };
}

// =============================================================================
// RAG STATS HOOK
// =============================================================================

export function useRAGStats(options: UseRAGHealthOptions = {}) {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const fetchStats = useCallback(() => ragClient.getStats(), []);

  const result = useFetch<RAGStatsResponse>(fetchStats, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });

  return {
    ...result,
    stats: result.data,
    totalDocuments: result.data?.total_documents ?? 0,
    totalChunks: result.data?.total_chunks ?? 0,
    documentsByType: result.data?.documents_by_type ?? {},
    refresh: result.refresh,
  };
}

// =============================================================================
// RAG DOCUMENTS HOOK
// =============================================================================

export interface UseRAGDocumentsOptions {
  userId?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useRAGDocuments(options: UseRAGDocumentsOptions = {}) {
  const { userId, limit = 100, autoRefresh = false, refreshInterval = 30000 } = options;

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchDocuments = useCallback(
    () => ragClient.listDocuments({ userId, limit }),
    [userId, limit]
  );

  const result = useFetch<RAGDocumentListResponse>(fetchDocuments, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });

  const deleteDocument = useCallback(async (docId: string) => {
    setIsDeleting(docId);
    try {
      await ragClient.deleteDocument(docId);
      await result.refresh();
      return true;
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    } finally {
      setIsDeleting(null);
    }
  }, [result]);

  return {
    ...result,
    documents: result.data?.documents ?? [],
    total: result.data?.total ?? 0,
    deleteDocument,
    isDeleting,
  };
}

// =============================================================================
// RAG UPLOAD HOOK - WITH PERSISTENCE AND RECOVERY
// =============================================================================

export interface UseRAGUploadOptions {
  userId?: number;
  tags?: string[];
  category?: string;
  pollInterval?: number;
  onSuccess?: (result: UploadStatusResponse) => void;
  onError?: (error: Error, file: File) => void;
  onProgress?: (jobId: string, progress: UploadStatusResponse) => void;
}

// Helper to save/load active jobs from localStorage
function saveActiveJobs(jobs: Map<string, { filename: string; startedAt: string }>) {
  try {
    const data = Object.fromEntries(jobs);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_JOBS, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save active jobs to localStorage:', e);
  }
}

function loadActiveJobs(): Map<string, { filename: string; startedAt: string }> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_JOBS);
    if (data) {
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn('Failed to load active jobs from localStorage:', e);
  }
  return new Map();
}

function clearActiveJob(jobId: string) {
  try {
    const jobs = loadActiveJobs();
    jobs.delete(jobId);
    saveActiveJobs(jobs);
  } catch (e) {
    console.warn('Failed to clear active job:', e);
  }
}

export function useRAGUpload(options: UseRAGUploadOptions = {}) {
  const {
    userId,
    tags,
    category,
    pollInterval = 2000,
    onSuccess,
    onError,
    onProgress
  } = options;

  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(true);
  const pollIntervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isMounted = useRef(true);

  // Create a placeholder File object for recovered jobs
  const createPlaceholderFile = useCallback((filename: string): File => {
    return new File([], filename, { type: 'application/octet-stream' });
  }, []);

  // Poll for job status
  const startPolling = useCallback((jobId: string, file: File) => {
    // Don't start if already polling
    if (pollIntervalRefs.current.has(jobId)) {
      return;
    }

    const poll = async () => {
      if (!isMounted.current) return;

      try {
        const status = await ragClient.getUploadStatus(jobId);

        if (!isMounted.current) return;

        // Update upload state
        setUploads(prev => prev.map(u =>
          u.jobId === jobId
            ? {
                ...u,
                status: status.status,
                progress: status.progress,
                message: status.message,
                error: status.error ?? undefined,
                result: status.status === 'completed' ? status : undefined
              }
            : u
        ));

        onProgress?.(jobId, status);

        // Check if done
        if (status.status === 'completed') {
          clearInterval(pollIntervalRefs.current.get(jobId));
          pollIntervalRefs.current.delete(jobId);
          clearActiveJob(jobId);
          onSuccess?.(status);

          // Update isUploading
          setUploads(prev => {
            const stillProcessing = prev.some(u =>
              u.jobId !== jobId &&
              !['completed', 'failed'].includes(u.status)
            );
            if (!stillProcessing) {
              setIsUploading(false);
            }
            return prev;
          });
        } else if (status.status === 'failed') {
          clearInterval(pollIntervalRefs.current.get(jobId));
          pollIntervalRefs.current.delete(jobId);
          clearActiveJob(jobId);
          onError?.(new Error(status.error || 'Upload failed'), file);

          setUploads(prev => {
            const stillProcessing = prev.some(u =>
              u.jobId !== jobId &&
              !['completed', 'failed'].includes(u.status)
            );
            if (!stillProcessing) {
              setIsUploading(false);
            }
            return prev;
          });
        }
      } catch (err) {
        if (!isMounted.current) return;

        // Don't stop polling on timeout - server might just be busy
        if (err instanceof RAGApiError && err.statusCode === 408) {
          console.debug(`Polling timeout for ${jobId}, will retry...`);
          return;
        }

        // On 404, the job doesn't exist (server restarted and lost it)
        if (err instanceof RAGApiError && err.statusCode === 404) {
          console.warn(`Job ${jobId} not found on server, marking as failed`);
          setUploads(prev => prev.map(u =>
            u.jobId === jobId
              ? { ...u, status: 'failed' as const, error: 'Job lost - server may have restarted. Please re-upload.' }
              : u
          ));
          clearInterval(pollIntervalRefs.current.get(jobId));
          pollIntervalRefs.current.delete(jobId);
          clearActiveJob(jobId);
          return;
        }

        console.error(`Polling error for ${jobId}:`, err);
      }
    };

    // Start polling
    const intervalId = setInterval(poll, pollInterval);
    pollIntervalRefs.current.set(jobId, intervalId);

    // Also poll immediately
    poll();
  }, [pollInterval, onSuccess, onError, onProgress]);

  // Recover jobs from localStorage on mount
  useEffect(() => {
    isMounted.current = true;

    const recoverJobs = async () => {
      const savedJobs = loadActiveJobs();

      if (savedJobs.size === 0) {
        setIsRecovering(false);
        return;
      }

      console.log(`Recovering ${savedJobs.size} upload jobs...`);

      const recoveredUploads: UploadProgress[] = [];

      for (const [jobId, info] of savedJobs) {
        const placeholderFile = createPlaceholderFile(info.filename);

        try {
          // Check if job still exists on server
          const status = await ragClient.getUploadStatus(jobId);

          recoveredUploads.push({
            file: placeholderFile,
            jobId,
            progress: status.progress,
            status: status.status,
            message: status.message,
            error: status.error ?? undefined,
            result: status.status === 'completed' ? status : undefined,
          });

          // If still in progress, start polling
          if (!['completed', 'failed'].includes(status.status)) {
            setIsUploading(true);
            // Delay polling start to avoid race conditions
            setTimeout(() => startPolling(jobId, placeholderFile), 100);
          } else {
            // Clean up completed/failed jobs from storage
            clearActiveJob(jobId);
          }
        } catch (err) {
          // Only mark as truly lost if we get a 404 (job doesn't exist)
          // For timeouts or other errors, assume job is still running and start polling
          if (err instanceof RAGApiError && err.statusCode === 404) {
            console.warn(`Job ${jobId} not found on server (404), marking as lost`);
            clearActiveJob(jobId);

            recoveredUploads.push({
              file: placeholderFile,
              jobId,
              progress: 0,
              status: 'failed',
              error: 'Job lost - server may have restarted. Please re-upload.',
            });
          } else {
            // Timeout or other error - server might be busy, assume job is still running
            console.log(`Could not fetch status for ${jobId} (${err instanceof Error ? err.message : 'unknown error'}), will poll...`);

            recoveredUploads.push({
              file: placeholderFile,
              jobId,
              progress: 0,
              status: 'pending',
              message: 'Work in progress..',
            });

            setIsUploading(true);
            // Start polling - it will handle getting the real status
            setTimeout(() => startPolling(jobId, placeholderFile), 500);
          }
        }
      }

      if (recoveredUploads.length > 0) {
        setUploads(recoveredUploads);
      }

      setIsRecovering(false);
    };

    recoverJobs();

    return () => {
      isMounted.current = false;
      // Cleanup polling intervals
      pollIntervalRefs.current.forEach(interval => clearInterval(interval));
      pollIntervalRefs.current.clear();
    };
  }, [createPlaceholderFile, startPolling]);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    // Add to uploads list with initial state
    setUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'uploading' as const,
      message: 'Uploading file...',
    }]);

    setIsUploading(true);

    try {
      // Start async upload
      const response = await ragClient.uploadDocumentAsync(file, {
        userId,
        tags,
        category,
      });

      // Save to localStorage for recovery
      const activeJobs = loadActiveJobs();
      activeJobs.set(response.job_id, {
        filename: file.name,
        startedAt: new Date().toISOString(),
      });
      saveActiveJobs(activeJobs);

      // Update with job ID and start polling
      setUploads(prev => prev.map(u =>
        u.file === file && !u.jobId
          ? {
              ...u,
              jobId: response.job_id,
              status: response.status as UploadJobStatus,
              progress: 5,
              message: response.message
            }
          : u
      ));

      // Start polling for progress
      startPolling(response.job_id, file);

      return response.job_id;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');

      setUploads(prev => prev.map(u =>
        u.file === file
          ? { ...u, status: 'failed' as const, error: error.message }
          : u
      ));

      onError?.(error, file);

      // Check if any uploads still active
      setUploads(prev => {
        const stillProcessing = prev.some(u =>
          !['completed', 'failed'].includes(u.status)
        );
        if (!stillProcessing) {
          setIsUploading(false);
        }
        return prev;
      });

      return null;
    }
  }, [userId, tags, category, startPolling, onError]);

  const uploadFiles = useCallback(async (files: File[]): Promise<(string | null)[]> => {
    const results: (string | null)[] = [];

    for (const file of files) {
      const jobId = await uploadFile(file);
      results.push(jobId);
    }

    return results;
  }, [uploadFile]);

  const clearUploads = useCallback(() => {
    // Stop all polling
    pollIntervalRefs.current.forEach(interval => clearInterval(interval));
    pollIntervalRefs.current.clear();

    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_JOBS);
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }

    setUploads([]);
    setIsUploading(false);
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
  }, []);

  const clearFailed = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'failed'));
  }, []);

  // Computed states
  const activeUploads = uploads.filter(u =>
    !['completed', 'failed'].includes(u.status)
  );
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const failedUploads = uploads.filter(u => u.status === 'failed');

  return {
    uploads,
    activeUploads,
    completedUploads,
    failedUploads,
    isUploading,
    isRecovering,
    uploadFile,
    uploadFiles,
    clearUploads,
    clearCompleted,
    clearFailed,
  };
}

// =============================================================================
// RAG QUERY HOOK
// =============================================================================

export interface UseRAGQueryOptions {
  userId?: number;
  topK?: number;
  generateAnswer?: boolean;
}

export function useRAGQuery(options: UseRAGQueryOptions = {}) {
  const { userId, topK = 5, generateAnswer = true } = options;

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RAGQueryResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{
    query: string;
    response: RAGQueryResponse;
    timestamp: Date;
  }>>([]);

  const executeQuery = useCallback(async (queryText?: string) => {
    const q = queryText ?? query;
    if (!q.trim()) {
      setError('Query cannot be empty');
      return null;
    }

    setIsQuerying(true);
    setError(null);

    try {
      const response = await ragClient.query({
        query: q,
        user_id: userId,
        top_k: topK,
        generate_answer: generateAnswer,
      });

      setResult(response);

      setHistory(prev => [{
        query: q,
        response,
        timestamp: new Date(),
      }, ...prev].slice(0, 20));

      return response;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
      console.error('RAG query error:', err);
      return null;

    } finally {
      setIsQuerying(false);
    }
  }, [query, userId, topK, generateAnswer]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    query,
    setQuery,
    result,
    isQuerying,
    error,
    history,
    executeQuery,
    clearResult,
    clearHistory,
  };
}

// =============================================================================
// COMBINED RAG HOOK
// =============================================================================

export function useRAG(options: {
  userId?: number;
  autoRefresh?: boolean;
} = {}) {
  const { userId, autoRefresh = false } = options;

  const health = useRAGHealth({ autoRefresh });
  const stats = useRAGStats({ autoRefresh });
  const documents = useRAGDocuments({ userId, autoRefresh });
  const upload = useRAGUpload({
    userId,
    onSuccess: () => {
      documents.refresh();
      stats.refresh();
    }
  });
  const queryHook = useRAGQuery({ userId });

  return {
    // Health
    isHealthy: health.isHealthy,
    isInitialized: health.isInitialized,
    healthError: health.error,

    // Stats
    stats: stats.stats,
    totalDocuments: stats.totalDocuments,
    totalChunks: stats.totalChunks,
    refreshStats: stats.refresh,

    // Documents
    documents: documents.documents,
    isLoadingDocuments: documents.isLoading,
    documentsError: documents.error,
    refreshDocuments: documents.refresh,
    deleteDocument: documents.deleteDocument,
    isDeleting: documents.isDeleting,

    // Upload
    uploads: upload.uploads,
    activeUploads: upload.activeUploads,
    completedUploads: upload.completedUploads,
    failedUploads: upload.failedUploads,
    isUploading: upload.isUploading,
    isRecovering: upload.isRecovering,
    uploadFile: upload.uploadFile,
    uploadFiles: upload.uploadFiles,
    clearUploads: upload.clearUploads,
    clearCompleted: upload.clearCompleted,

    // Query
    query: queryHook.query,
    setQuery: queryHook.setQuery,
    queryResult: queryHook.result,
    isQuerying: queryHook.isQuerying,
    queryError: queryHook.error,
    queryHistory: queryHook.history,
    executeQuery: queryHook.executeQuery,
    clearQueryResult: queryHook.clearResult,
  };
}