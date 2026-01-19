// =============================================================================
// OrchestrationClient - API Service Layer
// =============================================================================
// 
// This service handles all API communication with the AI Orchestration Layer backend.
// No mock data - all requests go to the actual backend API.
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
  CloudAppUser,
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
  baseUrl: string;
  wsUrl: string;
  timeout: number;
}

const getConfig = (): ClientConfig => {
  // Environment variables with sensible defaults
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    || 'http://localhost:8700';
  const wsUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE_URL)
    || 'ws://localhost:8700';
  const timeout = parseInt(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REQUEST_TIMEOUT) || '15000',
    10
  );

  return { baseUrl, wsUrl, timeout };
};

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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
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
          endpoint,
          details
        );
      }

      // Handle empty responses
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

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(endpoint);
        }
        throw new NetworkError(error.message, endpoint);
      }

      throw new NetworkError('Unknown error occurred', endpoint);
    }
  }

  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  private async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Special method for form data uploads
  private async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Note: Don't set Content-Type header - browser will set it with boundary
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          endpoint,
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
      if (error instanceof ApiError) throw error;
      if (error instanceof Error) {
        if (error.name === 'AbortError') throw new TimeoutError(endpoint);
        throw new NetworkError(error.message, endpoint);
      }
      throw new NetworkError('Unknown error occurred', endpoint);
    }
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/config');
  }

  // ===========================================================================
  // Metrics & Observability
  // ===========================================================================

  async getMetrics(): Promise<Metrics> {
    return this.get<Metrics>('/metrics');
  }

  async getDetailedMetrics(hours: number = 24): Promise<DetailedMetrics> {
    return this.get<DetailedMetrics>(`/metrics/detailed?hours=${hours}`);
  }

  async getRecentExecutions(limit: number = 100): Promise<{ executions: unknown[]; total: number }> {
    return this.get(`/metrics/executions?limit=${limit}`);
  }

  async getTimeSeries(metric: string, hours: number = 24): Promise<unknown> {
    return this.get(`/metrics/time-series?metric=${metric}&hours=${hours}`);
  }

  // ===========================================================================
  // Circuit Breakers
  // ===========================================================================

  async getCircuitBreakers(): Promise<CircuitBreakerListResponse> {
    return this.get<CircuitBreakerListResponse>('/circuit-breakers');
  }

  async resetCircuitBreaker(name: string): Promise<{ success: boolean; message: string }> {
    return this.post(`/circuit-breakers/${encodeURIComponent(name)}/reset`);
  }

  // ===========================================================================
  // Connection Stats
  // ===========================================================================

  async getConnectionStats(): Promise<ConnectionStatsResponse> {
    return this.get<ConnectionStatsResponse>('/connection-stats');
  }

  // ===========================================================================
  // Feature Status
  // ===========================================================================

  async getFeatureStatus(): Promise<FeatureStatus> {
    return this.get<FeatureStatus>('/feature-status');
  }

  // ===========================================================================
  // Error Summary
  // ===========================================================================

  async getErrorSummary(hours: number = 24): Promise<ErrorSummary> {
    return this.get<ErrorSummary>(`/errors/summary?hours=${hours}`);
  }

  async getRecentErrors(limit: number = 50): Promise<RecentErrorsResponse> {
    return this.get<RecentErrorsResponse>(`/errors/recent?limit=${limit}`);
  }

  // ===========================================================================
  // A/B Testing Experiments
  // ===========================================================================

  async getExperiments(): Promise<ExperimentListItem[]> {
    return this.get<ExperimentListItem[]>('/experiments');
  }

  async getExperiment(experimentId: string): Promise<Experiment> {
    return this.get<Experiment>(`/experiments/${encodeURIComponent(experimentId)}`);
  }

  async createExperiment(data: ExperimentCreateRequest): Promise<Experiment> {
    return this.post<Experiment>('/experiments', data);
  }

  async updateExperiment(experimentId: string, data: Partial<ExperimentCreateRequest>): Promise<Experiment> {
    return this.put<Experiment>(`/experiments/${encodeURIComponent(experimentId)}`, data);
  }

  async startExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(`/experiments/${encodeURIComponent(experimentId)}/start`);
  }

  async pauseExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(`/experiments/${encodeURIComponent(experimentId)}/pause`);
  }

  async stopExperiment(experimentId: string): Promise<Experiment> {
    return this.post<Experiment>(`/experiments/${encodeURIComponent(experimentId)}/stop`);
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.delete(`/experiments/${encodeURIComponent(experimentId)}`);
  }

  async getVariant(experimentId: string, userId: number): Promise<VariantConfig & { assigned: boolean }> {
    return this.get(`/experiments/${encodeURIComponent(experimentId)}/variant/${userId}`);
  }

  async trackImpression(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(`/experiments/${encodeURIComponent(experimentId)}/track/impression`, { user_id: userId });
  }

  async trackConversion(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(`/experiments/${encodeURIComponent(experimentId)}/track/conversion`, { user_id: userId });
  }

  async trackLatency(experimentId: string, userId: number, latencyMs: number): Promise<{ tracked: boolean }> {
    return this.post(`/experiments/${encodeURIComponent(experimentId)}/track/latency`, {
      user_id: userId,
      latency_ms: latencyMs
    });
  }

  async trackError(experimentId: string, userId: number): Promise<{ tracked: boolean }> {
    return this.post(`/experiments/${encodeURIComponent(experimentId)}/track/error`, { user_id: userId });
  }

  async getExperimentStats(): Promise<ExperimentStats> {
    return this.get<ExperimentStats>('/experiments/stats/summary');
  }

  // ===========================================================================
  // HITL Approvals
  // ===========================================================================

  async getPendingApprovals(filters?: {
    approval_type?: string;
    risk_level?: string
  }): Promise<ApprovalRequest[]> {
    let url = '/approvals/pending';
    const params = new URLSearchParams();
    if (filters?.approval_type) params.append('approval_type', filters.approval_type);
    if (filters?.risk_level) params.append('risk_level', filters.risk_level);
    if (params.toString()) url += `?${params.toString()}`;
    return this.get<ApprovalRequest[]>(url);
  }

  async getPendingApproval(requestId: string): Promise<ApprovalRequest> {
    return this.get<ApprovalRequest>(`/approvals/pending/${encodeURIComponent(requestId)}`);
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
    const url = `/approvals/history${params.toString() ? `?${params.toString()}` : ''}`;
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
    return this.post<ApprovalRequest>('/approvals/request', data);
  }

  async decideApproval(requestId: string, decision: ApprovalDecision): Promise<ApprovalHistoryItem> {
    return this.post<ApprovalHistoryItem>(
      `/approvals/pending/${encodeURIComponent(requestId)}/decide`,
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
    return this.delete(`/approvals/pending/${encodeURIComponent(requestId)}`);
  }

  async getApprovalStats(): Promise<ApprovalStats> {
    return this.get<ApprovalStats>('/approvals/stats');
  }

  // ===========================================================================
  // Tools Discovery & Invocation
  // ===========================================================================

  async discoverTools(): Promise<ToolDiscoveryResponse> {
    return this.get<ToolDiscoveryResponse>('/tools');
  }

  async invokeTool(toolName: string, parameters: Record<string, unknown>): Promise<ToolInvocationResponse> {
    return this.post<ToolInvocationResponse>(`/tools/${encodeURIComponent(toolName)}/invoke`, {
      parameters,
    });
  }

  async getToolInfo(toolName: string): Promise<ToolDiscoveryResponse['tools'][0]> {
    return this.get(`/tools/${encodeURIComponent(toolName)}`);
  }

  // ===========================================================================
  // Orchestration
  // ===========================================================================

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    return this.post<OrchestrationResponse>('/orchestrate', request);
  }

  // ===========================================================================
  // WebSocket Streaming
  // ===========================================================================

  connectWebSocket(
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): WebSocket {
    const wsUrl = `${this.config.wsUrl}/ws/stream`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
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
  // CloudApp Service - Users
  // ===========================================================================

  async getCloudAppUser(username: string): Promise<CloudAppUser> {
    return this.get<CloudAppUser>(`/users/${encodeURIComponent(username)}`);
  }

  async getCloudAppUserById(userId: number): Promise<CloudAppUser> {
    return this.get<CloudAppUser>(`/users/id/${userId}`);
  }

  async createCloudAppUser(username: string, password: string): Promise<CloudAppUser> {
    return this.post<CloudAppUser>('/users', { username, password });
  }

  // NEW: Login user - Maps to POST /user/user-login
  async loginUser(username: string, password: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('/users/login', { username, password });
  }

  // ===========================================================================
  // CloudApp Service - Items
  // ===========================================================================

  async getItems(): Promise<CloudAppItem[]> {
    const response = await this.get<{ items: CloudAppItem[]; total: number }>('/item');
    return response.items;
  }

  async getItemById(itemId: number): Promise<CloudAppItem> {
    return this.get<CloudAppItem>(`/item/${itemId}`);
  }

  async searchItemsByName(name: string): Promise<CloudAppItem[]> {
    const response = await this.get<{ items: CloudAppItem[]; total: number }>(
      `/item/search?name=${encodeURIComponent(name)}`
    );
    return response.items;
  }

  // NEW: Create item - Maps to POST /item
  async createItem(name: string, price: number, description?: string): Promise<CloudAppItem> {
    return this.post<CloudAppItem>('/item', { name, price, description });
  }

  // ===========================================================================
  // CloudApp Service - Cart
  // ===========================================================================

  async getCart(username: string): Promise<Cart> {
    return this.get<Cart>(`/cart/${encodeURIComponent(username)}`);
  }

  async addToCart(username: string, itemId: number, quantity: number = 1): Promise<Cart> {
    return this.post<Cart>(`/cart/${encodeURIComponent(username)}/add`, {
      item_id: itemId,
      quantity,
    });
  }

  async removeFromCart(username: string, itemId: number, quantity: number = 1): Promise<Cart> {
    return this.post<Cart>(`/cart/${encodeURIComponent(username)}/remove`, {
      item_id: itemId,
      quantity,
    });
  }

  async clearCart(username: string): Promise<void> {
    await this.post(`/cart/${encodeURIComponent(username)}/clear`);
  }

  // ===========================================================================
  // CloudApp Service - Orders
  // ===========================================================================

  async getOrderHistory(username: string): Promise<Order[]> {
    const response = await this.get<{ orders: Order[]; total: number }>(
      `/order/${encodeURIComponent(username)}`
    );
    return response.orders;
  }

  async submitOrder(username: string): Promise<Order> {
    return this.post<Order>(`/order/${encodeURIComponent(username)}/submit`);
  }

  // ===========================================================================
  // CloudApp Service - Notes
  // ===========================================================================

  async getUserNotes(username: string): Promise<Note[]> {
    const response = await this.get<{ notes: Note[]; total: number }>(
      `/note/user/${encodeURIComponent(username)}`
    );
    return response.notes;
  }

  async addNote(username: string, title: string, description: string): Promise<Note> {
    return this.post<Note>('/note', { username, title, description });
  }

  async updateNote(noteId: number, title: string, description: string): Promise<Note> {
    return this.put<Note>(`/note/${noteId}`, { title, description });
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.delete(`/note/${noteId}`);
  }

  // ===========================================================================
  // CloudApp Service - Rooms
  // ===========================================================================

  async createRoom(name: string, username: string): Promise<CloudAppRoom> {
    return this.post<CloudAppRoom>('/room', { name, username });
  }

  async getRoomByCode(code: string): Promise<CloudAppRoom> {
    return this.get<CloudAppRoom>(`/room/${encodeURIComponent(code)}`);
  }

  async getUserRooms(username: string): Promise<CloudAppRoom[]> {
    const response = await this.get<{ rooms: CloudAppRoom[] }>(
      `/room/user/${encodeURIComponent(username)}`
    );
    return response.rooms;
  }

  // ===========================================================================
  // CloudApp Service - Files (NEW - 4 methods)
  // ===========================================================================

  // Maps to GET /file/user/{username}
  async getUserFiles(username: string): Promise<CloudAppFile[]> {
    const response = await this.get<{ files: CloudAppFile[]; total: number }>(
      `/files/${encodeURIComponent(username)}`
    );
    return response.files;
  }

  // Maps to GET /file/get-file/{fileId}
  async getFile(fileId: number): Promise<Blob> {
    const url = `${this.config.baseUrl}/files/download/${fileId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new ApiError('Failed to download file', response.status, url);
    }
    return response.blob();
  }

  // Maps to POST /file/upload
  async uploadFile(username: string, file: File): Promise<CloudAppFile> {
    const formData = new FormData();
    formData.append('fileUpload', file);
    formData.append('username', username);
    return this.postFormData<CloudAppFile>('/files/upload', formData);
  }

  // Maps to GET /file/delete-file/{fileId}
  async deleteFile(fileId: number): Promise<void> {
    await this.delete(`/files/${fileId}`);
  }

  // ===========================================================================
  // Petstore Service - Employees
  // ===========================================================================

  async getEmployees(): Promise<Employee[]> {
    const response = await this.get<{ employees: Employee[]; total: number }>('/petstore/user/employee');
    return response.employees;
  }

  async getEmployeeById(employeeId: number): Promise<Employee> {
    return this.get<Employee>(`/petstore/user/employee/${employeeId}`);
  }

  async createEmployee(name: string, skills: string[], daysAvailable: string[]): Promise<Employee> {
    return this.post<Employee>('/petstore/user/employee', { name, skills, daysAvailable });
  }

  async setEmployeeAvailability(employeeId: number, daysAvailable: string[]): Promise<void> {
    await this.put(`/petstore/user/employee/${employeeId}/availability`, { daysAvailable });
  }

  async findAvailableEmployees(skills: string[], date: string): Promise<Employee[]> {
    const response = await this.post<{ employees: Employee[] }>('/petstore/user/employee/available', {
      skills,
      date,
    });
    return response.employees;
  }

  async deleteEmployee(employeeId: number): Promise<void> {
    await this.delete(`/petstore/user/employee/${employeeId}`);
  }

  // ===========================================================================
  // Petstore Service - Customers
  // ===========================================================================

  async getCustomers(): Promise<Customer[]> {
    const response = await this.get<{ customers: Customer[]; total: number }>('/petstore/user/customer');
    return response.customers;
  }

  async createCustomer(name: string, phoneNumber: string, notes?: string): Promise<Customer> {
    return this.post<Customer>('/petstore/user/customer', { name, phoneNumber, notes });
  }

  async getCustomerByPet(petId: number): Promise<Customer> {
    return this.get<Customer>(`/petstore/user/customer/pet/${petId}`);
  }

  async deleteCustomer(customerId: number): Promise<void> {
    await this.delete(`/petstore/user/customer/${customerId}`);
  }

  // ===========================================================================
  // Petstore Service - Pets
  // ===========================================================================

  async getPets(): Promise<Pet[]> {
    const response = await this.get<{ pets: Pet[]; total: number }>('/petstore/pet');
    return response.pets;
  }

  async getPetById(petId: number): Promise<Pet> {
    return this.get<Pet>(`/petstore/pet/${petId}`);
  }

  async createPet(
    type: string,
    name: string,
    ownerId: number,
    birthDate?: string,
    notes?: string
  ): Promise<Pet> {
    return this.post<Pet>('/petstore/pet', { type, name, ownerId, birthDate, notes });
  }

  async updatePet(petId: number, updates: Partial<Pet>): Promise<Pet> {
    return this.put<Pet>(`/petstore/pet/${petId}`, updates);
  }

  async getPetsByOwner(ownerId: number): Promise<Pet[]> {
    const response = await this.get<{ pets: Pet[] }>(`/petstore/pet/owner/${ownerId}`);
    return response.pets;
  }

  // NEW: Delete pet - Maps to DELETE /pet/{id}
  async deletePet(petId: number): Promise<void> {
    await this.delete(`/petstore/pet/${petId}`);
  }

  // ===========================================================================
  // Petstore Service - Schedules
  // ===========================================================================

  async getSchedules(): Promise<Schedule[]> {
    const response = await this.get<{ schedules: Schedule[] }>('/petstore/schedule');
    return response.schedules;
  }

  async createSchedule(
    date: string,
    employeeIds: number[],
    petIds: number[],
    activities: string[]
  ): Promise<Schedule> {
    return this.post<Schedule>('/petstore/schedule', { date, employeeIds, petIds, activities });
  }

  async getEmployeeSchedule(employeeId: number): Promise<Schedule[]> {
    const response = await this.get<{ schedules: Schedule[] }>(
      `/petstore/schedule/employee/${employeeId}`
    );
    return response.schedules;
  }

  async getCustomerSchedule(customerId: number): Promise<Schedule[]> {
    const response = await this.get<{ schedules: Schedule[] }>(
      `/petstore/schedule/customer/${customerId}`
    );
    return response.schedules;
  }

  async getPetSchedule(petId: number): Promise<Schedule[]> {
    const response = await this.get<{ schedules: Schedule[] }>(
      `/petstore/schedule/pet/${petId}`
    );
    return response.schedules;
  }

  // NEW: Delete schedule - Maps to DELETE /schedule/{scheduleId}
  async deleteSchedule(scheduleId: number): Promise<void> {
    await this.delete(`/petstore/schedule/${scheduleId}`);
  }

  // ===========================================================================
  // Vehicles Service
  // ===========================================================================

  async getVehicles(): Promise<Vehicle[]> {
    const response = await this.get<{ vehicles: Vehicle[] }>('/vehicles/cars');
    return response.vehicles;
  }

  async getVehicleById(vehicleId: number): Promise<Vehicle> {
    return this.get<Vehicle>(`/vehicles/cars/${vehicleId}`);
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

    const response = await this.get<{ vehicles: Vehicle[] }>(
      `/vehicles/cars/search?${searchParams.toString()}`
    );
    return response.vehicles;
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
    return this.post<Vehicle>('/vehicles/cars', vehicle);
  }

  async updateVehicle(vehicleId: number, updates: Partial<Vehicle>): Promise<Vehicle> {
    return this.put<Vehicle>(`/vehicles/cars/${vehicleId}`, updates);
  }

  async deleteVehicle(vehicleId: number): Promise<void> {
    await this.delete(`/vehicles/cars/${vehicleId}`);
  }

  // Note: These endpoints may not exist in backend - marked as potentially unavailable
  async getManufacturers(): Promise<{ manufacturers: Manufacturer[] }> {
    return this.get('/vehicles/manufacturers');
  }

  async getVehicleStats(): Promise<VehicleStats> {
    return this.get('/vehicles/stats');
  }

  // ===========================================================================
  // ML Pipeline Service (NEW - 7 methods for useMLPipeline hook)
  // ===========================================================================

  // Maps to GET /getSegmentationCustomers
  async getSegmentationCustomers(): Promise<SegmentationCustomer[]> {
    return this.get<SegmentationCustomer[]>('/ml-pipeline/customers');
  }

  // Maps to POST /getMLInfo
  async getMLInfo(sampleSize: number = -2): Promise<MLInfo> {
    return this.post<MLInfo>('/ml-pipeline/info', { sampleSize });
  }

  // Maps to GET /diagnostics
  async getMLDiagnostics(): Promise<MLDiagnostics> {
    return this.get<MLDiagnostics>('/ml-pipeline/diagnostics');
  }

  // Maps to POST /addCustomer
  async addSegmentationCustomer(
    gender: string,
    age: number,
    annualIncome: number,
    spendingScore: number
  ): Promise<SegmentationCustomer> {
    return this.post<SegmentationCustomer>('/ml-pipeline/customers', {
      fields: {
        gender,
        age,
        annual_income: annualIncome,
        spending_score: spendingScore,
      },
    });
  }

  // Maps to POST /prediction
  async getModelPredictions(filepath: string): Promise<number[]> {
    const response = await this.post<number[]>('/ml-pipeline/prediction', { filepath });
    return response;
  }

  // Maps to GET /scoring
  async getModelScore(): Promise<{ score: number }> {
    const response = await this.get<string>('/ml-pipeline/scoring');
    // Backend returns string like "f1 score = 0.85", parse it
    const match = response.match(/[\d.]+/);
    return { score: match ? parseFloat(match[0]) : 0 };
  }

  // Maps to GET /summarystats
  async getSummaryStatistics(): Promise<MLSummaryStatistics> {
    return this.get<MLSummaryStatistics>('/ml-pipeline/summarystats');
  }

  // Additional ML Pipeline methods
  async ingestMLData(fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/ml-pipeline/ingest', { fields });
  }

  // ===========================================================================
  // Web Proxy Service (NEW - 4 methods)
  // ===========================================================================

  // Maps to POST /webDomain/get
  async proxyGet(webDomain: string, webApiKey: string): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>('/web-proxy/get', { webDomain, webApiKey });
  }

  // Maps to POST /webDomain/post
  async proxyPost(webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>('/web-proxy/post', { webDomain, webApiKey, ...body });
  }

  // Maps to PUT /webDomain/put
  async proxyPut(webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> {
    return this.put<WebProxyResponse>('/web-proxy/put', { webDomain, webApiKey, ...body });
  }

  // Maps to POST /webDomain/delete
  async proxyDelete(webDomain: string, webApiKey: string): Promise<WebProxyResponse> {
    return this.post<WebProxyResponse>('/web-proxy/delete', { webDomain, webApiKey });
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const orchestrationClient = new OrchestrationClient();
export default orchestrationClient;