// =============================================================================
// Approval Client - Human-in-the-loop Service
// =============================================================================
// UPDATED: Added resume functionality and risk-based approval support
// =============================================================================

import type {
  ApprovalRequest,
  ApprovalHistoryItem,
  ApprovalDecision,
  ApprovalStats,
  ApprovalStatus,
  ApprovalType,
  RiskLevel,
  ResumeRequest,
  ResumeResponse,
  ApprovalWebSocketMessage,
} from '../types';

// Re-export types for convenience
export type { ApprovalRequest, ApprovalHistoryItem, ApprovalDecision, ApprovalStats };

class ApprovalClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Set<(message: ApprovalWebSocketMessage) => void> = new Set();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();

  constructor(baseUrl = 'http://localhost:80/ai') {
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
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Approval API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // ===========================================================================
  // Pending Approvals
  // ===========================================================================

  /**
   * Fetches all pending approval requests.
   */
  async getPendingApprovals(filters?: {
    approval_type?: ApprovalType;
    risk_level?: RiskLevel;
    min_risk_score?: number;
  }): Promise<ApprovalRequest[]> {
    const params = new URLSearchParams();
    if (filters?.approval_type) params.append('approval_type', filters.approval_type);
    if (filters?.risk_level) params.append('risk_level', filters.risk_level);
    if (filters?.min_risk_score !== undefined) params.append('min_risk_score', String(filters.min_risk_score));

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApprovalRequest[]>(`/approvals/pending${query}`);
  }

  /**
   * Gets a specific pending approval by ID.
   */
  async getPendingApproval(requestId: string): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/approvals/pending/${requestId}`);
  }

  /**
   * Gets any approval by ID (pending or processed).
   */
  async getApproval(requestId: string): Promise<ApprovalHistoryItem> {
    return this.request<ApprovalHistoryItem>(`/approvals/${requestId}`);
  }

  // ===========================================================================
  // Approval Actions
  // ===========================================================================

  /**
   * Approves a specific action by ID.
   */
  async approveAction(
    requestId: string,
    approverId: number = 1,
    notes?: string,
    modifications?: Record<string, unknown>
  ): Promise<ApprovalHistoryItem> {
    return this.request<ApprovalHistoryItem>(`/approvals/pending/${requestId}/decide`, {
      method: 'POST',
      body: JSON.stringify({
        approved: true,
        approver_id: approverId,
        approval_notes: notes,
        modifications,
      } as ApprovalDecision),
    });
  }

  /**
   * Rejects a specific action by ID with an optional reason.
   */
  async rejectAction(
    requestId: string,
    approverId: number = 1,
    reason?: string
  ): Promise<ApprovalHistoryItem> {
    return this.request<ApprovalHistoryItem>(`/approvals/pending/${requestId}/decide`, {
      method: 'POST',
      body: JSON.stringify({
        approved: false,
        approver_id: approverId,
        approval_notes: reason,
      } as ApprovalDecision),
    });
  }

  /**
   * Cancels a pending approval request.
   */
  async cancelApproval(requestId: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(`/approvals/pending/${requestId}`, {
      method: 'DELETE',
    });
  }

  // ===========================================================================
  // Resume Workflow After Approval (NEW)
  // ===========================================================================

  /**
   * Resume workflow execution after approval.
   * This is the key method for continuing workflows after WS disconnect.
   */
  async resumeAfterApproval(
    approvalId: string,
    userId: number,
    sessionId: string,
    additionalContext?: Record<string, unknown>
  ): Promise<ResumeResponse> {
    return this.request<ResumeResponse>(`/approvals/pending/${approvalId}/resume`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        additional_context: additionalContext,
      } as ResumeRequest),
    });
  }

  // ===========================================================================
  // History & Stats
  // ===========================================================================

  /**
   * Gets approval history with filters.
   */
  async getApprovalHistory(options?: {
    limit?: number;
    offset?: number;
    status?: ApprovalStatus;
    approval_type?: ApprovalType;
    include_auto_approved?: boolean;
  }): Promise<ApprovalHistoryItem[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.status) params.append('status', options.status);
    if (options?.approval_type) params.append('approval_type', options.approval_type);
    if (options?.include_auto_approved !== undefined) {
      params.append('include_auto_approved', String(options.include_auto_approved));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApprovalHistoryItem[]>(`/approvals/history${query}`);
  }

  /**
   * Gets approval statistics.
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    return this.request<ApprovalStats>('/approvals/stats');
  }

  /**
   * Health check for approval system.
   */
  async healthCheck(): Promise<{
    status: string;
    service: string;
    storage: string;
    pending_count: number;
    orchestrator_available: boolean;
  }> {
    return this.request('/approvals/health');
  }

  // ===========================================================================
  // WebSocket for Real-time Updates
  // ===========================================================================

  /**
   * Connect to approval WebSocket for real-time updates.
   */
  connectWebSocket(
    onMessage?: (message: ApprovalWebSocketMessage) => void,
    onConnectionChange?: (connected: boolean) => void
  ): WebSocket | null {
    if (onMessage) this.messageHandlers.add(onMessage);
    if (onConnectionChange) this.connectionHandlers.add(onConnectionChange);

    if (this.ws?.readyState === WebSocket.OPEN) {
      onConnectionChange?.(true);
      return this.ws;
    }

    try {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      this.ws = new WebSocket(`${wsUrl}/approvals/ws`);

      this.ws.onopen = () => {
        console.log('Approval WebSocket connected');
        this.wsReconnectAttempts = 0;
        this.connectionHandlers.forEach(handler => handler(true));

        // Send ping periodically to keep connection alive
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ApprovalWebSocketMessage;
          this.messageHandlers.forEach(handler => handler(message));
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Approval WebSocket closed:', event.code, event.reason);
        this.connectionHandlers.forEach(handler => handler(false));
        this.stopPingInterval();

        // Auto-reconnect
        if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
          this.wsReconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
          console.log(`Reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`);
          setTimeout(() => this.connectWebSocket(), delay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Approval WebSocket error:', error);
      };

      return this.ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      return null;
    }
  }

  private pingInterval: NodeJS.Timeout | null = null;

  private startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect WebSocket.
   */
  disconnectWebSocket() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }

  /**
   * Check if WebSocket is connected.
   */
  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Remove a message handler.
   */
  removeMessageHandler(handler: (message: ApprovalWebSocketMessage) => void) {
    this.messageHandlers.delete(handler);
  }

  /**
   * Remove a connection handler.
   */
  removeConnectionHandler(handler: (connected: boolean) => void) {
    this.connectionHandlers.delete(handler);
  }
}

// Export a singleton instance
export const approvalClient = new ApprovalClient();

// Also export the class for custom instances
export { ApprovalClient };