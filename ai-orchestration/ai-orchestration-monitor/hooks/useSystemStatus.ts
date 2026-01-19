// ============================================================================
// React Hooks for System Monitoring
// File: hooks/useSystemStatus.ts
// ============================================================================
// NEW: Hooks for circuit breakers, connection stats, feature status, errors
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import orchestrationClient, {
  CircuitBreakerStatus,
  CircuitBreakerListResponse,
  ConnectionStatsResponse,
  FeatureStatus,
  ErrorSummary,
} from '../services/orchestrationClient';

// ============================================================================
// CIRCUIT BREAKERS HOOK
// ============================================================================

export function useCircuitBreakers(autoRefresh: boolean = true, refreshInterval: number = 5000) {
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
  const [storageBackend, setStorageBackend] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCircuitBreakers = useCallback(async () => {
    try {
      const response = await orchestrationClient.listCircuitBreakers();
      setCircuitBreakers(response.circuit_breakers);
      setStorageBackend(response.storage_backend);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load circuit breakers');
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetCircuitBreaker = useCallback(async (name: string) => {
    try {
      await orchestrationClient.resetCircuitBreaker(name);
      await loadCircuitBreakers(); // Reload after reset
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to reset circuit breaker: ${name}`);
      throw err;
    }
  }, [loadCircuitBreakers]);

  useEffect(() => {
    loadCircuitBreakers();

    if (autoRefresh) {
      const interval = setInterval(loadCircuitBreakers, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadCircuitBreakers, autoRefresh, refreshInterval]);

  return {
    circuitBreakers,
    storageBackend,
    isLoading,
    error,
    refresh: loadCircuitBreakers,
    resetCircuitBreaker,
  };
}

// ============================================================================
// CONNECTION STATS HOOK
// ============================================================================

export function useConnectionStats(autoRefresh: boolean = true, refreshInterval: number = 10000) {
  const [connectionStats, setConnectionStats] = useState<ConnectionStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnectionStats = useCallback(async () => {
    try {
      const response = await orchestrationClient.getConnectionStats();
      setConnectionStats(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connection stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectionStats();

    if (autoRefresh) {
      const interval = setInterval(loadConnectionStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadConnectionStats, autoRefresh, refreshInterval]);

  return {
    connectionStats,
    isLoading,
    error,
    refresh: loadConnectionStats,
  };
}

// ============================================================================
// FEATURE STATUS HOOK
// ============================================================================

export function useFeatureStatus() {
  const [featureStatus, setFeatureStatus] = useState<FeatureStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeatureStatus = useCallback(async () => {
    try {
      const response = await orchestrationClient.getFeatureStatus();
      setFeatureStatus(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatureStatus();
  }, [loadFeatureStatus]);

  return {
    featureStatus,
    isLoading,
    error,
    refresh: loadFeatureStatus,
  };
}

// ============================================================================
// ERROR SUMMARY HOOK
// ============================================================================

export function useErrorSummary(hours: number = 24, autoRefresh: boolean = true, refreshInterval: number = 30000) {
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadErrorSummary = useCallback(async () => {
    try {
      const response = await orchestrationClient.getErrorSummary(hours);
      setErrorSummary(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error summary');
    } finally {
      setIsLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    loadErrorSummary();

    if (autoRefresh) {
      const interval = setInterval(loadErrorSummary, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadErrorSummary, autoRefresh, refreshInterval]);

  return {
    errorSummary,
    isLoading,
    error,
    refresh: loadErrorSummary,
  };
}

// ============================================================================
// COMBINED SYSTEM STATUS HOOK
// ============================================================================

export function useSystemStatus(autoRefresh: boolean = true) {
  const circuitBreakersState = useCircuitBreakers(autoRefresh);
  const connectionStatsState = useConnectionStats(autoRefresh);
  const featureStatusState = useFeatureStatus();
  const errorSummaryState = useErrorSummary(24, autoRefresh);

  const isLoading = 
    circuitBreakersState.isLoading ||
    connectionStatsState.isLoading ||
    featureStatusState.isLoading ||
    errorSummaryState.isLoading;

  const hasError = 
    circuitBreakersState.error ||
    connectionStatsState.error ||
    featureStatusState.error ||
    errorSummaryState.error;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      circuitBreakersState.refresh(),
      connectionStatsState.refresh(),
      featureStatusState.refresh(),
      errorSummaryState.refresh(),
    ]);
  }, [
    circuitBreakersState.refresh,
    connectionStatsState.refresh,
    featureStatusState.refresh,
    errorSummaryState.refresh,
  ]);

  return {
    circuitBreakers: circuitBreakersState,
    connectionStats: connectionStatsState,
    featureStatus: featureStatusState,
    errorSummary: errorSummaryState,
    isLoading,
    hasError,
    refreshAll,
  };
}
