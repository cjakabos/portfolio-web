// ============================================================================
// File: frontend-ai/src/services/ragClient.ts
// RAG API Client - With Async Upload & Status Polling
// ============================================================================

import type {
  RAGDocument,
  RAGDocumentListResponse,
  RAGUploadResponse,
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

const getConfig = () => {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BASE_URL)
    || 'http://localhost:80';
  const timeout = parseInt(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REQUEST_TIMEOUT) || '30000',
    10
  );
  return { baseUrl, timeout };
};

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

// =============================================================================
// Error Types
// =============================================================================

export class RAGApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RAGApiError';
  }
}

// =============================================================================
// RAG Client Class
// =============================================================================

export class RAGClient {
  private config: { baseUrl: string; timeout: number };

  constructor() {
    this.config = getConfig();
  }

  private ragUrl(endpoint: string): string {
    return `${this.config.baseUrl}/rag${endpoint}`;
  }

  private buildHeaders(baseHeaders?: HeadersInit, includeJsonContentType: boolean = true): Headers {
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

  // ===========================================================================
  // Core HTTP Methods
  // ===========================================================================

  private async request<T>(
    url: string,
    options: RequestInit = {},
    customTimeout?: number
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutMs = customTimeout ?? this.config.timeout;
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
          throw new RAGApiError(
            `RAG API request failed: ${response.statusText}`,
            response.status,
            url,
            details
          );
        }

        if (response.status === 204) {
          return {} as T;
        }

        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof RAGApiError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxAttempts - 1) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
          throw new RAGApiError('Request timeout', 408, url);
        }
        if (attempt < maxAttempts - 1) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }
        throw new RAGApiError(
          error instanceof Error ? error.message : 'Unknown error',
          0,
          url
        );
      }
    }

    throw new RAGApiError('Request retries exhausted', 0, url);
  }

  private async get<T>(url: string, timeout?: number): Promise<T> {
    return this.request<T>(url, { method: 'GET' }, timeout);
  }

  private async post<T>(url: string, body?: unknown, timeout?: number): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, timeout);
  }

  private async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  // ===========================================================================
  // ASYNC UPLOAD (NEW!)
  // ===========================================================================

  /**
   * Upload a document asynchronously.
   * Returns immediately with a job_id. Use getUploadStatus() to poll for progress.
   */
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
    if (options?.tags && options.tags.length > 0) {
      formData.append('tags', options.tags.join(','));
    }
    if (options?.category) {
      formData.append('category', options.category);
    }

    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      // Short timeout - just for the initial upload, not processing
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(this.ragUrl('/documents/upload'), {
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
          let details: unknown;
          try {
            details = JSON.parse(errorBody);
          } catch {
            details = errorBody;
          }
          throw new RAGApiError(
            `Upload failed: ${response.statusText}`,
            response.status,
            '/documents/upload',
            details
          );
        }

        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof RAGApiError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxAttempts - 1) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
        }
        if (attempt < maxAttempts - 1) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }
        throw new RAGApiError(
          error instanceof Error ? error.message : 'Upload failed',
          0,
          '/documents/upload'
        );
      }
    }

    throw new RAGApiError('Upload retries exhausted', 0, '/documents/upload');
  }

  /**
   * Get upload job status. Poll this to track progress.
   */
  async getUploadStatus(jobId: string): Promise<UploadStatusResponse> {
    return this.get<UploadStatusResponse>(
      this.ragUrl(`/documents/upload/status/${jobId}`),
      10000 // Short timeout for status checks
    );
  }

  /**
   * List recent upload jobs
   */
  async listUploadJobs(limit: number = 20): Promise<{ jobs: UploadStatusResponse[]; total: number }> {
    return this.get(this.ragUrl(`/documents/upload/jobs?limit=${limit}`));
  }

  // ===========================================================================
  // Document Management
  // ===========================================================================

  /**
   * List documents
   */
  async listDocuments(options?: {
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

    const queryString = params.toString();
    const url = this.ragUrl(`/documents${queryString ? `?${queryString}` : ''}`);

    return this.get<RAGDocumentListResponse>(url);
  }

  /**
   * Get document info
   */
  async getDocument(docId: string): Promise<RAGDocument> {
    return this.get<RAGDocument>(this.ragUrl(`/documents/${docId}`));
  }

  /**
   * Delete a document
   */
  async deleteDocument(docId: string): Promise<RAGDeleteResponse> {
    return this.delete<RAGDeleteResponse>(this.ragUrl(`/documents/${docId}`));
  }

  /**
   * Delete all documents for a user
   */
  async deleteUserDocuments(userId: number): Promise<RAGUserDeleteResponse> {
    return this.delete<RAGUserDeleteResponse>(this.ragUrl(`/documents/user/${userId}`));
  }

  // ===========================================================================
  // Querying
  // ===========================================================================

  /**
   * Query documents
   */
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    return this.post<RAGQueryResponse>(
      this.ragUrl('/query'),
      request,
      120000 // 2 minute timeout for queries (LLM can be slow)
    );
  }

  // ===========================================================================
  // Stats & Health
  // ===========================================================================

  /**
   * Get RAG stats
   */
  async getStats(): Promise<RAGStatsResponse> {
    return this.get<RAGStatsResponse>(this.ragUrl('/stats'), 10000);
  }

  /**
   * Get RAG health
   */
  async getHealth(): Promise<RAGHealthResponse> {
    return this.get<RAGHealthResponse>(this.ragUrl('/health'), 10000);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const ragClient = new RAGClient();
export default ragClient;
