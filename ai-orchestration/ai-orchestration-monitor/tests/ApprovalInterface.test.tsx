import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { orchestrationClientMock } = vi.hoisted(() => ({
  orchestrationClientMock: {
    getPendingApprovals: vi.fn(),
    getApprovalHistory: vi.fn(),
    connectApprovalWebSocket: vi.fn(),
    disconnectApprovalWebSocket: vi.fn(),
    rejectRequest: vi.fn(),
    approveRequest: vi.fn(),
    resumeApproval: vi.fn(),
  },
}));

vi.mock('../services/orchestrationClient', () => ({
  orchestrationClient: orchestrationClientMock,
}));

vi.mock('../utils/sessionUtils', () => ({
  getPersistentSessionId: () => 'persisted-session-id',
}));

import ApprovalInterface from '../components/ApprovalInterface';

describe('ApprovalInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orchestrationClientMock.getApprovalHistory.mockResolvedValue([]);
    orchestrationClientMock.connectApprovalWebSocket.mockImplementation((_, onConnectionChange) => {
      onConnectionChange?.(true);
      return null;
    });
  });

  it('approves and resumes a pending approval from the operator workflow', async () => {
    orchestrationClientMock.getPendingApprovals.mockResolvedValue([
      {
        request_id: 'req-approval-123456',
        orchestration_id: 'orch-1',
        requester_id: 99,
        approval_type: 'delete_order',
        proposed_action: 'Delete order #42',
        risk_level: 'high',
        risk_score: 0.82,
        risk_factors: ['destructive_action'],
        created_at: '2026-03-17T10:00:00Z',
        expires_at: '2026-03-17T10:15:00Z',
        context: {
          session_id: 'session-from-context',
          state_summary: {
            session_id: 'session-from-context',
          },
        },
        execution_context: {
          step: 'delete_order',
        },
      },
    ]);
    orchestrationClientMock.approveRequest.mockResolvedValue({ status: 'approved' });
    orchestrationClientMock.resumeApproval.mockResolvedValue({
      status: 'completed',
      session_id: 'session-from-context',
    });

    const user = userEvent.setup();
    render(<ApprovalInterface />);

    await user.click(await screen.findByRole('button', { name: /delete order/i }));
    await user.click(screen.getByRole('button', { name: /approve & resume/i }));

    await waitFor(() => {
      expect(orchestrationClientMock.approveRequest).toHaveBeenCalledWith(
        'req-approval-123456',
        'Approved and resumed'
      );
    });

    expect(orchestrationClientMock.resumeApproval).toHaveBeenCalledWith(
      'req-approval-123456',
      'session-from-context'
    );
    expect(await screen.findByText('Workflow resumed and completed successfully!')).toBeTruthy();
  });
});
