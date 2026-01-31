// ============================================================================
// File: frontend-ai/src/components/RAGDashboard.tsx
// RAG Dashboard - Document Management and Query Interface
// UPDATED: With async upload and detailed progress tracking
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Search,
  Trash2,
  File,
  FileSpreadsheet,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Cpu,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BookOpen,
  RefreshCw,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { useRAGDocuments, useRAGUpload, useRAGQuery, useRAGStats, useRAGHealth } from '../hooks/useRAG';
import type { RAGDocument, RAGSource, UploadProgress, UploadJobStatus, RAGQueryResponse } from '../types/rag';

// =============================================================================
// Helper Components
// =============================================================================

const FileIcon: React.FC<{ type: string; className?: string }> = ({ type, className = "w-5 h-5" }) => {
  switch (type) {
    case 'pdf':
      return <FileText className={`${className} text-red-500`} />;
    case 'docx':
    case 'doc':
      return <FileText className={`${className} text-blue-500`} />;
    case 'csv':
      return <FileSpreadsheet className={`${className} text-green-500`} />;
    case 'md':
      return <FileCode className={`${className} text-purple-500`} />;
    case 'txt':
    default:
      return <File className={`${className} text-gray-500`} />;
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// =============================================================================
// Stats Card
// =============================================================================

const StatsCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  isLoading?: boolean;
  hasError?: boolean;
}> = ({ icon: Icon, label, value, subtext, color = 'blue', isLoading, hasError }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}-50`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">Loading...</span>
          </div>
        ) : hasError ? (
          <p className="text-sm text-slate-400">--</p>
        ) : (
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        )}
        {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
      </div>
    </div>
  </div>
);

// =============================================================================
// Upload Progress Item - Shows detailed stage progress
// =============================================================================

interface StageInfo {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const STAGE_INFO: Record<UploadJobStatus | 'uploading', StageInfo> = {
  uploading: {
    label: 'Uploading',
    icon: Upload,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  pending: {
    label: 'Queued',
    icon: Clock,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
  parsing: {
    label: 'Parsing Document',
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  embedding: {
    label: 'Generating Embeddings',
    icon: Cpu,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  indexing: {
    label: 'Indexing',
    icon: Database,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

const UploadProgressItem: React.FC<{ upload: UploadProgress }> = ({ upload }) => {
  const stage = STAGE_INFO[upload.status] || STAGE_INFO.pending;
  const Icon = stage.icon;
  const isActive = !['completed', 'failed'].includes(upload.status);
  const isReconnecting = upload.status === 'pending' && upload.message?.includes('Reconnecting');

  return (
    <div className={`rounded-lg border ${
      upload.status === 'failed' ? 'border-red-200 bg-red-50' :
      upload.status === 'completed' ? 'border-green-200 bg-green-50' :
      isReconnecting ? 'border-yellow-200 bg-yellow-50' :
      'border-slate-200 bg-white'
    } p-4`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isReconnecting ? 'bg-yellow-100' : stage.bgColor}`}>
          {isReconnecting ? (
            <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
          ) : isActive ? (
            <Loader2 className={`w-5 h-5 ${stage.color} animate-spin`} />
          ) : (
            <Icon className={`w-5 h-5 ${stage.color}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {upload.file.name}
          </p>
          <p className={`text-xs ${isReconnecting ? 'text-yellow-600' : stage.color}`}>
            {isReconnecting
              ? 'Upload is in progress...'
              : upload.message || stage.label
            }
          </p>
        </div>
        {upload.status === 'completed' && (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        )}
        {upload.status === 'failed' && (
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Simple Progress Bar for active uploads */}
      {isActive && (
        <div className="mt-3">
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                isReconnecting
                  ? 'bg-yellow-400'
                  : 'bg-blue-500'
              } ${isActive ? 'animate-pulse' : ''}`}
              style={{ width: isReconnecting ? '100%' : `${Math.max(upload.progress, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {upload.status === 'failed' && upload.error && (
        <div className="flex items-start gap-2 mt-3 p-2 bg-red-100 rounded text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{upload.error}</span>
        </div>
      )}

      {/* Completion Info */}
      {upload.status === 'completed' && upload.result && (
        <div className="mt-3 text-sm text-green-700">
          ✓ Created {upload.result.chunks_created} chunks ({upload.result.word_count.toLocaleString()} words)
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Upload Zone - With async progress tracking
// =============================================================================

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  uploads: UploadProgress[];
  activeUploads: UploadProgress[];
  completedUploads: UploadProgress[];
  failedUploads: UploadProgress[];
  onClearCompleted: () => void;
  onClearFailed: () => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  isUploading,
  uploads,
  activeUploads,
  completedUploads,
  failedUploads,
  onClearCompleted,
  onClearFailed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  }, [onFilesSelected]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }, [onFilesSelected]);

  const hasActiveUploads = activeUploads.length > 0;
  const hasCompletedUploads = completedUploads.length > 0;
  const hasFailedUploads = failedUploads.length > 0;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
          ${isUploading ? 'opacity-70' : 'cursor-pointer'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {isUploading ? (
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
        ) : (
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
        )}

        <p className="text-lg font-medium text-slate-700 mb-1">
          {isDragging ? 'Drop files here' : isUploading ? 'Processing...' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-slate-500 mb-3">
          {isUploading ? 'You can still add more files' : 'or click to browse'}
        </p>
        <p className="text-xs text-slate-400">
          Supported: PDF, DOCX, TXT, MD, CSV (max 10MB)
        </p>
      </div>

      {/* Active Uploads */}
      {hasActiveUploads && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">
              Processing ({activeUploads.length})
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>This may take several minutes for large documents</span>
            </div>
          </div>
          {activeUploads.map((upload, index) => (
            <UploadProgressItem key={upload.jobId || index} upload={upload} />
          ))}
        </div>
      )}

      {/* Completed Uploads */}
      {hasCompletedUploads && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-green-700">
              ✓ Completed ({completedUploads.length})
            </h3>
            <button
              onClick={onClearCompleted}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
          {completedUploads.map((upload, index) => (
            <UploadProgressItem key={upload.jobId || index} upload={upload} />
          ))}
        </div>
      )}

      {/* Failed Uploads */}
      {hasFailedUploads && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-red-700">
              ✗ Failed ({failedUploads.length})
            </h3>
            <button
              onClick={onClearFailed}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
          {failedUploads.map((upload, index) => (
            <UploadProgressItem key={upload.jobId || index} upload={upload} />
          ))}
        </div>
      )}

      {/* Tip - Show only when no uploads are in progress */}
      {!hasActiveUploads && !hasCompletedUploads && !hasFailedUploads && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Large documents may take several minutes</p>
            <p className="text-blue-600">
              Processing involves parsing, embedding generation, and indexing.
              You can navigate away - progress will be restored when you return.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Document List
// =============================================================================

const DocumentList: React.FC<{
  documents: RAGDocument[];
  isLoading: boolean;
  onDelete: (docId: string) => void;
  isDeleting: string | null;
  onRefresh: () => void;
}> = ({ documents, isLoading, onDelete, isDeleting, onRefresh }) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-2">No documents uploaded yet</p>
        <p className="text-sm text-slate-400">Upload documents to start using RAG queries</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        <button
          onClick={onRefresh}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {documents.map((doc) => (
        <div
          key={doc.doc_id}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
        >
          <FileIcon type={doc.doc_type} className="w-8 h-8" />

          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 truncate">{doc.filename}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>{doc.chunk_count} chunks</span>
              <span>•</span>
              <span>{doc.word_count.toLocaleString()} words</span>
              <span>•</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
              {doc.doc_type.toUpperCase()}
            </span>

            {confirmDelete === doc.doc_id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onDelete(doc.doc_id);
                    setConfirmDelete(null);
                  }}
                  disabled={isDeleting === doc.doc_id}
                  className="px-2 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {isDeleting === doc.doc_id ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(doc.doc_id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Query Interface
// =============================================================================

const QueryInterface: React.FC<{
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  isQuerying: boolean;
  result: RAGQueryResponse | null;
  error: string | null;
}> = ({ query, setQuery, onSubmit, isQuerying, result, error }) => {
  const [showSources, setShowSources] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
            disabled={isQuerying}
          />
        </div>
        <button
          type="submit"
          disabled={isQuerying || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isQuerying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Ask</span>
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-slate-50 rounded-xl border border-slate-200">
          {/* Answer */}
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 mb-2">Answer</p>
                <p className="text-slate-900 whitespace-pre-wrap">{result.answer}</p>
              </div>
            </div>

            {/* Result Metadata */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {result.documents_searched} document{result.documents_searched !== 1 ? 's' : ''} matched
              </span>
              <span>•</span>
              <span>
                {result.chunks_retrieved ?? result.sources.length} chunks retrieved
              </span>
              <span>•</span>
              <span className={`font-medium ${
                result.confidence >= 0.7 ? 'text-green-600' :
                result.confidence >= 0.4 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(result.confidence * 100)}% confidence
              </span>
            </div>

            {result.sources.length > 0 && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-3"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{showSources ? 'Hide' : 'Show'} Sources ({result.sources.length})</span>
                {showSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Sources */}
          {showSources && result.sources.length > 0 && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {result.sources.map((source: RAGSource, index: number) => (
                <div key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileIcon type={source.doc_type || 'txt'} className="w-4 h-4" />
                      <span className="text-sm font-medium text-slate-700">
                        {source.filename || 'Unknown'}
                      </span>
                      {source.chunk_index !== null && (
                        <span className="text-xs text-slate-400">
                          Chunk {source.chunk_index + 1}
                        </span>
                      )}
                    </div>
                    {source.similarity_score !== undefined && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        source.similarity_score >= 0.7 ? 'bg-green-100 text-green-700' :
                        source.similarity_score >= 0.4 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {Math.round(source.similarity_score * 100)}% match
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-3">{source.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !error && !isQuerying && (
        <div className="text-center py-8 text-slate-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>Ask a question to search your documents</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Dashboard Component
// =============================================================================

const RAGDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'documents' | 'query'>('query');

  // Hooks
  const { isHealthy } = useRAGHealth();
  const { stats, totalDocuments, totalChunks, refresh: refreshStats, isLoading: isLoadingStats, error: statsError } = useRAGStats();
  const {
    documents,
    isLoading: isLoadingDocs,
    deleteDocument,
    isDeleting,
    refresh: refreshDocs
  } = useRAGDocuments({ autoRefresh: false });

  // Updated upload hook with async support
  const {
    uploads,
    activeUploads,
    completedUploads,
    failedUploads,
    isUploading,
    isRecovering,
    uploadFiles,
    clearCompleted,
    clearFailed,
  } = useRAGUpload({
    onSuccess: () => {
      refreshDocs();
      refreshStats();
    },
  });

  const {
    query,
    setQuery,
    result: queryResult,
    isQuerying,
    error: queryError,
    executeQuery,
  } = useRAGQuery();

  const handleFilesSelected = useCallback((files: File[]) => {
    uploadFiles(files);
  }, [uploadFiles]);

  const tabs = [
    { id: 'query' as const, label: 'Ask Questions', icon: Search },
    { id: 'upload' as const, label: 'Upload', icon: Upload, count: activeUploads.length > 0 ? activeUploads.length : undefined },
    { id: 'documents' as const, label: 'Documents', icon: FileText, count: totalDocuments || undefined },
  ];

  return (
    <div className="h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Intelligence</h1>
            <p className="text-slate-500 text-sm mt-1">Upload documents and ask questions using RAG</p>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            isHealthy ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>
            {isHealthy ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isHealthy ? 'Ready' : 'Initializing'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Recovery Banner */}
        {isRecovering && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Recovering upload progress...</span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            icon={FileText}
            label="Documents"
            value={totalDocuments}
            color="blue"
            isLoading={isLoadingStats}
            hasError={!!statsError}
          />
          <StatsCard
            icon={Database}
            label="Chunks"
            value={totalChunks}
            color="purple"
            isLoading={isLoadingStats}
            hasError={!!statsError}
          />
          <StatsCard
            icon={Cpu}
            label="Embedding Model"
            value={stats?.embedding_model || 'qwen3-embedding:4b'}
            color="green"
          />
          <StatsCard
            icon={HardDrive}
            label="Collection"
            value={stats?.collection_name || 'user_documents'}
            color="orange"
          />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Tabs */}
          <div className="border-b border-slate-200">
            <div className="flex">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      tab.id === 'upload' && activeUploads.length > 0
                        ? 'bg-orange-100 text-orange-700 animate-pulse'
                        : 'bg-slate-100'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'query' && (
              <QueryInterface
                query={query}
                setQuery={setQuery}
                onSubmit={executeQuery}
                isQuerying={isQuerying}
                result={queryResult}
                error={queryError}
              />
            )}

            {activeTab === 'upload' && (
              <UploadZone
                onFilesSelected={handleFilesSelected}
                isUploading={isUploading}
                uploads={uploads}
                activeUploads={activeUploads}
                completedUploads={completedUploads}
                failedUploads={failedUploads}
                onClearCompleted={clearCompleted}
                onClearFailed={clearFailed}
              />
            )}

            {activeTab === 'documents' && (
              <DocumentList
                documents={documents}
                isLoading={isLoadingDocs}
                onDelete={async (docId) => {
                    await deleteDocument(docId);
                    refreshDocs();
                    refreshStats();
                  }}
                isDeleting={isDeleting}
                onRefresh={refreshDocs}
              />
            )}
          </div>
        </div>

        {/* Processing Toast - Shows when uploads are active but user is on different tab */}
        {activeTab !== 'upload' && activeUploads.length > 0 && (
          <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg border border-slate-200 p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Processing Documents</p>
                <p className="text-sm text-slate-500 mt-1">
                  {activeUploads.length} file{activeUploads.length !== 1 ? 's' : ''} being processed
                </p>
                <div className="mt-2">
                  {activeUploads.slice(0, 2).map((upload, i) => (
                    <div key={i} className="text-xs text-slate-600 truncate">
                      {upload.file.name}: {upload.progress}%
                    </div>
                  ))}
                  {activeUploads.length > 2 && (
                    <div className="text-xs text-slate-400">
                      +{activeUploads.length - 2} more
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('upload')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View
              </button>
            </div>
          </div>
        )}

        {/* Completion Toast */}
        {activeTab !== 'upload' && completedUploads.length > 0 && activeUploads.length === 0 && (
          <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg border border-green-200 p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Upload Complete</p>
                <p className="text-sm text-slate-500 mt-1">
                  {completedUploads.length} file{completedUploads.length !== 1 ? 's' : ''} ready for queries
                </p>
              </div>
              <button
                onClick={clearCompleted}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGDashboard;