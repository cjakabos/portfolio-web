// =============================================================================
// ToolsExplorer - Tool Discovery & Invocation
// =============================================================================
// Fully integrated with backend - no mock data
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Wrench, Search, Play, Code, ChevronRight, ChevronDown,
  AlertCircle, CheckCircle, Clock, Loader2, RefreshCw,
  FileJson, Settings, Zap, BookOpen
} from 'lucide-react';
import { useTools, useOllamaStatus } from '../hooks/useOrchestrationHooks';
import type { ToolInfo, ToolInvocationResponse } from '../types';

interface ToolsExplorerProps {
  embedded?: boolean;
}

export default function ToolsExplorer({ embedded = false }: ToolsExplorerProps) {
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [invocationResult, setInvocationResult] = useState<ToolInvocationResponse | null>(null);

  // Hook for backend integration
  const {
    tools,
    categories,
    isLoading,
    error,
    refresh,
    invokeTool,
    invoking,
    invokeError
  } = useTools();

  // Ollama status check — triggered when tools fail to load
  const { status: ollamaStatus, isLoading: ollamaChecking, checkStatus: checkOllama } = useOllamaStatus();

  useEffect(() => {
    if (error) {
      checkOllama();
    }
  }, [error, checkOllama]);

  const handleRetry = useCallback(async () => {
    await refresh();
    // Re-check Ollama status after retry
    checkOllama();
  }, [refresh, checkOllama]);

  // Filter tools
  const filteredTools = tools.filter(tool => {
    const matchesSearch = !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group tools by category
  const toolsByCategory = filteredTools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Select a tool
  const handleSelectTool = (tool: ToolInfo) => {
    setSelectedTool(tool);
    setInvocationResult(null);
    // Initialize parameter values with defaults
    const defaults: Record<string, string> = {};
    tool.parameters.forEach(param => {
      defaults[param.name] = param.default !== undefined ? String(param.default) : '';
    });
    setParameterValues(defaults);
  };

  // Invoke tool
  const handleInvokeTool = async () => {
    if (!selectedTool) return;

    try {
      // Build parameters object
      const params: Record<string, unknown> = {};
      selectedTool.parameters.forEach(param => {
        const value = parameterValues[param.name];
        if (value !== undefined && value !== '') {
          // Try to parse JSON for object/array types
          if (param.type === 'object' || param.type === 'array') {
            try {
              params[param.name] = JSON.parse(value);
            } catch {
              params[param.name] = value;
            }
          } else if (param.type === 'number' || param.type === 'integer') {
            params[param.name] = Number(value);
          } else if (param.type === 'boolean') {
            params[param.name] = value === 'true';
          } else {
            params[param.name] = value;
          }
        }
      });

      const result = await invokeTool(selectedTool.name, params);
      setInvocationResult(result);
    } catch (err) {
      console.error('Tool invocation failed:', err);
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'data': <FileJson className="w-4 h-4" />,
      'api': <Zap className="w-4 h-4" />,
      'utility': <Settings className="w-4 h-4" />,
      'ml': <Code className="w-4 h-4" />,
      'default': <Wrench className="w-4 h-4" />
    };
    return icons[category.toLowerCase()] || icons.default;
  };

  // Get parameter type color
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'string': 'text-green-600 bg-green-50',
      'number': 'text-blue-600 bg-blue-50',
      'integer': 'text-blue-600 bg-blue-50',
      'boolean': 'text-purple-600 bg-purple-50',
      'object': 'text-orange-600 bg-orange-50',
      'array': 'text-yellow-600 bg-yellow-50',
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className={`${embedded ? '' : 'p-6 max-w-7xl mx-auto'}`}>
      {/* Header */}
      {!embedded && (
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tools Explorer</h1>
            <p className="text-gray-500 text-sm mt-1">
              Discover and test available orchestration tools
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Error Banner — Ollama-aware */}
      {error && ollamaStatus?.error === 'backend_offline' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">AI Backend is not running</span>
          </div>
          <p className="text-sm text-red-600 mt-2">
            The AI orchestration backend is offline. This usually means Ollama was not running when the backend started.
          </p>
          <div className="mt-3 bg-white rounded-lg p-4 border border-red-200 text-sm">
            <p className="font-semibold text-gray-800 mb-2">To fix this:</p>
            <ol className="list-decimal ml-4 space-y-1 text-gray-700">
              <li>Start Ollama: <code className="bg-gray-100 px-1 rounded">ollama serve</code></li>
              <li>Ensure a model is installed: <code className="bg-gray-100 px-1 rounded">ollama pull qwen3:1.7b</code></li>
              <li>Restart the AI backend container: <code className="bg-gray-100 px-1 rounded">docker compose -f docker-compose-app.yml restart ai-orchestration-layer</code></li>
            </ol>
          </div>
          <button
            onClick={handleRetry}
            disabled={isLoading || ollamaChecking}
            className="mt-3 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || ollamaChecking ? 'animate-spin' : ''}`} />
            {isLoading || ollamaChecking ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      )}

      {error && ollamaStatus?.error === 'connection_failed' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">Cannot connect to Ollama</span>
          </div>
          <p className="text-sm text-red-600 mt-2">
            The AI backend is running but cannot reach Ollama.
          </p>
          <div className="mt-3 bg-white rounded-lg p-4 border border-red-200 text-sm">
            <p className="font-semibold text-gray-800 mb-2">To fix this:</p>
            <ol className="list-decimal ml-4 space-y-1 text-gray-700">
              <li>Start Ollama: <code className="bg-gray-100 px-1 rounded">ollama serve</code></li>
              <li>Pull a model: <code className="bg-gray-100 px-1 rounded">ollama pull qwen3:1.7b</code></li>
              <li>Verify: <code className="bg-gray-100 px-1 rounded">ollama list</code></li>
            </ol>
          </div>
          <button
            onClick={handleRetry}
            disabled={isLoading || ollamaChecking}
            className="mt-3 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || ollamaChecking ? 'animate-spin' : ''}`} />
            {isLoading || ollamaChecking ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      )}

      {error && ollamaStatus?.error === 'timeout' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center text-amber-700">
            <Clock className="w-5 h-5 mr-2" />
            <span className="font-medium">Ollama connection timeout</span>
          </div>
          <p className="text-sm text-amber-600 mt-2">
            Ollama is not responding. It may still be starting up or loading a model.
          </p>
          <button
            onClick={handleRetry}
            disabled={isLoading || ollamaChecking}
            className="mt-3 flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || ollamaChecking ? 'animate-spin' : ''}`} />
            {isLoading || ollamaChecking ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      )}

      {error && ollamaStatus?.error === 'no_models' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center text-amber-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">No chat models installed</span>
          </div>
          <p className="text-sm text-amber-600 mt-2">
            Ollama is running but no chat models are available.
          </p>
          <div className="mt-3 bg-white rounded-lg p-4 border border-amber-200 text-sm">
            <p className="font-semibold text-gray-800 mb-2">Install a model:</p>
            <div className="space-y-2 text-gray-700">
              <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                <span className="text-gray-500"># Small & fast:</span><br/>
                ollama pull qwen3:1.7b
              </div>
              <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                <span className="text-gray-500"># Better quality:</span><br/>
                ollama pull llama3.2
              </div>
            </div>
          </div>
          <button
            onClick={handleRetry}
            disabled={isLoading || ollamaChecking}
            className="mt-3 flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || ollamaChecking ? 'animate-spin' : ''}`} />
            {isLoading || ollamaChecking ? 'Checking...' : 'Check for Models'}
          </button>
        </div>
      )}

      {/* Fallback: unknown error or ollamaStatus not yet loaded */}
      {error && ollamaStatus && !['backend_offline', 'connection_failed', 'timeout', 'no_models'].includes(ollamaStatus.error || '') && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">Failed to load tools</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 text-red-700 hover:text-red-800 text-sm underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading state while checking Ollama */}
      {error && !ollamaStatus && ollamaChecking && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center text-gray-600">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            <span className="font-medium">Checking connection status...</span>
          </div>
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
        CloudApp tools run in admin monitor mode. Provide the target username in tool parameters when required.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tools List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Search & Filter */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tools */}
          <div className="max-h-[600px] overflow-y-auto">
            {isLoading && tools.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-500">Loading tools...</span>
              </div>
            ) : Object.keys(toolsByCategory).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No tools found</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              Object.entries(toolsByCategory).map(([category, categoryTools]) => (
                <div key={category} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="font-medium text-gray-900 capitalize">{category}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {categoryTools.length}
                      </span>
                    </div>
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedCategories.has(category) && (
                    <div className="bg-gray-50">
                      {categoryTools.map(tool => (
                        <button
                          key={tool.name}
                          onClick={() => handleSelectTool(tool)}
                          className={`w-full px-6 py-3 text-left hover:bg-gray-100 transition-colors border-l-2 ${
                            selectedTool?.name === tool.name
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-transparent'
                          }`}
                        >
                          <h4 className="font-medium text-gray-900 text-sm">{tool.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {tool.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{tools.length} tools available</span>
              <span>{categories.length} categories</span>
            </div>
          </div>
        </div>

        {/* Tool Details & Invocation */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTool ? (
            <>
              {/* Tool Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedTool.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">{selectedTool.description}</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                      {selectedTool.category}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {/* Parameters */}
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                    Parameters
                  </h3>
                  
                  {selectedTool.parameters.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No parameters required</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedTool.parameters.map(param => (
                        <div key={param.name} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <label className="font-medium text-gray-900 text-sm">
                              {param.name}
                            </label>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(param.type)}`}>
                              {param.type}
                            </span>
                            {param.required && (
                              <span className="text-red-500 text-xs">*required</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{param.description}</p>
                          
                          {param.type === 'boolean' ? (
                            <select
                              value={parameterValues[param.name] || ''}
                              onChange={(e) => setParameterValues({
                                ...parameterValues,
                                [param.name]: e.target.value
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select...</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : param.type === 'object' || param.type === 'array' ? (
                            <textarea
                              value={parameterValues[param.name] || ''}
                              onChange={(e) => setParameterValues({
                                ...parameterValues,
                                [param.name]: e.target.value
                              })}
                              placeholder={`Enter ${param.type} as JSON...`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                              rows={3}
                            />
                          ) : (
                            <input
                              type={param.type === 'number' || param.type === 'integer' ? 'number' : 'text'}
                              value={parameterValues[param.name] || ''}
                              onChange={(e) => setParameterValues({
                                ...parameterValues,
                                [param.name]: e.target.value
                              })}
                              placeholder={param.default !== undefined ? `Default: ${param.default}` : `Enter ${param.type}...`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Examples */}
                  {selectedTool.examples && selectedTool.examples.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Examples
                      </h3>
                      <div className="space-y-2">
                        {selectedTool.examples.map((example, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700">
                            {example}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoke Button */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleInvokeTool}
                      disabled={invoking === selectedTool.name}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      {invoking === selectedTool.name ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Invoking...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Invoke Tool
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Invocation Result */}
              {(invocationResult || invokeError) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className={`px-6 py-4 border-b flex items-center justify-between ${
                    invocationResult?.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {invocationResult?.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <h3 className={`font-bold ${
                        invocationResult?.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {invocationResult?.success ? 'Success' : 'Failed'}
                      </h3>
                    </div>
                    {invocationResult?.latency_ms && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {invocationResult.latency_ms}ms
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    {invokeError ? (
                      <div className="text-red-600 text-sm">
                        <p className="font-medium mb-2">Error:</p>
                        <p>{invokeError}</p>
                      </div>
                    ) : invocationResult?.error ? (
                      <div className="text-red-600 text-sm">
                        <p className="font-medium mb-2">Error:</p>
                        <p>{invocationResult.error}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Result:</p>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                          {JSON.stringify(invocationResult?.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Tool</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Choose a tool from the list to view its details, parameters, and test it with live invocation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
