// =============================================================================
// OrchestrationClient - API Service Layer (Split Gateway Configuration)
// =============================================================================
//
// ARCHITECTURE:
// - AI/Agentic operations go directly to ai-orchestration-layer (port 8700)
// - CRUD operations go through nginx gateway (port 80)
//
// ROUTES:
// - AI Backend (localhost:8700):
//   - /health, /config
//   - /system/feature-status, /system/circuit-breakers, /system/connection-stats, /system/errors (admin-only)
//   - /orchestrate, /metrics, /experiments, /approvals, /tools, /rag
//   - WebSocket: ws://localhost:8700/ws/*
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
  SegmentationCustomer,
  MLInfo,
  MLDiagnostics,
  MLSummaryStatistics,
  AuthResponse,
  WebProxyResponse,
} from '../types';

// =============================================================================
// Configuration
// =============================================================================

interface ClientConfig {
  // AI Orchestration Layer - direct connection
  aiBaseUrl: string;       // http://localhost:8700
  aiWsUrl: string;         // ws://localhost:8700

  // Nginx Gateway - for other services
  gatewayUrl: string;      // http://localhost:80

  timeout: number;

  // Service paths (relative to their base URLs)
  paths: {
    // AI paths (relative to aiBaseUrl)
    ai: string;            // '' (root) or '/api'

    // Gateway paths (relative to gatewayUrl)
    cloudapp: string;      // /cloudapp-admin
    petstore: string;      // /petstore
    vehicles: string;      // /vehicles
    mlPipeline: string;    // /mlops-segmentation
  };
}

const getConfig = (): ClientConfig => {
  // AI Orchestration Layer - direct connection (not through nginx)
  const aiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BASE_URL)
    || 'http://localhost:80';
  const aiWsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_WS_URL)
    || 'ws://localhost:80';

  // Nginx gateway for other services
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
      ai: import.meta.env?.VITE_AI_PATH || '',  // AI endpoints are at root of aiBaseUrl
      cloudapp: import.meta.env?.VITE_CLOUDAPP_PATH || '/cloudapp-admin',
      petstore: import.meta.env?.VITE_PETSTORE_PATH || '/petstore',
      vehicles: import.meta.env?.VITE_VEHICLES_PATH || '/vehicles',
      mlPipeline: import.meta.env?.VITE_ML_PATH || '/mlops-segmentation',
    },
  };
};

const CLOUDAPP_TOKEN_STORAGE_KEY = 'AI_MONITOR_CLOUDAPP_TOKEN';
const CLOUDAPP_USERNAME_STORAGE_KEY = 'AI_MONITOR_CLOUDAPP_USERNAME';
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const BEARER_PREFIX = 'Bearer ';

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
  private ws: WebSocket | null = null;

  constructor(config?: Partial<ClientConfig>) {
    const defaultConfig = getConfig();
    this.config = { ...defaultConfig, ...config };
  }

  // ===========================================================================
  // Core HTTP Methods
  // ===========================================================================

  private getStoredCloudAppToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const token = localStorage.getItem(CLOUDAPP_TOKEN_STORAGE_KEY);
    return token?.trim() || null;
  }

  private getStoredCloudAppUsername(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const username = localStorage.getItem(CLOUDAPP_USERNAME_STORAGE_KEY);
    return username?.trim() || null;
  }

  private storeCloudAppAuth(token: string, username: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(CLOUDAPP_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(CLOUDAPP_USERNAME_STORAGE_KEY, username);
  }

  private normalizeAuthorizationToken(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.startsWith(BEARER_PREFIX) ? trimmed : `${BEARER_PREFIX}${trimmed}`;
  }

  private buildHeaders(
    baseHeaders?: HeadersInit,
    includeJsonContentType: boolean = true
  ): Headers {
    const headers = new Headers(baseHeaders || {});
    if (includeJsonContentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getStoredCloudAppToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', token);
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
    options: RequestInit = {}
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          ...options,
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

  private async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' });
  }

  private async post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async put<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  private async postFormData<T>(url: string, formData: FormData): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
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
    return `${this.config.gatewayUrl}${this.config.paths.cloudapp}${endpoint}`;
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
    approval_type?: string;
    risk_level?: string
  }): Promise<ApprovalRequest[]> {
    let url = this.aiUrl('/approvals/pending');
    const params = new URLSearchParams();
    if (filters?.approval_type) params.append('approval_type', filters.approval_type);
    if (filters?.risk_level) params.append('risk_level', filters.risk_level);
    if (params.toString()) url += `?${params.toString()}`;
    return this.get<ApprovalRequest[]>(url);
  }

  async getPendingApproval(requestId: string): Promise<ApprovalRequest> {
    return this.get<ApprovalRequest>(this.aiUrl(`/approvals/pending/${encodeURIComponent(requestId)}`));
  }

  async getApprovalHistory(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    approval_type?: string;
  }): Promise<ApprovalHistoryItem[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.approval_type) params.append('approval_type', options.approval_type);
    const url = this.aiUrl(`/approvals/history${params.toString() ? `?${params.toString()}` : ''}`);
    return this.get<ApprovalHistoryItem[]>(url);
  }

  async createApprovalRequest(data: {
    orchestration_id: string;
    approval_type: string;
    proposed_action: string;
    risk_level: string;
    requester_id: number;
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

  async approveRequest(requestId: string, approverId: number, notes?: string): Promise<ApprovalHistoryItem> {
    return this.decideApproval(requestId, {
      approved: true,
      approver_id: approverId,
      approval_notes: notes,
    });
  }

  async rejectRequest(requestId: string, approverId: number, notes?: string): Promise<ApprovalHistoryItem> {
    return this.decideApproval(requestId, {
      approved: false,
      approver_id: approverId,
      approval_notes: notes,
    });
  }

  async cancelApproval(requestId: string): Promise<{ status: string; message: string }> {
    return this.delete(this.aiUrl(`/approvals/pending/${encodeURIComponent(requestId)}`));
  }

  async getApprovalStats(): Promise<ApprovalStats> {
    return this.get<ApprovalStats>(this.aiUrl('/approvals/stats'));
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

  async queryRAG(query: string, k: number = 3): Promise<{ answer: string; sources: unknown[] }> {
    return this.post(this.aiUrl('/rag/query'), { query, k });
  }

  async getRAGStats(): Promise<unknown> {
    return this.get(this.aiUrl('/rag/stats'));
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
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected to', wsUrl);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage(event.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      onClose?.();
    };

    return this.ws;
  }

  sendWebSocketMessage(
    message: string,
    userId: number,
    sessionId: string,
    context?: Record<string, unknown>
  ): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // CloudApp Service - Users (via Nginx Gateway)
  // ===========================================================================

  isCloudAppAuthenticated(): boolean {
    return Boolean(this.getStoredCloudAppToken());
  }

  getCloudAppUsername(): string | null {
    return this.getStoredCloudAppUsername();
  }

  clearCloudAppAuth(): void {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(CLOUDAPP_TOKEN_STORAGE_KEY);
    localStorage.removeItem(CLOUDAPP_USERNAME_STORAGE_KEY);
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
    const url = this.cloudappUrl('/user/user-login');
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

      const tokenHeader = response.headers.get('Authorization') || response.headers.get('authorization');
      if (!tokenHeader) {
        throw new ApiError('CloudApp login succeeded but no Authorization token was returned', 500, url);
      }

      const token = this.normalizeAuthorizationToken(tokenHeader);
      this.storeCloudAppAuth(token, username);
      return {
        username,
        token,
        message: 'Login successful',
        success: true,
      } as AuthResponse;
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
    const response = await this.post<{ items?: any[]; total?: number }>(
      this.cloudappUrl('/cart/getCart'),
      { username }
    );

    const items = (response.items || []).map((item: any) => ({
      itemId: item.id || 0,
      itemName: item.name || '',
      quantity: 1,
      price: parseFloat(item.price) || 0,
    }));

    return {
      items,
      total: response.total || items.reduce((sum: number, item: any) => sum + item.price, 0),
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

  async createCustomer(customer: {
    name: string;
    phoneNumber: string;
    notes?: string;
    petIds?: number[];
  }): Promise<Customer> {
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

  async createVehicle(vehicle: {
    condition: string;
    details: Record<string, unknown>;
    location: Record<string, unknown>;
  }): Promise<Vehicle> {
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
    return 'stats' in response ? response.stats : response;
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
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const orchestrationClient = new OrchestrationClient();
export default orchestrationClient;
