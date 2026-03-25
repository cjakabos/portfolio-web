import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const refreshMetrics = vi.fn();

vi.mock('../hooks/useOrchestrationHooks', () => ({
  useMetrics: () => ({
    data: {
      totalRequests: 1234,
      successRate: 98.4,
      avgLatency: 212.4,
      activeOrchestrations: 7,
    },
    isLoading: false,
    refresh: refreshMetrics,
  }),
  useCircuitBreakers: () => ({
    circuitBreakers: [{ name: 'pricing', state: 'closed' }],
    isLoading: false,
    storageBackend: 'redis',
  }),
  usePendingApprovals: () => ({
    pendingApprovals: [{ request_id: 'req-1', risk_level: 'high' }],
    isLoading: false,
  }),
  useExperiments: () => ({
    experiments: [{ id: 'exp-1', experiment_id: 'exp-1', name: 'Latency guardrail', status: 'running' }],
    isLoading: false,
  }),
  useHealth: () => ({
    isHealthy: true,
    lastCheck: new Date('2026-03-17T12:00:00Z'),
  }),
  useErrorSummary: () => ({
    data: { total_errors: 2 },
  }),
}));

vi.mock('../components/StreamingInterface', () => ({
  default: () => <div>Streaming panel</div>,
}));

vi.mock('../components/ApprovalInterface', () => ({
  default: () => <div>Approval panel</div>,
}));

vi.mock('../utils/sessionUtils', () => ({
  getPersistentSessionId: () => 'monitor-session-id',
}));

import UnifiedDashboard from '../components/UnifiedDashboard';

describe('UnifiedDashboard', () => {
  it('renders the service health state and key operator counters', () => {
    render(<UnifiedDashboard />);

    expect(screen.getByText('System Healthy')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
    expect(screen.getByText('98.4%')).toBeTruthy();
    expect(screen.getByText('1 Running')).toBeTruthy();
    expect(screen.getByText('All Clear')).toBeTruthy();
    expect(screen.getByText('Pending Approvals')).toBeTruthy();
  });
});
