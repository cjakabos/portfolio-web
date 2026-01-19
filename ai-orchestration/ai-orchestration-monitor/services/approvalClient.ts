// =============================================================================
// Approval Client - Human-in-the-loop Service
// =============================================================================
// Handles fetching, approving, and rejecting pending actions.
// =============================================================================

export interface ApprovalRequest {
  request_id: string;
  action_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  description?: string;
  payload?: Record<string, any>;
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
      throw new Error(`Approval API Error: ${response.statusText}`);
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
   * Approves a specific action by ID.
   */
  async approveAction(requestId: string): Promise<void> {
    await this.request(`/approvals/${requestId}/approve`, {
      method: 'POST',
    });
  }

  /**
   * Rejects a specific action by ID with an optional reason.
   */
  async rejectAction(requestId: string, reason?: string): Promise<void> {
    await this.request(`/approvals/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}

// Export a singleton instance
export const approvalClient = new ApprovalClient();