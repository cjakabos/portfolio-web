// ============================================================================
// File: frontend-ai/src/components/ModelSelector.tsx
// Shared Model Selector Component
// ============================================================================
// A dropdown component for selecting Ollama models with connection error handling
// UPDATED: Full-page error states, removed hardcoded model names
// ============================================================================

import React, { useState } from 'react';
import {
  ChevronDown,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Cpu,
  Server,
  ExternalLink,
  Terminal,
  Download,
} from 'lucide-react';
import {
  useOllamaModels,
  formatModelSize,
  formatModelName,
  type ModelTarget,
  type OllamaModel,
} from '../hooks/useOllamaModels';

// ============================================================================
// OLLAMA SETUP GUIDE - Exported for use in full-page views
// ============================================================================

export interface OllamaSetupGuideProps {
  ollamaUrl?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Type of models needed - affects install suggestions */
  modelType?: 'chat' | 'embedding';
  /** Show as full page (centered, max-width) vs inline */
  fullPage?: boolean;
}

export const OllamaSetupGuide: React.FC<OllamaSetupGuideProps> = ({
  ollamaUrl = 'http://localhost:11434',
  onRetry,
  isRetrying = false,
  modelType = 'chat',
  fullPage = false,
}) => {
  const isEmbedding = modelType === 'embedding';

  const content = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
        <div className="flex items-center gap-3 text-white">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold">Cannot Connect to Ollama</h2>
            <p className="text-red-100 text-sm">
              Unable to reach <code className="bg-white/20 px-1.5 py-0.5 rounded">{ollamaUrl}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Setup Steps */}
      <div className="p-6 space-y-6">
        <div className="text-center mb-6">
          <p className="text-slate-600">
            Ollama is required to run AI models locally. Follow these steps to get started:
          </p>
        </div>

        {/* Step 1: Install */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Install Ollama
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">macOS / Linux:</p>
                <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                  curl -fsSL https://ollama.com/install.sh | sh
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Windows:</p>
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Download from ollama.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Start */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Start Ollama Service
            </h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                ollama serve
              </code>
              <p className="text-xs text-slate-500 mt-2">
                Keep this terminal window open while using the app
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Pull Model */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            3
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Pull a Model
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              {isEmbedding ? (
                <>
                  <p className="text-sm text-slate-600 mb-2">
                    Document search requires an embedding model:
                  </p>
                  <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                    ollama pull &lt;embedding-model&gt;
                  </code>
                  <p className="text-xs text-slate-500">
                    Browse embedding models at{' '}
                    <a href="https://ollama.com/search?c=embedding" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      ollama.com/search?c=embedding
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-2">
                    Pull a chat/LLM model based on your hardware:
                  </p>
                  <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                    ollama pull &lt;model-name&gt;
                  </code>
                  <p className="text-xs text-slate-500 mt-2">
                    Browse available models at{' '}
                    <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      ollama.com/library
                    </a>
                  </p>
                  <p className="text-xs text-slate-500">
                    Choose based on your RAM: smaller models (~1-3B) for 4GB+, medium (~7B) for 8GB+, large (~13B+) for 16GB+
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 4: Verify */}
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
            4
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-2">Verify Installation</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                ollama list
              </code>
              <p className="text-xs text-slate-500 mt-2">
                This should display your installed models
              </p>
            </div>
          </div>
        </div>

        {/* Retry Button */}
        {onRetry && (
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking connection...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Retry Connection
                </>
              )}
            </button>
          </div>
        )}

        {/* Help Link */}
        <div className="text-center pt-2">
          <a
            href="https://ollama.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-blue-600 inline-flex items-center gap-1"
          >
            Need help? Visit ollama.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="w-full max-w-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

// ============================================================================
// NO MODELS GUIDE - Exported for use in full-page views
// ============================================================================

export interface NoModelsGuideProps {
  onRetry?: () => void;
  isRetrying?: boolean;
  /** Type of models needed */
  modelType?: 'chat' | 'embedding';
  /** Show as full page */
  fullPage?: boolean;
}

export const NoModelsGuide: React.FC<NoModelsGuideProps> = ({
  onRetry,
  isRetrying = false,
  modelType = 'chat',
  fullPage = false,
}) => {
  const isEmbedding = modelType === 'embedding';

  const content = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4">
        <div className="flex items-center gap-3 text-white">
          <AlertCircle className="w-6 h-6" />
          <div>
            <h2 className="text-lg font-bold">
              {isEmbedding ? 'No Embedding Models Found' : 'No Models Available'}
            </h2>
            <p className="text-yellow-100 text-sm">
              {isEmbedding
                ? 'Document search requires an embedding model'
                : 'Ollama is running but no models are installed'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Install Guide */}
      <div className="p-6 space-y-4">
        <p className="text-slate-600">
          {isEmbedding
            ? 'Pull an embedding model to enable document search and RAG capabilities:'
            : 'Pull a chat/LLM model to start using AI:'
          }
        </p>

        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          {isEmbedding ? (
            <>
              <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                ollama pull &lt;embedding-model&gt;
              </code>
              <p className="text-xs text-slate-500">
                Browse embedding models at{' '}
                <a href="https://ollama.com/search?c=embedding" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  ollama.com/search?c=embedding
                </a>
              </p>
            </>
          ) : (
            <>
              <code className="block bg-slate-900 text-green-400 px-3 py-2 rounded text-sm font-mono">
                ollama pull &lt;model-name&gt;
              </code>
              <p className="text-xs text-slate-500">
                Browse available models at{' '}
                <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  ollama.com/library
                </a>
              </p>
              <p className="text-xs text-slate-500">
                Choose based on your RAM: smaller models (~1-3B) for 4GB+, medium (~7B) for 8GB+, large (~13B+) for 16GB+
              </p>
            </>
          )}
        </div>

        <p className="text-sm text-slate-500">
          After pulling a model, click the button below to refresh.
        </p>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Checking for models...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Refresh Models
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="w-full max-w-xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

// ============================================================================
// MODEL SELECTOR PROPS
// ============================================================================

export interface ModelSelectorProps {
  /** Which system this selector is for */
  target: ModelTarget;
  /** Label for the selector */
  label?: string;
  /** Callback when model changes */
  onModelChange?: (model: string) => void;
  /** Show compact version (for headers) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show full-page setup guide on errors (for main content areas) */
  fullPageErrors?: boolean;
  /** Filter models - only show models whose name includes this string (e.g., "embed") */
  filter?: string;
  /** Exclude models - hide models whose name includes this string (e.g., "embed") */
  excludeFilter?: string;
}

// ============================================================================
// MODEL SELECTOR COMPONENT
// ============================================================================

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  target,
  label,
  onModelChange,
  compact = false,
  className = '',
  fullPageErrors = false,
  filter,
  excludeFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const {
    models,
    filteredModels,
    isLoading,
    error,
    ollamaUrl,
    isConnected,
    currentChatModel,
    currentRagModel,
    embeddingModel,
    fetchModels,
    setModel,
    hasModels,
  } = useOllamaModels({ filter, excludeFilter });

  // Use filtered models for display
  const displayModels = (filter || excludeFilter) ? filteredModels : models;
  const hasDisplayModels = displayModels.length > 0;

  // Determine current model based on target
  const rawCurrentModel = target === 'chat' ? currentChatModel
    : target === 'embedding' ? embeddingModel
    : currentRagModel;

  // Only show the current model if it actually exists in available models
  const currentModelExists = displayModels.some(m => m.name === rawCurrentModel);
  const currentModel = currentModelExists ? rawCurrentModel : '';

  const defaultLabel = target === 'chat' ? 'Chat Model'
    : target === 'embedding' ? 'Embedding Model'
    : 'RAG Model';

  // Determine model type for guides
  // If filtering FOR embed, it's embedding. If excluding embed, it's chat.
  const modelType = (target === 'embedding' || filter?.includes('embed')) ? 'embedding' : 'chat';

  // Handle model selection
  const handleSelectModel = async (model: OllamaModel) => {
    setIsChanging(true);
    setIsOpen(false);

    const success = await setModel(model.name, target);

    if (success && onModelChange) {
      onModelChange(model.name);
    }

    setIsChanging(false);
  };

  // ============================================================================
  // CONNECTION ERROR STATE
  // ============================================================================

  if (!isConnected && !isLoading) {
    if (fullPageErrors) {
      return (
        <OllamaSetupGuide
          ollamaUrl={ollamaUrl}
          onRetry={fetchModels}
          isRetrying={isLoading}
          modelType={modelType}
          fullPage={true}
        />
      );
    }

    // Compact error for headers
    if (compact) {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-lg text-sm text-red-700 ${className}`}>
          <AlertCircle size={14} />
          <span>Ollama not connected</span>
        </div>
      );
    }

    return (
      <OllamaSetupGuide
        ollamaUrl={ollamaUrl}
        onRetry={fetchModels}
        isRetrying={isLoading}
        modelType={modelType}
        fullPage={false}
      />
    );
  }

  // ============================================================================
  // NO MODELS STATE
  // ============================================================================

  if (isConnected && !hasDisplayModels && !isLoading) {
    if (fullPageErrors) {
      return (
        <NoModelsGuide
          onRetry={fetchModels}
          isRetrying={isLoading}
          modelType={modelType}
          fullPage={true}
        />
      );
    }

    // Compact error for headers
    if (compact) {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-lg text-sm text-yellow-700 ${className}`}>
          <AlertCircle size={14} />
          <span>{modelType === 'embedding' ? 'No embedding models' : 'No models'}</span>
          <button
            onClick={fetchModels}
            className="ml-1 hover:text-yellow-900"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      );
    }

    return (
      <NoModelsGuide
        onRetry={fetchModels}
        isRetrying={isLoading}
        modelType={modelType}
        fullPage={false}
      />
    );
  }

  // ============================================================================
  // COMPACT SELECTOR (for headers)
  // ============================================================================

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || isChanging || !hasDisplayModels}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors disabled:opacity-50"
        >
          {isLoading || isChanging ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    {label || defaultLabel}:
                </label>
            </>
          )}
          <span className="max-w-[120px] truncate">
            {currentModel ? formatModelName(currentModel) : 'Select Model'}
          </span>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[200px] max-h-[300px] overflow-y-auto">
              {displayModels.map((model) => (
                <button
                  key={model.name}
                  onClick={() => handleSelectModel(model)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                    model.name === currentModel ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="truncate">{formatModelName(model.name)}</span>
                  {model.name === currentModel && <Check size={14} className="text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ============================================================================
  // FULL SELECTOR (for settings/config panels)
  // ============================================================================

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Cpu size={16} />
          {label || defaultLabel}
        </label>
        <button
          onClick={fetchModels}
          disabled={isLoading}
          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
          title="Refresh models"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || isChanging || !hasDisplayModels}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            {isLoading || isChanging ? (
              <Loader2 size={16} className="animate-spin text-blue-600" />
            ) : (
              <Server size={16} className="text-slate-400" />
            )}
            <span className={currentModel ? 'text-slate-900' : 'text-slate-400'}>
              {isLoading ? 'Loading models...' : isChanging ? 'Changing model...' : currentModel ? formatModelName(currentModel) : 'Select a model'}
            </span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 max-h-[300px] overflow-y-auto">
              {displayModels.map((model) => (
                <button
                  key={model.name}
                  onClick={() => handleSelectModel(model)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 ${
                    model.name === currentModel ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatModelName(model.name)}</span>
                    <div className="flex items-center gap-2">
                      {model.size && (
                        <span className="text-xs text-slate-400">{formatModelSize(model.size)}</span>
                      )}
                      {model.name === currentModel && (
                        <Check size={16} className="text-blue-600" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;