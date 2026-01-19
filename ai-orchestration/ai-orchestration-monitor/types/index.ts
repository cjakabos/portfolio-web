// =============================================================================
// Types - AI Orchestration Frontend
// =============================================================================

// Health & Status
export interface HealthResponse {
  status: string;
  service: string;
  version?: string;
  uptime?: number;
  features?: Record<string, boolean>;
}

// Metrics
export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface OrchestrationTypeMetric {
  name: string;
  value: number;
}

export interface CapabilityUsageMetric {
  name: string;
  used: number;
  available?: number;
}

export interface ExecutionRecord {
  timestamp: string;
  orchestration_type: string;
  capabilities_used: string[];
  duration_ms: number;
  success: boolean;
  request_id?: string;
}

export interface Metrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  activeOrchestrations: number;
  latency?: LatencyPercentiles;
  orchestrationTypes: OrchestrationTypeMetric[];
  capabilityUsage: CapabilityUsageMetric[];
  recentExecutions: ExecutionRecord[];
}

export interface DetailedMetrics {
  time_range: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  latency_percentiles: LatencyPercentiles;
  requests_per_minute: number;
  error_rate: number;
  orchestration_distribution: Record<string, number>;
  capability_distribution: Record<string, number>;
  time_series: {
    requests: TimeSeriesDataPoint[];
    latency: TimeSeriesDataPoint[];
    errors: TimeSeriesDataPoint[];
  };
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

// Circuit Breakers
export interface CircuitBreaker {
  name: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure?: string;
  last_success?: string;
  failure_threshold: number;
  reset_timeout_seconds: number;
  half_open_max_calls: number;
}

export interface CircuitBreakerListResponse {
  circuit_breakers: CircuitBreaker[];
  storage_backend: 'redis' | 'memory' | 'unavailable';
  total_count: number;
}

// Connection Stats
export interface ConnectionStats {
  service: string;
  available: boolean;
  client_closed: boolean;
  max_connections: number;
  max_keepalive_connections: number;
  http2_enabled: boolean;
}

export interface ConnectionStatsResponse {
  services: ConnectionStats[];
  total_services: number;
}

// Feature Status
export interface FeatureStatus {
  enabled: Record<string, boolean>;
  available: Record<string, boolean>;
  fallbacks: Record<string, string | null>;
}

// Error Summary
export interface ErrorSummary {
  total_errors: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  hours_analyzed: number;
  error_handling_available: boolean;
}

export interface RecentError {
  id: string;
  code: string;
  message: string;
  category: string;
  severity: string;
  timestamp: string;
  retryCount: number;
  resolved: boolean;
}

export interface RecentErrorsResponse {
  errors: RecentError[];
  total: number;
}

// A/B Testing
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'completed';
export type VariantType = 'control' | 'treatment';

export interface VariantConfig {
  name: string;
  type: VariantType;
  traffic_percentage: number;
  config: Record<string, unknown>;
}

export interface VariantMetrics extends VariantConfig {
  impressions: number;
  conversions: number;
  conversion_rate: number;
  avg_latency_ms: number;
  error_rate: number;
  total_latency_ms?: number;
  error_count?: number;
  lift_percentage?: number | null;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  status: ExperimentStatus;
  metric: string;
  user_percentage: number;
  start_date: string | null;
  end_date: string | null;
  winner: string | null;
  statistical_significance: number | null;
  variants: Record<string, VariantMetrics>;
  created_at: string;
  updated_at: string;
}

export interface ExperimentListItem {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: number;
  created_at: string;
}

export interface ExperimentStats {
  total_experiments: number;
  running: number;
  completed: number;
  draft: number;
  total_impressions: number;
  total_conversions: number;
  avg_lift: number;
}

export interface ExperimentCreateRequest {
  name: string;
  description: string;
  hypothesis: string;
  metric: string;
  user_percentage: number;
  variants: VariantConfig[];
}

// HITL Approvals
export type ApprovalType = 'financial' | 'ml_decision' | 'data_access' | 'workflow_branch' | 'agent_action' | 'external_api';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface ApprovalContext {
  state_summary: {
    user: string;
    type: string;
    input: string;
    steps_completed: number;
  };
  risk_score: number;
  current_results?: Record<string, unknown>;
}

export interface ApprovalRequest {
  request_id: string;
  orchestration_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  created_at: string;
  expires_at: string;
  requester_id: number;
  proposed_action: string;
  risk_level: RiskLevel;
  context: ApprovalContext;
}

export interface ApprovalHistoryItem extends ApprovalRequest {
  approved_at: string;
  approver_id?: number;
  approval_notes?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  approver_id: number;
  approval_notes?: string;
}

export interface ApprovalStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  expired_count: number;
  avg_response_time_seconds: number;
}

// Orchestration
export interface OrchestrationRequest {
  message: string;
  user_id: number;
  session_id: string;
  context?: Record<string, unknown>;
  orchestration_type?: string;
}

export interface OrchestrationResponse {
  request_id: string;
  response: string;
  orchestration_type: string;
  capabilities_used: string[];
  latency_ms: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Tools
export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  examples?: string[];
}

export interface ToolCategory {
  name: string;
  description?: string;
  toolCount: number;
}

export interface ToolDiscoveryResponse {
  tools: ToolInfo[];
  total: number;
  categories: ToolCategory[];
}

export interface ToolInvocationResponse {
  tool: string;
  success: boolean;
  result: unknown;
  latency_ms: number;
  error?: string;
}

// =============================================================================
// Service Types (CloudApp, Petstore, Vehicles)
// =============================================================================

export interface CloudAppUser {
  id: number;
  username: string;
  created_at?: string;
}

export interface CloudAppItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
}

export interface CartItem {
  itemId: number;
  itemName: string;
  quantity: number;
  price: number;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface Order {
  id: number;
  username: string;
  items: CartItem[];
  total: number;
  status: string;
  createdAt: string;
}

export interface Note {
  id: number;
  username: string;
  title: string;
  description: string;
  created_at?: string;
}

export interface CloudAppRoom {
  id: number;
  name: string;
  code: string;
  createdBy: string;
}

// CloudApp Files
export interface CloudAppFile {
  id: number;
  filename: string;
  contentType: string;
  size: string;
  userId: number;
  createdAt?: string;
}

// CloudApp Auth
export interface AuthResponse {
  token: string;
  username: string;
  message?: string;
}

// =============================================================================
// Petstore Types
// =============================================================================

export interface Employee {
  id: number;
  name: string;
  skills: string[];
  daysAvailable: string[];
}

export interface Customer {
  id: number;
  name: string;
  phoneNumber: string;
  notes?: string;
  petIds?: number[];
}

export interface Pet {
  id: number;
  type: string;
  name: string;
  ownerId: number;
  birthDate?: string;
  notes?: string;
}

export interface Schedule {
  id: number;
  date: string;
  employeeIds: number[];
  petIds: number[];
  activities: string[];
}

// =============================================================================
// Vehicles Types
// =============================================================================

export interface Vehicle {
  id: number;
  condition: string;
  details: {
    manufacturer?: string;
    model?: string;
    year?: number;
    price?: number;
    mileage?: number;
    color?: string;
  };
  location?: {
    city?: string;
    state?: string;
    zip?: string;
  };
}

export interface Manufacturer {
  code: number;
  name: string;
}

export interface VehicleStats {
  totalVehicles: number;
  byCondition: Record<string, number>;
  byManufacturer: Record<string, number>;
  avgPrice: number;
  avgMileage: number;
}

// =============================================================================
// ML Pipeline Types
// =============================================================================

export interface SegmentationCustomer {
  id?: number;
  gender: string;
  age: number;
  annual_income: number;
  spending_score: number;
  segment?: number;
}

export interface MLInfo {
  image2: string;  // base64 encoded image
  image3: string;  // base64 encoded image
  image4: string;  // base64 encoded image
}

export interface MLDiagnostics {
  missing_percentage: Record<string, number>;
  execution_time: {
    ingestion_time?: number;
    training_time?: number;
  };
  outdated_packages: string[];
}

export interface MLPredictionResult {
  predictions: number[];
  filepath: string;
}

export interface MLScoringResult {
  score: number;
  metric?: string;
}

export interface MLSummaryStatistics {
  columns: string[];
  statistics: Record<string, {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
  }>;
}

// =============================================================================
// Web Proxy Types
// =============================================================================

export interface WebProxyRequest {
  webDomain: string;
  webApiKey: string;
  [key: string]: unknown;  // Additional body properties for POST/PUT
}

export interface WebProxyResponse {
  data: unknown;
  status?: number;
}

// =============================================================================
// WebSocket Messages
// =============================================================================

export interface WebSocketStreamMessage {
  type: 'token' | 'node_start' | 'node_end' | 'complete' | 'error';
  data: {
    token?: string;
    node?: string;
    content?: string;
    error?: string;
    metrics?: {
      tokens_generated: number;
      latency_ms: number;
    };
  };
}

// Chat Message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metrics?: {
    tokensPerSecond: number;
    totalTokens: number;
    latency: number;
  };
}