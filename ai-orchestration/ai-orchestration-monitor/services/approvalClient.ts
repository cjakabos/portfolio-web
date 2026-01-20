// =============================================================================
// Approval Client - Human-in-the-loop Service
// =============================================================================
// Handles fetching, approving, and rejecting pending actions.
// Updated to work with the AI Orchestration backend HITL system.
// =============================================================================

export type ApprovalType = 'financial' | 'ml_decision' | 'data_access' | 'workflow_branch' | 'agent_action' | 'external_api' | 'content_generation';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'timeout';
export type ApprovalMode = 'auto_low_risk' | 'auto_medium_risk_flagged' | 'human_required';

export interface ApprovalContext {
  query?: string;
  orchestration_type?: string;
  risk_score?: number;
  risk_level?: string;
  state_summary?: {
    user: string;
    type: string;
    input: string;
    steps_completed: number;
  };
  current_results?: Record<string, unknown>;
}

export interface ApprovalRequest {
  request_id: string;
  orchestration_id: string;
  node_name: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  created_at: string;
  expires_at: string;
  requester_id: number;
  approver_id?: number;
  approved_at?: string;
  proposed_action: string;
  risk_level: RiskLevel;
  context: ApprovalContext;
  approval_notes?: string;
  modifications?: Record<string, unknown>;
  approval_mode?: ApprovalMode;
  requires_post_review?: boolean;
}

export interface ApprovalDecision {
  approved: boolean;
  approver_id: number;
  approval_notes?: string;
  modifications?: Record<string, unknown>;
}

export interface ApprovalStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  expired_count: number;
  timeout_count: number;
  avg_response_time_seconds: number;
  auto_approved_count: number;
  human_approved_count: number;
}

class ApprovalClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8700') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Approval API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetches all pending approval requests.
   */
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    return this.request<ApprovalRequest[]>('/approvals/pending');
  }

  /**
   * Fetches pending approvals for a specific user.
   */
  async getPendingApprovalsForUser(userId: number): Promise<ApprovalRequest[]> {
    return this.request<ApprovalRequest[]>(`/approvals/pending?user_id=${userId}`);
  }

  /**
   * Fetches a single approval request by ID.
   */
  async getApproval(requestId: string): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/approvals/${requestId}`);
  }

  /**
   * Approves a specific action by ID.
   */
  async approveAction(
      requestId: string,
      approverId: number = 1,
      notes?: string,
      modifications?: Record<string, unknown>
    ): Promise<ApprovalRequest> {
      // FIXED: Changed endpoint to /pending/{id}/decide and added 'approved: true'
      return this.request<ApprovalRequest>(`/approvals/pending/${requestId}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          approved: true,
          approver_id: approverId,
          approval_notes: notes,
          modifications
        }),
      });
    }

  /**
   * Rejects a specific action by ID with an optional reason.
   */

  async rejectAction(
      requestId: string,
      approverId: number = 1,
      reason?: string
    ): Promise<ApprovalRequest> {
      // FIXED: Changed endpoint to /pending/{id}/decide and added 'approved: false'
      return this.request<ApprovalRequest>(`/approvals/pending/${requestId}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          approved: false,
          approver_id: approverId,
          approval_notes: reason
        }),
      });
    }

  /**
   * Cancels a pending approval request.
   */
  async cancelApproval(requestId: string): Promise<void> {
    await this.request(`/approvals/${requestId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Fetches approval history with optional filters.
   */
  async getApprovalHistory(options: {
    userId?: number;
    limit?: number;
    status?: ApprovalStatus;
  } = {}): Promise<ApprovalRequest[]> {
    const params = new URLSearchParams();
    if (options.userId) params.append('user_id', options.userId.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);

    const queryString = params.toString();
    const endpoint = `/approvals/history${queryString ? `?${queryString}` : ''}`;
    return this.request<ApprovalRequest[]>(endpoint);
  }

  /**
   * Fetches approval statistics.
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    return this.request<ApprovalStats>('/approvals/stats');
  }

  /**
   * WebSocket connection for real-time approval updates.
   */
  connectWebSocket(
    onApprovalRequest: (request: ApprovalRequest) => void,
    onApprovalUpdate: (request: ApprovalRequest) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/approvals/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'approval_request') {
          onApprovalRequest(data.data);
        } else if (data.type === 'approval_update') {
          onApprovalUpdate(data.data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    ws.onclose = () => {
      onClose?.();
    };

    return ws;
  }
}

// Export a singleton instance
export const approvalClient = new ApprovalClient();