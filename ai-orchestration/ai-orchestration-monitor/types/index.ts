// =============================================================================
// Types - AI Orchestration Frontend
// UPDATED: Added execution context types for HITL resume functionality
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

// =============================================================================
// HITL Approvals (UPDATED)
// =============================================================================

export type ApprovalType = 'financial' | 'ml_decision' | 'data_access' | 'workflow_branch' | 'agent_action' | 'external_api' | 'content_generation';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'auto_approved' | 'flagged' | 'timeout';

// Execution context preserved during HITL pause
export interface ExecutionContext {
  next_capability?: string;
  selected_agent?: string;
  planned_tool_calls?: Record<string, unknown>[];
  planned_workflow_steps?: string[];
  ml_model_id?: string;
  ml_prediction_params?: Record<string, unknown>;
  agent_task?: string;
  agent_tools_selected?: string[];
  rag_query?: string;
  rag_retrieved_docs?: Record<string, unknown>[];
  workflow_id?: string;
  workflow_step_index?: number;
  workflow_branch?: string;
  risk_score?: number;
  risk_factors?: string[];
  checkpoint_id?: string;
  checkpoint_thread_id?: string;
}

export interface ApprovalContext {
  state_summary: {
    user?: string;
    type?: string;
    input?: string;
    steps_completed?: number;
  };
  risk_score: number;
  current_results?: Record<string, unknown>;
  additional_info?: Record<string, unknown>;
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
  risk_score: number;
  risk_factors: string[];
  context: ApprovalContext;
  execution_context?: ExecutionContext;
}

export interface ApprovalHistoryItem extends ApprovalRequest {
  approved_at?: string;
  approver_id?: number;
  approval_notes?: string;
  modifications?: Record<string, unknown>;
}

export interface ApprovalDecision {
  approved: boolean;
  approver_id: number;
  approval_notes?: string;
  modifications?: Record<string, unknown>;
}

export interface ApprovalStats {
  pending_count?: number;
  total_pending: number;
  approved_count?: number;
  total_approved: number;
  rejected_count?: number;
  total_rejected: number;
  expired_count?: number;
  total_expired: number;
  total_auto_approved?: number;
  total_flagged?: number;
  avg_response_time_seconds: number;
  by_type?: Record<string, number>;
  by_risk_level?: Record<string, number>;
}

// Resume workflow after approval
export interface ResumeRequest {
  user_id: number;
  session_id: string;
  additional_context?: Record<string, unknown>;
}

export interface ResumeResponse {
  request_id: string;
  approval_id: string;
  status: 'completed' | 'rejected' | 'expired' | 'error' | 'pending';
  response?: string;
  execution_path?: string[];
  capabilities_used?: string[];
  error?: string;
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
  // HITL-related fields
  approval_status?: ApprovalStatus;
  approval_request_id?: string;
  risk_score?: number;
  requires_human?: boolean;
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

export interface OllamaStatusResponse {
  connected: boolean;
  error: string | null;
  models: string[];
}

// =============================================================================
// WebSocket Messages (UPDATED)
// =============================================================================

export interface WebSocketStreamMessage {
  type: 'token' | 'node_start' | 'node_end' | 'complete' | 'error' | 'approval_required' | 'approval_update';
  data: {
    token?: string;
    node?: string;
    content?: string;
    error?: string;
    metrics?: {
      tokens_generated: number;
      latency_ms: number;
    };
    // HITL-related
    approval_request?: ApprovalRequest;
    approval_status?: ApprovalStatus;
    risk_score?: number;
  };
}

// Approval WebSocket messages
export interface ApprovalWebSocketMessage {
  type: 'approval_request' | 'approval_decided' | 'approval_expired' | 'approval_cancelled' | 'pong' | 'subscribed';
  data?: ApprovalRequest | ApprovalHistoryItem;
  status?: string;
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
  // HITL-related
  approval_status?: ApprovalStatus;
  approval_request_id?: string;
  risk_score?: number;
  requires_approval?: boolean;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  /** Capabilities used (for display) */
  capabilities?: string[];

  /** Whether this message was resumed from the approval interface */
  resumedFromApproval?: boolean;

  /** The approval request ID if resumed */
  approvalRequestId?: string;

  /** Risk score if this was a high-risk operation */
  riskScore?: number;
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

export interface Pet {
  id: number;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  status: 'available' | 'pending' | 'sold';
}

export interface Vehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  color?: string;
  status: 'available' | 'reserved' | 'sold';
}

// ML Types
export interface SegmentationCustomer {
  id?: number;
  gender: string;
  age: number;
  annual_income: number;
  spending_score: number;
  segment?: number;
}

export interface MLInfo {
  image2: string;
  image3: string;
  image4: string;
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

// Web Proxy Types
export interface WebProxyRequest {
  webDomain: string;
  webApiKey: string;
  [key: string]: unknown;
}

export interface WebProxyResponse {
  data: unknown;
  status?: number;
}

// =============================================================================
// Synced Message from Backend
// =============================================================================

export interface SyncedMessage {
  /** The orchestration request ID */
  request_id: string;

  /** The original user message that triggered the workflow */
  user_message: string;

  /** The LLM response after workflow completion */
  response: string;

  /** Capabilities used during execution (e.g., ["agent", "RAG"]) */
  capabilities_used: string[];

  /** ISO timestamp of when the response was generated */
  timestamp: string;

  /** Whether this message has been delivered to the chat interface */
  delivered: boolean;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface MarkDeliveredRequest {
  request_ids: string[];
}

export interface MarkDeliveredResponse {
  marked: number;
}

export interface ConversationSyncHealth {
  status: string;
  service: string;
  storage: string;
}
