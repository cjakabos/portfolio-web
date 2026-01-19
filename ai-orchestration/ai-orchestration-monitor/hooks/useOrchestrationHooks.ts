// =============================================================================
// React Hooks for AI Orchestration Backend Integration
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { orchestrationClient, ApiError, NetworkError, TimeoutError } from '../services/orchestrationClient';
import type {
  Metrics,
  DetailedMetrics,
  ChatMessage,
  CircuitBreakerListResponse,
  CircuitBreaker,
  ConnectionStatsResponse,
  FeatureStatus,
  ErrorSummary,
  Experiment,
  ExperimentListItem,
  ExperimentStats,
  ExperimentCreateRequest,
  ApprovalRequest,
  ApprovalHistoryItem,
  ApprovalStats,
  OrchestrationResponse,
  ToolDiscoveryResponse,
  ChatMessage,
  WebSocketStreamMessage,
} from '../types';

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
  
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
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
// METRICS HOOK
// =============================================================================

export interface UseMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useMetrics(options: UseMetricsOptions = {}) {
  const { autoRefresh = true, refreshInterval = 5000 } = options;

  const fetchMetrics = useCallback(() => orchestrationClient.getMetrics(), []);
  
  return useFetch<Metrics>(fetchMetrics, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });
}

export function useDetailedMetrics(hours: number = 24) {
  const fetchDetailedMetrics = useCallback(
    () => orchestrationClient.getDetailedMetrics(hours),
    [hours]
  );
  
  return useFetch<DetailedMetrics>(fetchDetailedMetrics);
}

// =============================================================================
// CIRCUIT BREAKERS HOOK
// =============================================================================

export interface UseCircuitBreakersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useCircuitBreakers(options: UseCircuitBreakersOptions = {}) {
  const { autoRefresh = true, refreshInterval = 10000 } = options;
  
  const [resettingBreaker, setResettingBreaker] = useState<string | null>(null);
  
  const fetchCircuitBreakers = useCallback(
    () => orchestrationClient.getCircuitBreakers(),
    []
  );

  const result = useFetch<CircuitBreakerListResponse>(fetchCircuitBreakers, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });

  const resetBreaker = useCallback(async (name: string) => {
    setResettingBreaker(name);
    try {
      await orchestrationClient.resetCircuitBreaker(name);
      await result.refresh();
    } catch (err) {
      console.error('Failed to reset circuit breaker:', err);
      throw err;
    } finally {
      setResettingBreaker(null);
    }
  }, [result]);

  return {
    ...result,
    circuitBreakers: result.data?.circuit_breakers || [],
    storageBackend: result.data?.storage_backend || 'unavailable',
    resetBreaker,
    resettingBreaker,
  };
}

// =============================================================================
// CONNECTION STATS HOOK
// =============================================================================

export function useConnectionStats(options: UseCircuitBreakersOptions = {}) {
  const { autoRefresh = true, refreshInterval = 10000 } = options;

  const fetchConnectionStats = useCallback(
    () => orchestrationClient.getConnectionStats(),
    []
  );

  const result = useFetch<ConnectionStatsResponse>(fetchConnectionStats, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });

  return {
    ...result,
    connectionStats: result.data?.services || [],
    totalServices: result.data?.total_services || 0,
  };
}

// =============================================================================
// FEATURE STATUS HOOK
// =============================================================================

export function useFeatureStatus() {
  const fetchFeatureStatus = useCallback(
    () => orchestrationClient.getFeatureStatus(),
    []
  );

  return useFetch<FeatureStatus>(fetchFeatureStatus);
}

// =============================================================================
// ERROR SUMMARY HOOK
// =============================================================================

export function useErrorSummary(hours: number = 24, options: UseMetricsOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const fetchErrorSummary = useCallback(
    () => orchestrationClient.getErrorSummary(hours),
    [hours]
  );

  return useFetch<ErrorSummary>(fetchErrorSummary, {
    autoFetch: true,
    refetchInterval: autoRefresh ? refreshInterval : null,
  });
}

// =============================================================================
// EXPERIMENTS HOOKS
// =============================================================================

export function useExperiments(autoRefresh: boolean = false) {
  const fetchExperiments = useCallback(
    () => orchestrationClient.getExperiments(),
    []
  );

  const result = useFetch<ExperimentListItem[]>(fetchExperiments, {
    autoFetch: true,
    refetchInterval: autoRefresh ? 30000 : null,
  });

  return {
    ...result,
    experiments: result.data || [],
  };
}

export function useExperiment(experimentId: string | null) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiment = useCallback(async () => {
    if (!experimentId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getExperiment(experimentId);
      setExperiment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch experiment');
    } finally {
      setIsLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    fetchExperiment();
  }, [fetchExperiment]);

  return { experiment, isLoading, error, refresh: fetchExperiment };
}

export function useExperimentStats() {
  const fetchStats = useCallback(
    () => orchestrationClient.getExperimentStats(),
    []
  );

  return useFetch<ExperimentStats>(fetchStats);
}

export function useExperimentActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createExperiment = useCallback(async (data: ExperimentCreateRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.createExperiment(data);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create experiment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startExperiment = useCallback(async (experimentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.startExperiment(experimentId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start experiment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pauseExperiment = useCallback(async (experimentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.pauseExperiment(experimentId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause experiment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopExperiment = useCallback(async (experimentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.stopExperiment(experimentId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop experiment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteExperiment = useCallback(async (experimentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await orchestrationClient.deleteExperiment(experimentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete experiment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createExperiment,
    startExperiment,
    pauseExperiment,
    stopExperiment,
    deleteExperiment,
    isLoading,
    error,
  };
}

// =============================================================================
// APPROVALS HOOKS
// =============================================================================

export function usePendingApprovals(autoRefresh: boolean = true) {
  const fetchPendingApprovals = useCallback(
    () => orchestrationClient.getPendingApprovals(),
    []
  );

  const result = useFetch<ApprovalRequest[]>(fetchPendingApprovals, {
    autoFetch: true,
    refetchInterval: autoRefresh ? 5000 : null,
  });

  return {
    ...result,
    pendingApprovals: result.data || [],
  };
}

export function useApprovalHistory(limit: number = 100) {
  const fetchHistory = useCallback(
    () => orchestrationClient.getApprovalHistory({ limit }),
    [limit]
  );

  const result = useFetch<ApprovalHistoryItem[]>(fetchHistory);

  return {
    ...result,
    history: result.data || [],
  };
}

export function useApprovalStats() {
  const fetchStats = useCallback(
    () => orchestrationClient.getApprovalStats(),
    []
  );

  return useFetch<ApprovalStats>(fetchStats);
}

export function useApprovalActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (requestId: string, approverId: number, notes?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.approveRequest(requestId, approverId, notes);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve request';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reject = useCallback(async (requestId: string, approverId: number, notes?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestrationClient.rejectRequest(requestId, approverId, notes);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject request';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancel = useCallback(async (requestId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await orchestrationClient.cancelApproval(requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel request';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { approve, reject, cancel, isLoading, error };
}

// =============================================================================
// ORCHESTRATION HOOK
// =============================================================================

export interface UseOrchestrationOptions {
  userId: number;
  sessionId: string;
  initialContext?: Record<string, unknown>;
}

export function useOrchestration({ userId, sessionId, initialContext }: UseOrchestrationOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<OrchestrationResponse | null>(null);

  const execute = useCallback(
    async (message: string, context?: Record<string, unknown>) => {
      setIsLoading(true);
      setError(null);

      try {
        const mergedContext = { ...initialContext, ...context };
        const response = await orchestrationClient.execute(
          message, 
          userId, 
          sessionId, 
          mergedContext
        );
        setLastResponse(response);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Orchestration failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, sessionId, initialContext]
  );

  return {
    execute,
    isLoading,
    error,
    lastResponse,
  };
}

// =============================================================================
// WEBSOCKET STREAMING HOOK
// =============================================================================

// =============================================================================
// useStreaming Hook - Fixed Version
// =============================================================================
// FIXED: Uses refs for callbacks to prevent infinite reconnection loop
// Replace the useStreaming function in hooks/useOrchestrationHooks.ts with this
// =============================================================================
interface UseStreamingOptions {
  userId: number;
  sessionId: string;
  onToken?: (token: string) => void;
  onNodeStart?: (node: string) => void;
  onNodeEnd?: (node: string) => void;
  onComplete?: (content: string, metrics?: { tokens_generated: number; latency_ms: number }) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export function useStreaming({
  userId,
  sessionId,
  onToken,
  onNodeStart,
  onNodeEnd,
  onComplete,
  onError,
  autoConnect = false,
}: UseStreamingOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [currentStreamingContent, setCurrentStreamingContent] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // FIXED: Store callbacks in refs to avoid dependency changes triggering reconnects
  const callbacksRef = useRef({
    onToken,
    onNodeStart,
    onNodeEnd,
    onComplete,
    onError,
  });

  // Update refs when callbacks change (without triggering effects)
  useEffect(() => {
    callbacksRef.current = {
      onToken,
      onNodeStart,
      onNodeEnd,
      onComplete,
      onError,
    };
  });

  // FIXED: handleMessage now uses refs, so it's stable
  const handleMessage = useCallback((data: WebSocketStreamMessage) => {
    const callbacks = callbacksRef.current;

    switch (data.type) {
      case 'token':
        if (data.data.token) {
          setCurrentStreamingContent(prev => prev + data.data.token);
          callbacks.onToken?.(data.data.token);
        }
        break;
      case 'node_start':
        if (data.data.node) {
          setActiveNodes(prev => [...prev, data.data.node!]);
          callbacks.onNodeStart?.(data.data.node);
        }
        break;
      case 'node_end':
        if (data.data.node) {
          setActiveNodes(prev => prev.filter(n => n !== data.data.node));
          callbacks.onNodeEnd?.(data.data.node);
        }
        break;
      case 'complete':
        setIsStreaming(false);
        setActiveNodes([]);
        if (data.data.content) {
          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: data.data.content,
            timestamp: new Date().toISOString(),
            metrics: data.data.metrics ? {
              tokensPerSecond: data.data.metrics.tokens_generated / (data.data.metrics.latency_ms / 1000),
              totalTokens: data.data.metrics.tokens_generated,
              latency: data.data.metrics.latency_ms,
            } : undefined,
          };
          setMessages(prev => [...prev, assistantMessage]);
          setCurrentStreamingContent('');
          callbacks.onComplete?.(data.data.content, data.data.metrics);
        }
        break;
      case 'error':
        setIsStreaming(false);
        setActiveNodes([]);
        setCurrentStreamingContent('');
        if (data.data.error) {
          callbacks.onError?.(data.data.error);
        }
        break;
    }
  }, []); // Empty deps - uses refs for callbacks

  // FIXED: connect is now stable (handleMessage is stable)
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = orchestrationClient.connectWebSocket(
        (data) => {
          handleMessage(data as WebSocketStreamMessage);
        },
        (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          setIsStreaming(false);
        },
        () => {
          // onClose callback
          setIsConnected(false);
          setIsStreaming(false);
        }
      );

      wsRef.current = ws;
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      setIsConnected(false);
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    orchestrationClient.closeWebSocket();
    wsRef.current = null;
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (message: string, context?: Record<string, unknown>) => {
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // If WebSocket is connected, use streaming
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        setIsStreaming(true);
        setCurrentStreamingContent('');
        orchestrationClient.sendWebSocketMessage(message, userId, sessionId, context);
      } else {
        // Fallback to HTTP request
        try {
          setIsStreaming(true);
          const response = await orchestrationClient.execute(message, userId, sessionId, context);

          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: response.response,
            timestamp: new Date().toISOString(),
            metrics: {
              tokensPerSecond: 0,
              totalTokens: 0,
              latency: response.latency_ms,
            },
          };
          setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
          console.error('Failed to send message:', err);
          callbacksRef.current.onError?.(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
          setIsStreaming(false);
        }
      }
    },
    [userId, sessionId]  // Removed onError from deps - using ref instead
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentStreamingContent('');
  }, []);

  // FIXED: Only run on mount/unmount when autoConnect is true
  // Using a ref to track if we've connected to prevent double-connect in StrictMode
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (autoConnect && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    }

    return () => {
      if (hasConnectedRef.current) {
        disconnect();
        hasConnectedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]); // Intentionally omit connect/disconnect to prevent loops

  return {
    isConnected,
    isStreaming,
    messages,
    activeNodes,
    currentStreamingContent,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  };
}

// =============================================================================
// TOOLS HOOK
// =============================================================================

export function useTools() {
  const fetchTools = useCallback(
    () => orchestrationClient.discoverTools(),
    []
  );

  const result = useFetch<ToolDiscoveryResponse>(fetchTools);

  const [invoking, setInvoking] = useState<string | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);

  const invokeTool = useCallback(async (toolName: string, parameters: Record<string, unknown>) => {
    setInvoking(toolName);
    setInvokeError(null);
    try {
      const response = await orchestrationClient.invokeTool(toolName, parameters);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invoke tool';
      setInvokeError(message);
      throw err;
    } finally {
      setInvoking(null);
    }
  }, []);

  return {
    ...result,
    tools: result.data?.tools || [],
    categories: result.data?.categories || [],
    invokeTool,
    invoking,
    invokeError,
  };
}

// =============================================================================
// COMBINED SYSTEM STATUS HOOK
// =============================================================================

export function useSystemStatus(autoRefresh: boolean = true) {
  const circuitBreakers = useCircuitBreakers({ autoRefresh });
  const connectionStats = useConnectionStats({ autoRefresh });
  const featureStatus = useFeatureStatus();
  const errorSummary = useErrorSummary(24, { autoRefresh });

  const isLoading = 
    circuitBreakers.isLoading ||
    connectionStats.isLoading ||
    featureStatus.isLoading ||
    errorSummary.isLoading;

  const hasError = 
    circuitBreakers.error ||
    connectionStats.error ||
    featureStatus.error ||
    errorSummary.error;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      circuitBreakers.refresh(),
      connectionStats.refresh(),
      featureStatus.refresh(),
      errorSummary.refresh(),
    ]);
  }, [
    circuitBreakers,
    connectionStats,
    featureStatus,
    errorSummary,
  ]);

  return {
    circuitBreakers,
    connectionStats,
    featureStatus,
    errorSummary,
    isLoading,
    hasError,
    refreshAll,
  };
}

// =============================================================================
// HEALTH CHECK HOOK
// =============================================================================

export function useHealth(checkInterval: number = 30000) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const response = await orchestrationClient.getHealth();
      setIsHealthy(response.status === 'healthy');
    } catch {
      setIsHealthy(false);
    }
    setLastCheck(new Date());
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, checkInterval);
    return () => clearInterval(interval);
  }, [checkHealth, checkInterval]);

  return { isHealthy, lastCheck, checkHealth };
}
