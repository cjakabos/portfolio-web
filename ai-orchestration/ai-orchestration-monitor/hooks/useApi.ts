// =============================================================================
// API Hooks - React hooks for data fetching
// File: hooks/useApi.ts
// =============================================================================
//
// These hooks provide proper error handling, loading states, and retry logic
// for API calls. They replace silent mock data fallbacks with explicit error states.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { orchestrationClient, ApiError, NetworkError, TimeoutError } from '../services/OrchestrationClient';
import type {
  Metrics,
  Experiment,
  ApprovalRequest,
  ApprovalHistoryItem,
  CircuitBreakerListResponse,
  ConnectionStatsResponse,
  FeatureStatus,
  ErrorSummary,
  CloudAppItem,
  Cart,
  Order,
  Note,
  Employee,
  Customer,
  Pet,
  Schedule,
  Vehicle,
} from '../types';

// =============================================================================
// Types
// =============================================================================

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

interface UseApiOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  retryOnError?: boolean;
  maxRetries?: number;
}

// =============================================================================
// Generic API Hook
// =============================================================================

export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiState<T> & { refresh: () => Promise<void>; retry: () => Promise<void> } {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    retryOnError = true,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const retriesRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (isRetry = false) => {
    if (!isRetry) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const data = await fetchFn();
      setState({
        data,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
      retriesRef.current = 0;
    } catch (error) {
      const apiError = error instanceof Error ? error : new Error(String(error));
      
      // Retry logic
      if (retryOnError && retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        const backoffDelay = Math.min(1000 * Math.pow(2, retriesRef.current), 10000);
        setTimeout(() => fetchData(true), backoffDelay);
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: apiError,
      }));
    }
  }, [fetchFn, retryOnError, maxRetries]);

  const refresh = useCallback(async () => {
    retriesRef.current = 0;
    await fetchData();
  }, [fetchData]);

  const retry = useCallback(async () => {
    retriesRef.current = 0;
    await fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(refresh, refreshInterval);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refresh]);

  return { ...state, refresh, retry };
}

// =============================================================================
// Specific API Hooks
// =============================================================================

// --- Metrics ---
export function useMetrics(autoRefresh = true, refreshInterval = 5000) {
  return useApi<Metrics>(
    () => orchestrationClient.getMetrics(),
    { autoRefresh, refreshInterval }
  );
}

// --- Circuit Breakers ---
export function useCircuitBreakers(autoRefresh = true, refreshInterval = 5000) {
  const result = useApi<CircuitBreakerListResponse>(
    () => orchestrationClient.getCircuitBreakers(),
    { autoRefresh, refreshInterval }
  );

  const resetCircuitBreaker = useCallback(async (name: string) => {
    await orchestrationClient.resetCircuitBreaker(name);
    await result.refresh();
  }, [result.refresh]);

  return {
    circuitBreakers: result.data?.circuit_breakers || [],
    storageBackend: result.data?.storage_backend || 'unknown',
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
    resetCircuitBreaker,
  };
}

// --- Connection Stats ---
export function useConnectionStats(autoRefresh = true, refreshInterval = 10000) {
  const result = useApi<ConnectionStatsResponse>(
    () => orchestrationClient.getConnectionStats(),
    { autoRefresh, refreshInterval }
  );

  return {
    connectionStats: result.data || null,
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Feature Status ---
export function useFeatureStatus(autoRefresh = false) {
  const result = useApi<FeatureStatus>(
    () => orchestrationClient.getFeatureStatus(),
    { autoRefresh }
  );

  return {
    featureStatus: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Error Summary ---
export function useErrorSummary(hours = 24, autoRefresh = true, refreshInterval = 30000) {
  const result = useApi<ErrorSummary>(
    () => orchestrationClient.getErrorSummary(hours),
    { autoRefresh, refreshInterval }
  );

  return {
    errorSummary: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Experiments ---
export function useExperiments(autoRefresh = false) {
  const result = useApi(
    () => orchestrationClient.getExperiments(),
    { autoRefresh }
  );

  return {
    experiments: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

export function useExperiment(experimentId: string | null) {
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchExperiment = useCallback(async () => {
    if (!experimentId) {
      setExperiment(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await orchestrationClient.getExperiment(experimentId);
      setExperiment(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    fetchExperiment();
  }, [fetchExperiment]);

  return { experiment, isLoading, error, refresh: fetchExperiment };
}

// --- Approvals ---
export function useApprovals(autoRefresh = true, refreshInterval = 10000) {
  const pendingResult = useApi<ApprovalRequest[]>(
    () => orchestrationClient.getPendingApprovals(),
    { autoRefresh, refreshInterval }
  );

  const historyResult = useApi<ApprovalHistoryItem[]>(
    () => orchestrationClient.getApprovalHistory(),
    { autoRefresh: false }
  );

  const approve = useCallback(async (requestId: string, approverId: number, notes?: string) => {
    await orchestrationClient.approveRequest(requestId, approverId, notes);
    await pendingResult.refresh();
    await historyResult.refresh();
  }, [pendingResult.refresh, historyResult.refresh]);

  const reject = useCallback(async (requestId: string, approverId: number, notes?: string) => {
    await orchestrationClient.rejectRequest(requestId, approverId, notes);
    await pendingResult.refresh();
    await historyResult.refresh();
  }, [pendingResult.refresh, historyResult.refresh]);

  return {
    pendingApprovals: pendingResult.data || [],
    approvalHistory: historyResult.data || [],
    isLoading: pendingResult.isLoading || historyResult.isLoading,
    error: pendingResult.error || historyResult.error,
    refresh: async () => {
      await pendingResult.refresh();
      await historyResult.refresh();
    },
    approve,
    reject,
  };
}

// --- CloudApp Items ---
export function useItems(autoRefresh = false) {
  const result = useApi<CloudAppItem[]>(
    () => orchestrationClient.getItems(),
    { autoRefresh }
  );

  return {
    items: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- CloudApp Cart ---
export function useCart(username: string, autoRefresh = false) {
  const result = useApi<Cart>(
    () => orchestrationClient.getCart(username),
    { autoRefresh }
  );

  const addToCart = useCallback(async (itemId: number, quantity = 1) => {
    await orchestrationClient.addToCart(username, itemId, quantity);
    await result.refresh();
  }, [username, result.refresh]);

  const removeFromCart = useCallback(async (itemId: number, quantity = 1) => {
    await orchestrationClient.removeFromCart(username, itemId, quantity);
    await result.refresh();
  }, [username, result.refresh]);

  const clearCart = useCallback(async () => {
    await orchestrationClient.clearCart(username);
    await result.refresh();
  }, [username, result.refresh]);

  return {
    cart: result.data || { items: [], total: 0 },
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
    addToCart,
    removeFromCart,
    clearCart,
  };
}

// --- CloudApp Orders ---
export function useOrders(username: string, autoRefresh = false) {
  const result = useApi<Order[]>(
    () => orchestrationClient.getOrderHistory(username),
    { autoRefresh }
  );

  const submitOrder = useCallback(async () => {
    await orchestrationClient.submitOrder(username);
    await result.refresh();
  }, [username, result.refresh]);

  return {
    orders: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
    submitOrder,
  };
}

// --- CloudApp Notes ---
export function useNotes(username: string, autoRefresh = false) {
  const result = useApi<Note[]>(
    () => orchestrationClient.getUserNotes(username),
    { autoRefresh }
  );

  const addNote = useCallback(async (title: string, description: string) => {
    await orchestrationClient.addNote(username, title, description);
    await result.refresh();
  }, [username, result.refresh]);

  const updateNote = useCallback(async (noteId: number, title: string, description: string) => {
    await orchestrationClient.updateNote(noteId, title, description);
    await result.refresh();
  }, [result.refresh]);

  const deleteNote = useCallback(async (noteId: number) => {
    await orchestrationClient.deleteNote(noteId);
    await result.refresh();
  }, [result.refresh]);

  return {
    notes: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
    addNote,
    updateNote,
    deleteNote,
  };
}

// --- Petstore Employees ---
export function useEmployees(autoRefresh = false) {
  const result = useApi<Employee[]>(
    () => orchestrationClient.getEmployees(),
    { autoRefresh }
  );

  return {
    employees: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Petstore Customers ---
export function useCustomers(autoRefresh = false) {
  const result = useApi<Customer[]>(
    () => orchestrationClient.getCustomers(),
    { autoRefresh }
  );

  return {
    customers: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Petstore Pets ---
export function usePets(autoRefresh = false) {
  const result = useApi<Pet[]>(
    () => orchestrationClient.getPets(),
    { autoRefresh }
  );

  return {
    pets: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Petstore Schedules ---
export function useSchedules(autoRefresh = false) {
  const result = useApi<Schedule[]>(
    () => orchestrationClient.getSchedules(),
    { autoRefresh }
  );

  return {
    schedules: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// --- Vehicles ---
export function useVehicles(autoRefresh = false) {
  const result = useApi<Vehicle[]>(
    () => orchestrationClient.getVehicles(),
    { autoRefresh }
  );

  return {
    vehicles: result.data || [],
    isLoading: result.isLoading,
    error: result.error,
    refresh: result.refresh,
  };
}

// =============================================================================
// Error Display Component
// =============================================================================

export function ApiErrorDisplay({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  let message = 'An unexpected error occurred';
  let suggestion = 'Please try again later';

  if (error instanceof NetworkError) {
    message = 'Unable to connect to the server';
    suggestion = 'Please check your network connection and ensure the backend is running';
  } else if (error instanceof TimeoutError) {
    message = 'Request timed out';
    suggestion = 'The server is taking too long to respond. Please try again';
  } else if (error instanceof ApiError) {
    message = `API Error (${error.statusCode})`;
    suggestion = error.message;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">{message}</h3>
          <p className="mt-1 text-sm text-red-700">{suggestion}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try again →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Skeleton Component
// =============================================================================

export function LoadingSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
