import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Real hooks keep references stable between fetches. Preserve that contract so
// metrics effects do not interpret each render as a new server response.
const fixtures = vi.hoisted(() => {
  const hooks = {
  useMetrics: () => ({ data: { totalRequests: 1234, successRate: 98.4, avgLatency: 212.4,
    activeOrchestrations: 7, orchestrationTypes: [], capabilityUsage: [], recentExecutions: [{
      timestamp: '2026-01-01T12:00:00Z', orchestration_type: 'rag_query', capabilities_used: ['Document retrieval'], duration_ms: 321, success: true,
    }] }, isLoading: false, refresh: vi.fn() }),
  useExperiments: () => ({ experiments: [], isLoading: false, refresh: vi.fn() }),
  useExperiment: () => ({ experiment: null, refresh: vi.fn() }),
  useExperimentStats: () => ({ data: null, refresh: vi.fn() }),
  useExperimentActions: () => ({ isLoading: false }),
  useCircuitBreakers: () => ({ circuitBreakers: [{ name: 'pricing-service', state: 'open', failure_count: 3,
    success_count: 8, failure_threshold: 3, reset_timeout_seconds: 30 }], storageBackend: 'redis', isLoading: false, refresh: vi.fn() }),
  useConnectionStats: () => ({ connectionStats: [], isLoading: false, refresh: vi.fn() }),
  useFeatureStatus: () => ({ data: null, isLoading: false, refresh: vi.fn() }),
  useErrorSummary: () => ({ data: { total_errors: 3, by_category: { service_unavailable: 3 }, by_severity: { high: 3 } }, isLoading: false, refresh: vi.fn() }),
};
  return Object.fromEntries(Object.entries(hooks).map(([name, hook]) => [name, hook()]));
});
vi.mock('../hooks/useOrchestrationHooks', () => Object.fromEntries(
  Object.keys(fixtures).map(name => [name, () => fixtures[name]])
));
import ObservabilityDashboard from '../components/ObservabilityDashboard';
import ErrorDashboard from '../components/ErrorDashboard';

describe('Operator requirement dashboards', () => {
  it('renders execution activity and available request latency and success metrics', () => {
    render(<ObservabilityDashboard />);
    expect(screen.getByText('1,234')).toBeTruthy();
    expect(screen.getByText('98.4%')).toBeTruthy();
    expect(screen.getByText('rag_query')).toBeTruthy();
    expect(screen.getByText('Document retrieval')).toBeTruthy();
    expect(screen.getByText('321ms')).toBeTruthy();
  });
  it('renders service health circuit state and categorized error information', () => {
    render(<ErrorDashboard />);
    expect(screen.getByText('pricing-service')).toBeTruthy();
    expect(screen.getByText('open')).toBeTruthy();
    expect(screen.getByText('Errors by Category')).toBeTruthy();
    expect(screen.getByText('service unavailable')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
  });
});
