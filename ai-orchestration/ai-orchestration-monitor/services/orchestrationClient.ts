// =============================================================================
// OrchestrationClient - Canonical Operator Client Surface
// =============================================================================
//
// ARCHITECTURE:
// - This file is the only supported API client surface for the AI monitor.
// - AI routes are gateway-routed by default at /ai and can be overridden for
//   direct backend access in local development if needed.
// - CRUD operations for the product services go through the nginx gateway.
//
// ROUTES:
// - AI Backend (typically reached through gateway /ai):
//   - /health, /config
//   - /system/feature-status, /system/circuit-breakers, /system/connection-stats, /system/errors (admin-only)
//   - /orchestrate, /metrics, /experiments, /approvals, /tools, /rag
//   - WebSocket: ws://<gateway>/ai/ws/*
//
// - Nginx Gateway (localhost:80):
//   - /cloudapp-admin/*     → CloudApp admin monitor routes
//   - /petstore/*           → Petstore service
//   - /vehicles/*           → Vehicles service
//   - /mlops-segmentation/* → ML Pipeline service
// =============================================================================

import type {
  OrchestrationRequest,
  OrchestrationResponse,
  HealthResponse,
  Metrics,
  DetailedMetrics,
  Experiment,
  ExperimentListItem,
  ExperimentCreateRequest,
  ExperimentStats,
  VariantConfig,
  CircuitBreakerListResponse,
  ConnectionStatsResponse,
  FeatureStatus,
  ErrorSummary,
  RecentErrorsResponse,
  ToolDiscoveryResponse,
  ToolInvocationResponse,
  OllamaStatusResponse,
  CloudAppUser,
  CloudAppRoleUpdateResponse,
  CloudAppItem,
  CloudAppFile,
  Cart,
  Order,
  Note,
  CloudAppRoom,
  Employee,
  Customer,
  Pet,
  Schedule,
  Vehicle,
  Manufacturer,
  VehicleStats,
  ApprovalRequest,
  ApprovalHistoryItem,
  ApprovalStats,
  ApprovalDecision,
  ApprovalType,
  RiskLevel,
  ApprovalStatus,
  ResumeResponse,
  ApprovalWebSocketMessage,
  SegmentationCustomer,
  MLInfo,
  MLDiagnostics,
  MLSummaryStatistics,
  AuthResponse,
  WebProxyResponse,
} from '../types';
import type {
  RAGDocument,
  RAGDocumentListResponse,
  RAGDeleteResponse,
  RAGUserDeleteResponse,
  RAGQueryRequest,
  RAGQueryResponse,
  RAGStatsResponse,
  RAGHealthResponse,
  UploadJobResponse,
  UploadStatusResponse,
} from '../types/rag';

// =============================================================================
// Configuration
// =============================================================================

interface ClientConfig {
  // AI Orchestration Layer - usually gateway-routed at /ai
  aiBaseUrl: string;
  aiWsUrl: string;

  // Nginx Gateway - for other services
  gatewayUrl: string;      // http://localhost:80

  timeout: number;

  // Service paths (relative to their base URLs)
  paths: {
    // AI paths (relative to aiBaseUrl)
    ai: string;

    // Gateway paths (relative to gatewayUrl)
    cloudappAdmin: string; // /cloudapp-admin
    cloudappPublic: string; // /cloudapp
    petstore: string;      // /petstore
    vehicles: string;      // /vehicles
    mlPipeline: string;    // /mlops-segmentation
  };
}

const getConfig = (): ClientConfig => {
  // AI monitor defaults to gateway-routed AI endpoints.
  const aiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BASE_URL)
    || 'http://localhost:80';
  const aiWsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_WS_URL)
    || 'ws://localhost:80';

  // Nginx gateway for the product surfaces
  const gatewayUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    || 'http://localhost:80';

  const timeout = parseInt(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REQUEST_TIMEOUT) || '15000',
    10
  );

  return {
    aiBaseUrl,
    aiWsUrl,
    gatewayUrl,
    timeout,
    paths: {
      ai: import.meta.env?.VITE_AI_PATH || '',
      cloudappAdmin: import.meta.env?.VITE_CLOUDAPP_ADMIN_PATH || '/cloudapp-admin',
      cloudappPublic: import.meta.env?.VITE_CLOUDAPP_PUBLIC_PATH || '/cloudapp',
      petstore: import.meta.env?.VITE_PETSTORE_PATH || '/petstore',
      vehicles: import.meta.env?.VITE_VEHICLES_PATH || '/vehicles',
      mlPipeline: import.meta.env?.VITE_ML_PATH || '/mlops-segmentation',
    },
  };
};
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

// =============================================================================
// Custom Error Types
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message: string, public endpoint: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(public endpoint: string) {
    super(`Request to ${endpoint} timed out`);
    this.name = 'TimeoutError';
  }
}

// =============================================================================
// OrchestrationClient Class
// =============================================================================

export class OrchestrationClient {
  private config: ClientConfig;
  private streamWs: WebSocket | null = null;
  private approvalWs: WebSocket | null = null;
  private approvalWsReconnectAttempts = 0;
  private readonly approvalMaxReconnectAttempts = 5;
  private readonly approvalReconnectDelayMs = 1000;
  private approvalWsShouldReconnect = true;
  private approvalMessageHandlers: Set<(message: ApprovalWebSocketMessage) => void> = new Set();
  private approvalConnectionHandlers: Set<(connected: boolean) => void> = new Set();
  private approvalPingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<ClientConfig>) {
    const defaultConfig = getConfig();
    this.config = { ...defaultConfig, ...config };
  }

  // ===========================================================================
  // Core HTTP Methods
  // ===========================================================================

  private buildHeaders(
    baseHeaders?: HeadersInit,
    includeJsonContentType: boolean = true
  ): Headers {
    const headers = new Headers(baseHeaders || {});
    if (includeJsonContentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return headers;
  }

  private getRetryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
    if (retryAfterHeader) {
      const retryAfterSeconds = Number(retryAfterHeader);
      if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
      }
    }
    return Math.min(300 * (2 ** attempt), 3000);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = this.config.timeout
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          credentials: 'include',
          signal: controller.signal,
          headers: this.buildHeaders(options.headers, true),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts - 1) {
            const delayMs = this.getRetryDelayMs(attempt, response.headers.get('Retry-After'));
            await this.sleep(delayMs);
            continue;
          }

          const errorBody = await response.text();
          let details: unknown;
          try {
            details = JSON.parse(errorBody);
          } catch {
            details = errorBody;
          }
          throw new ApiError(
            `API request failed: ${response.statusText}`,
            response.status,
            url,
            details
          );
        }

        if (response.status === 204) {
          return {} as T;
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return response.json();
        }

        return {} as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxAttempts - 1) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
          throw new TimeoutError(url);
        }

        if (attempt < maxAttempts - 1) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        if (error instanceof Error) {
          throw new NetworkError(error.message, url);
        }

        throw new NetworkError('Unknown error occurred', url);
      }
    }

    throw new NetworkError('Request retries exhausted', url);
  }

  private async get<T>(url: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(url, { method: 'GET' }, timeoutMs);
  }

  private async post<T>(url: string, body?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  }

  private async put<T>(url: string, body?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  }

  private async delete<T>(url: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' }, timeoutMs);
  }

  private async postFormData<T>(
    url: string,
    formData: FormData,
    timeoutMs: number = this.config.timeout
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          signal: controller.signal,
          headers: this.buildHeaders(undefined, false),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts - 1) {
            const delayMs = this.getRetryDelayMs(attempt, response.headers.get('Retry-After'));
            await this.sleep(delayMs);
            continue;
          }

          const errorBody = await response.text();
          throw new ApiError(
            `API request failed: ${response.statusText}`,
            response.status,
            url,
            errorBody
          );
        }

        if (response.status === 204) {
          return {} as T;
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return response.json();
        }

        return {} as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxAttempts - 1) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
          throw new TimeoutError(url);
        }

        if (attempt < maxAttempts - 1) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        if (error instanceof Error) {
          throw new NetworkError(error.message, url);
        }
        throw new NetworkError('Unknown error occurred', url);
      }
    }

    throw new NetworkError('Request retries exhausted', url);
  }

  // ===========================================================================
  // URL Builders - Split between AI and Gateway
  // ===========================================================================

  /**
   * Build URL for AI Orchestration Layer (direct connection)
   * Example: http://localhost:8700/health
   */
  private aiUrl(endpoint: string): string {
    return `${this.config.aiBaseUrl}${this.config.paths.ai}${endpoint}`;
  }

  /**
   * Build URL for CloudApp service (via nginx gateway)
   * Example: http://localhost:80/cloudapp/item
   */
  private cloudappUrl(endpoint: string): string {
    return `${this.config.gatewayUrl}${this.config.paths.cloudappAdmin}${endpoint}`;
  }

  private cloudappAuthUrl(endpoint: string): string {
    return `${this.config.gatewayUrl}${this.config.paths.cloudappPublic}${endpoint}`;
  }

  /**
   * Build URL for Petstore service (via nginx gateway)
   * Example: http://localhost:80/petstore/pet
   */
  private petstoreUrl(endpoint: string): string {
    return `${this.config.gatewayUrl}${this.config.paths.petstore}${endpoint}`;
  }

  /**
   * Build URL for Vehicles service (via nginx gateway)
   * Example: http://localhost:80/vehicles/cars
   */
  private vehiclesUrl(endpoint: string): string {
    return `${this.config.gatewayUrl}${this.config.paths.vehicles}${endpoint}`;
  }

  /**
   * Build URL for ML Pipeline service (via nginx gateway)
   * Example: http://localhost:80/mlops-segmentation/getMLInfo
   */
  private mlUrl(endpoint: string): string {
    return `${this.config.gatewayUrl}${this.config.paths.mlPipeline}${endpoint}`;
  }

  // ===========================================================================
  // Health & Status (AI Backend - Direct)
  // ===========================================================================

  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>(this.aiUrl('/health'));
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(this.aiUrl('/config'));
  }

  async getFeatureStatus(): Promise<FeatureStatus> {
    return this.get<FeatureStatus>(this.aiUrl('/system/feature-status'));
  }

  // ===========================================================================
  // Core Orchestration (AI Backend - Direct)
  // ===========================================================================

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    return this.post<OrchestrationResponse>(this.aiUrl('/orchestrate'), request);
  }

  async execute(
    message: string,
    userId: number,
    sessionId: string,
    context?: Record<string, unknown>
  ): Promise<OrchestrationResponse> {
    return this.orchestrate({
      message,
      user_id: userId,
      session_id: sessionId,
      context,
    });
  }

  // ===========================================================================
  // Metrics & Observability (AI Backend - Direct)
  // ===========================================================================

  async getMetrics(): Promise<Metrics> {
    return this.get<Metrics>(this.aiUrl('/metrics'));
  }

  async getDetailedMetrics(hours: number = 24): Promise<DetailedMetrics> {
    return this.get<DetailedMetrics>(this.aiUrl(`/metrics/detailed?hours=${hours}`));
  }

  async getRecentExecutions(limit: number = 100): Promise<{ executions: unknown[]; total: number }> {
    return this.get(this.aiUrl(`/metrics/executions?limit=${limit}`));
  }

  async getTimeSeries(metric: string, hours: number = 24): Promise<unknown> {
    return this.get(this.aiUrl(`/metrics/time-series?metric=${metric}&hours=${hours}`));
  }

  // ===========================================================================
  // Circuit Breakers (AI Backend - Direct)
  // ===========================================================================

  async getCircuitBreakers(): Promise<CircuitBreakerListResponse> {
    return this.get<CircuitBreakerListResponse>(this.aiUrl('/system/circuit-breakers'));
  }

  async listCircuitBreakers(): Promise<CircuitBreakerListResponse> {
    return this.getCircuitBreakers();
  }

  async resetCircuitBreaker(name: string): Promise<{ success: boolean; message: string }> {
    return this.post(this.aiUrl(`/system/circuit-breakers/${encodeURIComponent(name)}/reset`));
  }

  // ===========================================================================
  // Connection Stats (AI Backend - Direct)
  // ===========================================================================

  async getConnectionStats(): Promise<ConnectionStatsResponse> {
    return this.get<ConnectionStatsResponse>(this.aiUrl('/system/connection-stats'));
  }

  // ===========================================================================
  // Error Summary (AI Backend - Direct)
  // ===========================================================================

  async getErrorSummary(hours: number = 24): Promise<ErrorSummary> {
    return this.get<ErrorSummary>(this.aiUrl(`/system/errors/summary?hours=${hours}`));
  }

  async getRecentErrors(limit: number = 50): Promise<RecentErrorsResponse> {
    return this.get<RecentErrorsResponse>(this.aiUrl(`/system/errors/recent?limit=${limit}`));
  }

  // ===========================================================================
  // A/B Testing Experiments (AI Backend - Direct)
  // ===========================================================================

  async getExperiments(): Promise<ExperimentListItem[]> {
    return this.get<ExperimentListItem[]>(this.aiUrl('/experiments'));
  }

  async getExperiment(experimentId: string): Promise<Experiment> {
    return this.get<Experiment>(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}`));
  }

  async createExperiment(data: ExperimentCreateRequest): Promise<Experiment> {
    return this.post<Experiment>(this.aiUrl('/experiments'), data);
  }

  async updateExperiment(experimentId: string, data: Partial<ExperimentCreateRequest>): Promise<Experiment> {
    return this.put<Experiment>(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}`), data);
  }

  async startExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/start`));
  }

  async pauseExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/pause`));
  }

  async stopExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/stop`));
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.delete(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}`));
  }

  async getVariant(experimentId: string, userId: number): Promise<VariantConfig & { assigned: boolean }> {
    return this.get(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/variant/${userId}`));
  }

  async trackImpression(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/track/impression`), { user_id: userId });
  }

  async trackConversion(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/track/conversion`), { user_id: userId });
  }

  async trackLatency(experimentId: string, userId: number, latencyMs: number): Promise<{ tracked: boolean }> {
    return this.post(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/track/latency`), {
      user_id: userId,
      latency_ms: latencyMs
    });
  }

  async trackError(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(this.aiUrl(`/experiments/${encodeURIComponent(experimentId)}/track/error`), { user_id: userId });
  }

  async getExperimentStats(): Promise<ExperimentStats> {
    return this.get<ExperimentStats>(this.aiUrl('/experiments/stats/summary'));
  }

  // ===========================================================================
  // HITL Approvals (AI Backend - Direct)
  // ===========================================================================

  async getPendingApprovals(filters?: {
    approval_type?: ApprovalType;
    risk_level?: RiskLevel;
    min_risk_score?: number;
  }): Promise<ApprovalRequest[]> {
    let url = this.aiUrl('/approvals/pending');
    const params = new URLSearchParams();
    if (filters?.approval_type) params.append('approval_type', filters.approval_type);
    if (filters?.risk_level) params.append('risk_level', filters.risk_level);
    if (filters?.min_risk_score !== undefined) {
      params.append('min_risk_score', filters.min_risk_score.toString());
    }
    if (params.toString()) url += `?${params.toString()}`;
    return this.get<ApprovalRequest[]>(url);
  }

  async getPendingApproval(requestId: string): Promise<ApprovalRequest> {
    return this.get<ApprovalRequest>(this.aiUrl(`/approvals/pending/${encodeURIComponent(requestId)}`));
  }

  async getApproval(requestId: string): Promise<ApprovalHistoryItem> {
    return this.get<ApprovalHistoryItem>(this.aiUrl(`/approvals/${encodeURIComponent(requestId)}`));
  }

  async getApprovalHistory(options?: {
    limit?: number;
    offset?: number;
    status?: ApprovalStatus;
    approval_type?: ApprovalType;
    userId?: number;
    include_auto_approved?: boolean;
  }): Promise<ApprovalHistoryItem[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.approval_type) params.append('approval_type', options.approval_type);
    if (options?.userId) params.append('user_id', options.userId.toString());
    if (options?.include_auto_approved !== undefined) {
      params.append('include_auto_approved', String(options.include_auto_approved));
    }
    const url = this.aiUrl(`/approvals/history${params.toString() ? `?${params.toString()}` : ''}`);
    return this.get<ApprovalHistoryItem[]>(url);
  }

  async createApprovalRequest(data: {
    orchestration_id: string;
    approval_type: string;
    proposed_action: string;
    risk_level: string;
    context: Record<string, unknown>;
    expires_in_seconds?: number;
  }): Promise<ApprovalRequest> {
    return this.post<ApprovalRequest>(this.aiUrl('/approvals/request'), data);
  }

  async decideApproval(requestId: string, decision: ApprovalDecision): Promise<ApprovalHistoryItem> {
    return this.post<ApprovalHistoryItem>(
      this.aiUrl(`/approvals/pending/${encodeURIComponent(requestId)}/decide`),
      decision
    );
  }

  async approveRequest(
    requestId: string,
    approverIdOrNotes?: number | string,
    notesOrModifications?: string | Record<string, unknown>,
    modifications?: Record<string, unknown>
  ): Promise<ApprovalHistoryItem> {
    const notes = typeof approverIdOrNotes === 'string'
      ? approverIdOrNotes
      : typeof notesOrModifications === 'string'
        ? notesOrModifications
        : undefined;
    const payloadModifications = typeof notesOrModifications === 'object' && notesOrModifications !== null
      ? notesOrModifications
      : modifications;
    return this.decideApproval(requestId, {
      approved: true,
      approval_notes: notes,
      modifications: payloadModifications,
    });
  }

  async rejectRequest(
    requestId: string,
    approverIdOrNotes?: number | string,
    notes?: string
  ): Promise<ApprovalHistoryItem> {
    return this.decideApproval(requestId, {
      approved: false,
      approval_notes: typeof approverIdOrNotes === 'string' ? approverIdOrNotes : notes,
    });
  }

  async cancelApproval(requestId: string): Promise<{ status: string; message: string }> {
    return this.delete(this.aiUrl(`/approvals/pending/${encodeURIComponent(requestId)}`));
  }

  async resumeApproval(
    approvalId: string,
    sessionId: string,
    additionalContext?: Record<string, unknown>
  ): Promise<ResumeResponse> {
    return this.post<ResumeResponse>(
      this.aiUrl(`/approvals/pending/${encodeURIComponent(approvalId)}/resume`),
      {
        session_id: sessionId,
        additional_context: additionalContext,
      },
    );
  }

  async getApprovalStats(): Promise<ApprovalStats> {
    return this.get<ApprovalStats>(this.aiUrl('/approvals/stats'));
  }

  async getApprovalHealth(): Promise<{
    status: string;
    service: string;
    storage: string;
    pending_count: number;
    orchestrator_available: boolean;
  }> {
    return this.get(this.aiUrl('/approvals/health'));
  }

  connectApprovalWebSocket(
    onMessage?: (message: ApprovalWebSocketMessage) => void,
    onConnectionChange?: (connected: boolean) => void
  ): WebSocket | null {
    if (onMessage) this.approvalMessageHandlers.add(onMessage);
    if (onConnectionChange) this.approvalConnectionHandlers.add(onConnectionChange);

    if (this.approvalWs?.readyState === WebSocket.OPEN) {
      onConnectionChange?.(true);
      return this.approvalWs;
    }

    this.approvalWsShouldReconnect = true;

    try {
      const wsUrl = `${this.config.aiWsUrl}${this.config.paths.ai}/approvals/ws`;
      this.approvalWs = new WebSocket(wsUrl);

      this.approvalWs.onopen = () => {
        this.approvalWsReconnectAttempts = 0;
        this.approvalConnectionHandlers.forEach((handler) => handler(true));
        this.startApprovalPingInterval();
      };

      this.approvalWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ApprovalWebSocketMessage;
          this.approvalMessageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('Failed to parse approval WebSocket message:', error);
        }
      };

      this.approvalWs.onclose = () => {
        this.approvalConnectionHandlers.forEach((handler) => handler(false));
        this.stopApprovalPingInterval();

        if (
          this.approvalWsShouldReconnect &&
          this.approvalWsReconnectAttempts < this.approvalMaxReconnectAttempts
        ) {
          this.approvalWsReconnectAttempts += 1;
          const delayMs = this.approvalReconnectDelayMs * (2 ** (this.approvalWsReconnectAttempts - 1));
          setTimeout(() => this.connectApprovalWebSocket(), delayMs);
        }
      };

      this.approvalWs.onerror = (error) => {
        console.error('Approval WebSocket error:', error);
      };

      return this.approvalWs;
    } catch (error) {
      console.error('Failed to create approval WebSocket:', error);
      return null;
    }
  }

  disconnectApprovalWebSocket(): void {
    this.approvalWsShouldReconnect = false;
    this.stopApprovalPingInterval();
    if (this.approvalWs) {
      this.approvalWs.close(1000, 'Client disconnect');
      this.approvalWs = null;
    }
    this.approvalMessageHandlers.clear();
    this.approvalConnectionHandlers.clear();
  }

  isApprovalWebSocketConnected(): boolean {
    return this.approvalWs?.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // Tools Discovery & Invocation (AI Backend - Direct)
  // ===========================================================================

  async discoverTools(): Promise<ToolDiscoveryResponse> {
    return this.get<ToolDiscoveryResponse>(this.aiUrl('/tools'));
  }

  async getOllamaStatus(): Promise<OllamaStatusResponse> {
    return this.get<OllamaStatusResponse>(this.aiUrl('/tools/ollama-status'));
  }

  async getToolsByCategory(category: string): Promise<ToolDiscoveryResponse> {
    return this.get<ToolDiscoveryResponse>(this.aiUrl(`/tools/category/${encodeURIComponent(category)}`));
  }

  async getToolInfo(toolName: string): Promise<unknown> {
    return this.get(this.aiUrl(`/tools/${encodeURIComponent(toolName)}`));
  }

  async invokeTool(toolName: string, parameters: Record<string, unknown>): Promise<ToolInvocationResponse> {
    return this.post<ToolInvocationResponse>(
      this.aiUrl(`/tools/${encodeURIComponent(toolName)}/invoke`),
      { parameters }
    );
  }

  // ===========================================================================
  // RAG (AI Backend - Direct)
  // ===========================================================================

  async uploadDocument(file: File): Promise<{ document_id: string; chunks: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.postFormData(this.aiUrl('/rag/upload'), formData);
  }

  async uploadDocumentAsync(
    file: File,
    options?: {
      userId?: number;
      tags?: string[];
      category?: string;
    }
  ): Promise<UploadJobResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.userId !== undefined) {
      formData.append('user_id', options.userId.toString());
    }
    if (options?.tags?.length) {
      formData.append('tags', options.tags.join(','));
    }
    if (options?.category) {
      formData.append('category', options.category);
    }

    return this.postFormData<UploadJobResponse>(
      this.aiUrl('/rag/documents/upload'),
      formData,
      60000,
    );
  }

  async getRAGUploadStatus(jobId: string): Promise<UploadStatusResponse> {
    return this.get<UploadStatusResponse>(
      this.aiUrl(`/rag/documents/upload/status/${encodeURIComponent(jobId)}`),
      10000,
    );
  }

  async listRAGUploadJobs(limit: number = 50): Promise<UploadJobResponse[]> {
    return this.get<UploadJobResponse[]>(
      this.aiUrl(`/rag/documents/upload/jobs?limit=${limit}`),
      10000,
    );
  }

  async listRAGDocuments(options?: {
    userId?: number;
    limit?: number;
  }): Promise<RAGDocumentListResponse> {
    const params = new URLSearchParams();
    if (options?.userId !== undefined) {
      params.append('user_id', options.userId.toString());
    }
    if (options?.limit !== undefined) {
      params.append('limit', options.limit.toString());
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.get<RAGDocumentListResponse>(this.aiUrl(`/rag/documents${suffix}`));
  }

  async getRAGDocument(docId: string): Promise<RAGDocument> {
    return this.get<RAGDocument>(this.aiUrl(`/rag/documents/${encodeURIComponent(docId)}`));
  }

  async deleteRAGDocument(docId: string): Promise<RAGDeleteResponse> {
    return this.delete<RAGDeleteResponse>(this.aiUrl(`/rag/documents/${encodeURIComponent(docId)}`));
  }

  async deleteRAGUserDocuments(userId: number): Promise<RAGUserDeleteResponse> {
    return this.delete<RAGUserDeleteResponse>(this.aiUrl(`/rag/documents/user/${userId}`));
  }

  async queryRAG(request: string | RAGQueryRequest, k: number = 3): Promise<RAGQueryResponse> {
    const payload = typeof request === 'string'
      ? { query: request, top_k: k }
      : request;
    return this.post<RAGQueryResponse>(this.aiUrl('/rag/query'), payload);
  }

  async getRAGStats(): Promise<RAGStatsResponse> {
    return this.get<RAGStatsResponse>(this.aiUrl('/rag/stats'), 10000);
  }

  async getRAGHealth(): Promise<RAGHealthResponse> {
    return this.get<RAGHealthResponse>(this.aiUrl('/rag/health'), 10000);
  }

  // ===========================================================================
  // Streaming (WebSocket - Direct to AI Backend)
  // ===========================================================================

  connectWebSocket(
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): WebSocket {
    // WebSocket connects directly to AI backend
    const wsUrl = `${this.config.aiWsUrl}/ws/stream`;
    this.streamWs = new WebSocket(wsUrl);

    this.streamWs.onopen = () => {};

    this.streamWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage(event.data);
      }
    };

    this.streamWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    this.streamWs.onclose = () => {
      onClose?.();
    };

    return this.streamWs;
  }

  sendWebSocketMessage(
    message: string,
    userId: number,
    sessionId: string,
    context?: Record<string, unknown>
  ): void {
    if (this.streamWs && this.streamWs.readyState === WebSocket.OPEN) {
      this.streamWs.send(JSON.stringify({
        message,
        request_id: `req_${Date.now()}`,
        user_id: userId,
        session_id: sessionId,
        context,
      }));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  closeWebSocket(): void {
    if (this.streamWs) {
      this.streamWs.close();
      this.streamWs = null;
    }
  }

  isWebSocketConnected(): boolean {
    return this.streamWs !== null && this.streamWs.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // CloudApp Service - Users (via Nginx Gateway)
  // ===========================================================================

  async getCloudAppSession(): Promise<AuthResponse> {
    return this.get<AuthResponse>(this.cloudappAuthUrl('/user/auth-check'));
  }

  async getCloudAppAdminSession(): Promise<AuthResponse> {
    return this.get<AuthResponse>(this.cloudappAuthUrl('/user/admin/auth-check'));
  }

  private async getCloudAppCsrfHeaders(): Promise<Record<string, string>> {
    const response = await this.get<{ token?: string; headerName?: string }>(this.cloudappAuthUrl('/user/csrf-token'));
    const token = typeof response.token === 'string' ? response.token.trim() : '';
    const headerName = typeof response.headerName === 'string' ? response.headerName.trim() : 'X-XSRF-TOKEN';
    if (!token) {
      return {};
    }
    return { [headerName]: token };
  }

  async listCloudAppUsers(): Promise<string[]> {
    const response = await this.get<string[] | { users: string[] }>(this.cloudappUrl('/user/admin/users'));
    return Array.isArray(response) ? response : response.users || [];
  }

  async getCloudAppUser(username: string): Promise<CloudAppUser> {
    return this.get<CloudAppUser>(this.cloudappUrl(`/user/${encodeURIComponent(username)}`));
  }

  async getCloudAppUserById(userId: number): Promise<CloudAppUser> {
    return this.get<CloudAppUser>(this.cloudappUrl(`/user/id/${userId}`));
  }

  async createCloudAppUser(username: string, password: string): Promise<CloudAppUser> {
    return this.post<CloudAppUser>(this.cloudappUrl('/user/create'), { username, password });
  }

  async registerCloudAppUser(username: string, password: string, confirmPassword: string = password): Promise<CloudAppUser> {
    return this.post<CloudAppUser>(this.cloudappUrl('/user/user-register'), {
      username,
      password,
      confirmPassword,
    });
  }

  async updateCloudAppUserRoles(username: string, roles: string[]): Promise<CloudAppRoleUpdateResponse> {
    return this.post<CloudAppRoleUpdateResponse>(this.cloudappUrl('/user/admin/roles'), {
      username,
      roles,
    });
  }

  async promoteCloudAppUserToAdmin(username: string): Promise<CloudAppRoleUpdateResponse> {
    return this.updateCloudAppUserRoles(username, ['ROLE_USER', 'ROLE_ADMIN']);
  }

  async createCloudAppAdmin(username: string, password: string, confirmPassword: string = password): Promise<CloudAppRoleUpdateResponse> {
    await this.registerCloudAppUser(username, password, confirmPassword);
    return this.promoteCloudAppUserToAdmin(username);
  }

  async loginUser(username: string, password: string): Promise<AuthResponse> {
    const url = this.cloudappAuthUrl('/user/user-login');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
        headers: this.buildHeaders(undefined, true),
        body: JSON.stringify({ username, password }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          url,
          errorBody
        );
      }
      const session = await this.getCloudAppAdminSession();
      return {
        ...session,
        message: 'Login successful',
        success: true,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(url);
      }
      if (error instanceof Error) {
        throw new NetworkError(error.message, url);
      }
      throw new NetworkError('Unknown error occurred', url);
    }
  }

  async logoutUser(): Promise<void> {
    const headers = await this.getCloudAppCsrfHeaders();
    await this.request<void>(this.cloudappAuthUrl('/user/user-logout'), {
      method: 'POST',
      headers,
    });
  }

  // ===========================================================================
  // CloudApp Service - Items (via Nginx Gateway)
  // ===========================================================================

  async getItems(): Promise<CloudAppItem[]> {
    const response = await this.get<CloudAppItem[] | { items: CloudAppItem[] }>(this.cloudappUrl('/item'));
    return Array.isArray(response) ? response : response.items || [];
  }

  async getItemById(itemId: number): Promise<CloudAppItem> {
    return this.get<CloudAppItem>(this.cloudappUrl(`/item/${itemId}`));
  }

  async searchItemsByName(name: string): Promise<CloudAppItem[]> {
    const response = await this.get<CloudAppItem[] | { items: CloudAppItem[] }>(
      this.cloudappUrl(`/item/name/${encodeURIComponent(name)}`)
    );
    return Array.isArray(response) ? response : response.items || [];
  }

  async createItem(name: string, price: number, description?: string): Promise<CloudAppItem> {
    return this.post<CloudAppItem>(this.cloudappUrl('/item'), { name, price, description });
  }

  // ===========================================================================
  // CloudApp Service - Cart (via Nginx Gateway)
  // ===========================================================================

  async getCart(username: string): Promise<Cart> {
    type CloudAppCartItemResponse = {
      id?: number;
      name?: string;
      price?: number | string;
    };

    const response = await this.post<{ items?: CloudAppCartItemResponse[]; total?: number }>(
      this.cloudappUrl('/cart/getCart'),
      { username }
    );

    const items = (response.items || []).map((item) => ({
      itemId: item.id || 0,
      itemName: item.name || '',
      quantity: 1,
      price: typeof item.price === 'number'
        ? item.price
        : parseFloat(item.price || '0') || 0,
    }));

    return {
      items,
      total: response.total || items.reduce((sum, item) => sum + item.price, 0),
    };
  }

  async addToCart(username: string, itemId: number, quantity: number = 1): Promise<Cart> {
    await this.post(this.cloudappUrl('/cart/addToCart'), { username, itemId, quantity });
    return this.getCart(username);
  }

  async removeFromCart(username: string, itemId: number, quantity: number = 1): Promise<Cart> {
    await this.post(this.cloudappUrl('/cart/removeFromCart'), { username, itemId, quantity });
    return this.getCart(username);
  }

  async clearCart(username: string): Promise<void> {
    await this.post(this.cloudappUrl('/cart/clearCart'), { username });
  }

  // ===========================================================================
  // CloudApp Service - Orders (via Nginx Gateway)
  // ===========================================================================

  async getOrderHistory(username: string): Promise<Order[]> {
    const response = await this.get<Order[] | { orders: Order[] }>(
      this.cloudappUrl(`/order/history/${encodeURIComponent(username)}`)
    );
    return Array.isArray(response) ? response : response.orders || [];
  }

  async submitOrder(username: string): Promise<Order> {
    return this.post<Order>(this.cloudappUrl('/order/submit'), { username });
  }

  async getOrderById(orderId: number): Promise<Order> {
    return this.get<Order>(this.cloudappUrl(`/order/id/${orderId}`));
  }

  // ===========================================================================
  // CloudApp Service - Notes (via Nginx Gateway)
  // ===========================================================================

  async getUserNotes(username: string): Promise<Note[]> {
    const response = await this.get<Note[] | { notes: Note[] }>(
      this.cloudappUrl(`/note/user/${encodeURIComponent(username)}`)
    );
    return Array.isArray(response) ? response : response.notes || [];
  }

  async addNote(username: string, title: string, description: string): Promise<Note> {
    return this.post<Note>(this.cloudappUrl('/note/addNote'), { username, title, description });
  }

  async updateNote(noteId: number, title: string, description: string): Promise<Note> {
    return this.put<Note>(this.cloudappUrl(`/note/${noteId}`), { title, description });
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.delete(this.cloudappUrl(`/note/${noteId}`));
  }

  // ===========================================================================
  // CloudApp Service - Rooms (via Nginx Gateway)
  // ===========================================================================

  async createRoom(name: string, username: string): Promise<CloudAppRoom> {
    return this.post<CloudAppRoom>(this.cloudappUrl('/room'), { name, username });
  }

  async getRoomByCode(code: string): Promise<CloudAppRoom> {
    return this.get<CloudAppRoom>(this.cloudappUrl(`/room/${encodeURIComponent(code)}`));
  }

  async getUserRooms(username: string): Promise<CloudAppRoom[]> {
    const response = await this.get<CloudAppRoom[] | { rooms: CloudAppRoom[] }>(
      this.cloudappUrl(`/room/user/${encodeURIComponent(username)}`)
    );
    return Array.isArray(response) ? response : response.rooms || [];
  }

  async deleteRoom(roomId: number): Promise<void> {
    await this.delete(this.cloudappUrl(`/room/${roomId}`));
  }

  // ===========================================================================
  // CloudApp Service - Files (via Nginx Gateway)
  // ===========================================================================

  async getUserFiles(username: string): Promise<CloudAppFile[]> {
    const response = await this.get<CloudAppFile[] | { files: CloudAppFile[] }>(
      this.cloudappUrl(`/file/user/${encodeURIComponent(username)}`)
    );
    return Array.isArray(response) ? response : response.files || [];
  }

  async getFile(fileId: number): Promise<Blob> {
    const url = this.cloudappUrl(`/file/get-file/${fileId}`);
    const response = await fetch(url, {
      headers: this.buildHeaders(undefined, false),
    });
    if (!response.ok) {
      throw new ApiError('Failed to download file', response.status, url);
    }
    return response.blob();
  }

  async uploadFile(username: string, file: File): Promise<CloudAppFile> {
    const formData = new FormData();
    formData.append('fileUpload', file);
    formData.append('username', username);
    return this.postFormData<CloudAppFile>(this.cloudappUrl('/file/upload'), formData);
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.get(this.cloudappUrl(`/file/delete-file/${fileId}`));
  }

  // ===========================================================================
  // Petstore Service - Employees (via Nginx Gateway)
  // ===========================================================================

  async getEmployees(): Promise<Employee[]> {
    const response = await this.get<Employee[] | { employees: Employee[] }>(
      this.petstoreUrl('/user/employee')
    );
    return Array.isArray(response) ? response : response.employees || [];
  }

  async getEmployeeById(employeeId: number): Promise<Employee> {
    return this.get<Employee>(this.petstoreUrl(`/user/employee/${employeeId}`));
  }

  async createEmployee(name: string, skills: string[], daysAvailable: string[]): Promise<Employee> {
    return this.post<Employee>(this.petstoreUrl('/user/employee'), { name, skills, daysAvailable });
  }

  async setEmployeeAvailability(employeeId: number, daysAvailable: string[]): Promise<void> {
    await this.put(this.petstoreUrl(`/user/employee/${employeeId}/availability`), { daysAvailable });
  }

  async findAvailableEmployees(skills: string[], date: string): Promise<Employee[]> {
    const response = await this.post<Employee[] | { employees: Employee[] }>(
      this.petstoreUrl('/user/employee/availability'),
      { skills, date }
    );
    return Array.isArray(response) ? response : response.employees || [];
  }

  async deleteEmployee(employeeId: number): Promise<void> {
    await this.delete(this.petstoreUrl(`/user/employee/${employeeId}`));
  }

  // ===========================================================================
  // Petstore Service - Customers (via Nginx Gateway)
  // ===========================================================================

  async getCustomers(): Promise<Customer[]> {
    const response = await this.get<Customer[] | { customers: Customer[] }>(
      this.petstoreUrl('/user/customer')
    );
    return Array.isArray(response) ? response : response.customers || [];
  }

  async getCustomerById(customerId: number): Promise<Customer> {
    return this.get<Customer>(this.petstoreUrl(`/user/customer/${customerId}`));
  }

  async getCustomerByPet(petId: number): Promise<Customer> {
    return this.get<Customer>(this.petstoreUrl(`/user/customer/pet/${petId}`));
  }

  async createCustomer(
    customerOrName: {
      name: string;
      phoneNumber: string;
      notes?: string;
      petIds?: number[];
    } | string,
    phoneNumber?: string,
    notes?: string
  ): Promise<Customer> {
    const customer = typeof customerOrName === 'string'
      ? { name: customerOrName, phoneNumber: phoneNumber || '', notes }
      : customerOrName;
    return this.post<Customer>(this.petstoreUrl('/user/customer'), customer);
  }

  async updateCustomer(customerId: number, updates: Partial<Customer>): Promise<Customer> {
    return this.put<Customer>(this.petstoreUrl(`/user/customer/${customerId}`), updates);
  }

  async deleteCustomer(customerId: number): Promise<void> {
    await this.delete(this.petstoreUrl(`/user/customer/${customerId}`));
  }

  // ===========================================================================
  // Petstore Service - Pets (via Nginx Gateway)
  // ===========================================================================

  async getPets(): Promise<Pet[]> {
    const response = await this.get<Pet[] | { pets: Pet[] }>(this.petstoreUrl('/pet'));
    return Array.isArray(response) ? response : response.pets || [];
  }

  async getPetById(petId: number): Promise<Pet> {
    return this.get<Pet>(this.petstoreUrl(`/pet/${petId}`));
  }

  async createPet(
    type: string,
    name: string,
    ownerId: number,
    birthDate?: string,
    notes?: string
  ): Promise<Pet> {
    return this.post<Pet>(this.petstoreUrl('/pet'), { type, name, ownerId, birthDate, notes });
  }

  async updatePet(petId: number, updates: Partial<Pet>): Promise<Pet> {
    return this.put<Pet>(this.petstoreUrl(`/pet/${petId}`), updates);
  }

  async getPetsByOwner(ownerId: number): Promise<Pet[]> {
    const response = await this.get<Pet[] | { pets: Pet[] }>(
      this.petstoreUrl(`/pet/owner/${ownerId}`)
    );
    return Array.isArray(response) ? response : response.pets || [];
  }

  async deletePet(petId: number): Promise<void> {
    await this.delete(this.petstoreUrl(`/pet/${petId}`));
  }

  // ===========================================================================
  // Petstore Service - Schedules (via Nginx Gateway)
  // ===========================================================================

  async getSchedules(): Promise<Schedule[]> {
    const response = await this.get<Schedule[] | { schedules: Schedule[] }>(
      this.petstoreUrl('/schedule')
    );
    return Array.isArray(response) ? response : response.schedules || [];
  }

  async createSchedule(
    date: string,
    employeeIds: number[],
    petIds: number[],
    activities: string[]
  ): Promise<Schedule> {
    return this.post<Schedule>(this.petstoreUrl('/schedule'), { date, employeeIds, petIds, activities });
  }

  async getEmployeeSchedule(employeeId: number): Promise<Schedule[]> {
    const response = await this.get<Schedule[] | { schedules: Schedule[] }>(
      this.petstoreUrl(`/schedule/employee/${employeeId}`)
    );
    return Array.isArray(response) ? response : response.schedules || [];
  }

  async getCustomerSchedule(customerId: number): Promise<Schedule[]> {
    const response = await this.get<Schedule[] | { schedules: Schedule[] }>(
      this.petstoreUrl(`/schedule/customer/${customerId}`)
    );
    return Array.isArray(response) ? response : response.schedules || [];
  }

  async getPetSchedule(petId: number): Promise<Schedule[]> {
    const response = await this.get<Schedule[] | { schedules: Schedule[] }>(
      this.petstoreUrl(`/schedule/pet/${petId}`)
    );
    return Array.isArray(response) ? response : response.schedules || [];
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    await this.delete(this.petstoreUrl(`/schedule/${scheduleId}`));
  }

  // ===========================================================================
  // Vehicles Service (via Nginx Gateway)
  // ===========================================================================

  async getVehicles(): Promise<Vehicle[]> {
    const response = await this.get<Vehicle[] | { vehicles: Vehicle[] }>(this.vehiclesUrl('/cars'));
    return Array.isArray(response) ? response : response.vehicles || [];
  }

  async getVehicleById(vehicleId: number): Promise<Vehicle> {
    return this.get<Vehicle>(this.vehiclesUrl(`/cars/${vehicleId}`));
  }

  async searchVehicles(params: {
    manufacturer?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    minYear?: number;
    maxYear?: number;
  }): Promise<Vehicle[]> {
    const searchParams = new URLSearchParams();
    if (params.manufacturer) searchParams.append('manufacturer', params.manufacturer);
    if (params.condition) searchParams.append('condition', params.condition);
    if (params.minPrice) searchParams.append('min_price', params.minPrice.toString());
    if (params.maxPrice) searchParams.append('max_price', params.maxPrice.toString());
    if (params.minYear) searchParams.append('min_year', params.minYear.toString());
    if (params.maxYear) searchParams.append('max_year', params.maxYear.toString());

    const response = await this.get<Vehicle[] | { vehicles: Vehicle[] }>(
      this.vehiclesUrl(`/cars/search?${searchParams.toString()}`)
    );
    return Array.isArray(response) ? response : response.vehicles || [];
  }

  // Additional vehicle search methods for useVehicles hook
  async searchVehiclesByMake(make: string): Promise<Vehicle[]> {
    return this.searchVehicles({ manufacturer: make });
  }

  async searchVehiclesByModel(model: string): Promise<Vehicle[]> {
    // Note: Backend may not support model-specific search, this filters client-side
    const vehicles = await this.getVehicles();
    return vehicles.filter(v =>
      v.details.model?.toLowerCase().includes(model.toLowerCase())
    );
  }

  async searchVehiclesByYear(year: number): Promise<Vehicle[]> {
    return this.searchVehicles({ minYear: year, maxYear: year });
  }

  async searchVehiclesByPriceRange(minPrice: number, maxPrice: number): Promise<Vehicle[]> {
    return this.searchVehicles({ minPrice, maxPrice });
  }

  async createVehicle(vehicle: Pick<Vehicle, 'condition' | 'details' | 'location'>): Promise<Vehicle> {
    return this.post<Vehicle>(this.vehiclesUrl('/cars'), vehicle);
  }

  async updateVehicle(vehicleId: number, updates: Partial<Vehicle>): Promise<Vehicle> {
    return this.put<Vehicle>(this.vehiclesUrl(`/cars/${vehicleId}`), updates);
  }

  async deleteVehicle(vehicleId: number): Promise<void> {
    await this.delete(this.vehiclesUrl(`/cars/${vehicleId}`));
  }

  async getManufacturers(): Promise<Manufacturer[]> {
    const response = await this.get<Manufacturer[] | { manufacturers: Manufacturer[] }>(
      this.vehiclesUrl('/manufacturers')
    );
    return Array.isArray(response) ? response : response.manufacturers || [];
  }

  async getVehicleStats(): Promise<VehicleStats> {
    const response = await this.get<VehicleStats | { stats: VehicleStats }>(
      this.vehiclesUrl('/stats')
    );
    return (response as { stats?: VehicleStats }).stats ?? (response as VehicleStats);
  }

  // ===========================================================================
  // ML Pipeline Service (via Nginx Gateway)
  // ===========================================================================

  async getSegmentationCustomers(): Promise<SegmentationCustomer[]> {
    return this.get<SegmentationCustomer[]>(this.mlUrl('/getSegmentationCustomers'));
  }

  async getMLInfo(sampleSize: number = -2): Promise<MLInfo> {
    return this.post<MLInfo>(this.mlUrl('/getMLInfo'), { sampleSize });
  }

  async getMLDiagnostics(): Promise<MLDiagnostics> {
    return this.get<MLDiagnostics>(this.mlUrl('/diagnostics'));
  }

  async addSegmentationCustomer(
    gender: string,
    age: number,
    annualIncome: number,
    spendingScore: number
  ): Promise<SegmentationCustomer> {
    return this.post<SegmentationCustomer>(this.mlUrl('/addCustomer'), {
      fields: {
        gender,
        age,
        annual_income: annualIncome,
        spending_score: spendingScore,
      },
    });
  }

  async getModelPredictions(filepath: string): Promise<number[]> {
    return this.post<number[]>(this.mlUrl('/prediction'), { filepath });
  }

  async getModelScore(): Promise<{ score: number }> {
    const response = await this.get<string>(this.mlUrl('/scoring'));
    const match = typeof response === 'string' ? response.match(/[\d.]+/) : null;
    return { score: match ? parseFloat(match[0]) : 0 };
  }

  async getSummaryStatistics(): Promise<MLSummaryStatistics> {
    return this.get<MLSummaryStatistics>(this.mlUrl('/summarystats'));
  }

  async ingestMLData(fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(this.mlUrl('/ingest'), { fields });
  }

  // ===========================================================================
  // Web Proxy Service (via Nginx Gateway)
  // ===========================================================================

  async proxyGet(webDomain: string, webApiKey: string): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>(this.cloudappUrl('/webDomain/get'), { webDomain, webApiKey });
  }

  async proxyPost(webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>(this.cloudappUrl('/webDomain/post'), { webDomain, webApiKey, ...body });
  }

  async proxyPut(webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> {
    return this.put<WebProxyResponse>(this.cloudappUrl('/webDomain/put'), { webDomain, webApiKey, ...body });
  }

  async proxyDelete(webDomain: string, webApiKey: string): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>(this.cloudappUrl('/webDomain/delete'), { webDomain, webApiKey });
  }

  private startApprovalPingInterval(): void {
    this.stopApprovalPingInterval();
    this.approvalPingInterval = setInterval(() => {
      if (this.approvalWs?.readyState === WebSocket.OPEN) {
        this.approvalWs.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopApprovalPingInterval(): void {
    if (this.approvalPingInterval) {
      clearInterval(this.approvalPingInterval);
      this.approvalPingInterval = null;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const orchestrationClient = new OrchestrationClient();
