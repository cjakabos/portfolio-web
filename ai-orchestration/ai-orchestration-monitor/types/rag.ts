// ============================================================================
// File: frontend-ai/src/types/rag.ts
// RAG Types - With Async Upload Job Types
// ============================================================================

// Document Types
export type RAGDocumentType = 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'unknown';

// Upload Job Status
export type UploadJobStatus =
  | 'pending'
  | 'parsing'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

// Document Info
export interface RAGDocument {
  doc_id: string;
  filename: string;
  doc_type: RAGDocumentType;
  chunk_count: number;
  char_count: number;
  word_count: number;
  user_id: number | null;
  created_at: string;
}

// Document List Response
export interface RAGDocumentListResponse {
  documents: RAGDocument[];
  total: number;
  user_id: number | null;
}

// Upload Job Response (initial)
export interface UploadJobResponse {
  job_id: string;
  filename: string;
  status: UploadJobStatus;
  message: string;
}

// Upload Status Response (polling)
export interface UploadStatusResponse {
  job_id: string;
  filename: string;
  status: UploadJobStatus;
  progress: number;  // 0-100
  message: string;
  doc_id: string | null;
  chunks_created: number;
  char_count: number;
  word_count: number;
  doc_type: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy Upload Response (kept for compatibility)
export interface RAGUploadResponse {
  status: string;
  doc_id: string;
  filename: string;
  doc_type: RAGDocumentType;
  chunks_created: number;
  char_count: number;
  word_count: number;
  message: string;
}

// Delete Response
export interface RAGDeleteResponse {
  status: string;
  doc_id: string;
  deleted: boolean;
  message: string;
}

// User Delete Response
export interface RAGUserDeleteResponse {
  status: string;
  user_id: number;
  documents_deleted: number;
  message: string;
}

// Query Request
export interface RAGQueryRequest {
  query: string;
  user_id?: number | null;
  top_k?: number;
  generate_answer?: boolean;
}

// Source Info
export interface RAGSource {
  content: string;
  doc_id: string | null;
  filename: string | null;
  chunk_index: number | null;
  doc_type: string | null;
  similarity_score?: number;
}

// Query Response
export interface RAGQueryResponse {
  answer: string;
  sources: RAGSource[];
  query: string;
  documents_searched: number;
  chunks_retrieved?: number;
  confidence: number;
}

// Stats Response
export interface RAGStatsResponse {
  initialized: boolean;
  total_documents: number;
  total_chunks: number;
  documents_by_type: Record<string, number>;
  persist_directory: string;
  collection_name: string;
  embedding_model: string;
}

// Health Response
export interface RAGHealthResponse {
  status: 'healthy' | 'unhealthy' | 'initializing';
  service: string;
  initialized: boolean;
  total_documents: number;
  total_chunks: number;
  embedding_model?: string;
  error?: string;
  timestamp: string;
}

// Upload Progress (for UI state)
export interface UploadProgress {
  file: File;
  jobId?: string;
  progress: number;
  status: UploadJobStatus | 'uploading';
  message?: string;
  error?: string;
  result?: UploadStatusResponse;
}