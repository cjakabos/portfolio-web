import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, User, Send, Sparkles, RefreshCw, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';

// =============================================================================
// URL CONFIGURATION
// =============================================================================
const ollamaBaseUrl = "http://localhost:11434";

// Type for Ollama model
interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

// Alert Component
const Alert = ({ severity, title, children }: { severity: 'error' | 'warning' | 'info', title: string, children: React.ReactNode }) => {
  const colors = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
  };
  const icons = {
    error: <AlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0" />,
    warning: <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />,
    info: <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[severity]}`}>
      <div className="flex items-start gap-3">
        {icons[severity]}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold mb-1">{title}</h4>
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

const ChatLLM: React.FC = () => {
  // Model selection state
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Chat state
  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status
  } = useChat({
    transport: new DefaultChatTransport({
      api: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":5333/api/chat"
    }),
  });

  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Helper function to format model size
  function formatModelSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  // Fetch available models from Ollama
  async function fetchOllamaModels() {
    setModelsLoading(true);
    setModelsError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const allModels = data.models || [];

      // Filter out embedding models - they can't be used for chat
      const models = allModels.filter((m: OllamaModel) =>
        !m.name.toLowerCase().includes('embed')
      );

      if (models.length === 0) {
        setModelsError("no_models");
        setAvailableModels([]);
        setSelectedModel("");
        return;
      }

      setAvailableModels(models);
      const defaultModel = models[0].name;
      setSelectedModel(defaultModel);
      setModelsError(null);
    } catch (error: any) {
      console.warn("Ollama connection check:", error?.message || "Connection failed");

      const isTimeout = error?.name === 'AbortError' || error?.message?.includes('timeout');

      if (isTimeout) {
        setModelsError("timeout");
      } else {
        setModelsError("connection_failed");
      }

      setAvailableModels([]);
      setSelectedModel("");
    } finally {
      setModelsLoading(false);
    }
  }

  const prevModelRef = useRef<string>("");

  useEffect(() => {
    fetchOllamaModels();
  }, []);

  // Clear chat when model changes (but not on initial load)
  useEffect(() => {
    if (prevModelRef.current && selectedModel && prevModelRef.current !== selectedModel) {
      console.log("Model changed from", prevModelRef.current, "to", selectedModel, "- clearing chat");
      setMessages([]);
    }
    prevModelRef.current = selectedModel;
  }, [selectedModel, setMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel || modelsError) return;

    // Quick health check before sending - verify Ollama is still running
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) throw new Error('Ollama not responding');
    } catch {
      console.warn("Ollama health check failed, refreshing models...");
      await fetchOllamaModels();
      return;
    }

    // Store current model to avoid stale closure issues
    const currentModel = selectedModel;
    console.log("Sending message with model:", currentModel);

    sendMessage(
      { role: 'user', parts: [{ type: 'text', text: input }] },
      { body: { model: currentModel } },
    );
    setInput('');
  };

  const isChatLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-3">
        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
          <Bot size={24} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 dark:text-white">Local GPT</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Private AI Assistant</p>
        </div>
      </div>

      {/* Model Selector */}
      <div className="p-3 border-b bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Connection Failed Error */}
        {modelsError === "connection_failed" && (
          <div className="space-y-3">
            <Alert severity="error" title="Cannot connect to Ollama">
              <p className="mb-3">Unable to reach the Ollama server at <code className="bg-red-100 dark:bg-red-800 px-1 rounded">{ollamaBaseUrl}</code></p>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700 mt-3">
                <h5 className="font-bold text-gray-900 dark:text-white mb-3">🚀 Quick Setup Guide</h5>

                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 1: Install Ollama</p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                      <p className="text-gray-600 dark:text-gray-400"># macOS / Linux:</p>
                      <p>curl -fsSL https://ollama.com/install.sh | sh</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-2"># Windows: Download from https://ollama.com/download</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 2: Start Ollama Service</p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                      <p>ollama serve</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Keep this terminal open while using the app</p>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 3: Pull a Model</p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs space-y-1">
                      <p className="text-gray-600 dark:text-gray-400"># Small & fast (recommended for testing):</p>
                      <p>ollama pull qwen3:1.7b</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-2"># Better quality:</p>
                      <p>ollama pull llama3.2</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-2"># Best quality (requires more RAM):</p>
                      <p>ollama pull mistral</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 4: Verify Installation</p>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                      <p>ollama list</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This should show your installed models</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    📖 Full documentation: <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">ollama.com</a>
                  </p>
                </div>
              </div>
            </Alert>

            <button
              onClick={fetchOllamaModels}
              disabled={modelsLoading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {modelsLoading ? "Checking connection..." : "Retry Connection"}
            </button>
          </div>
        )}

        {/* Timeout Error */}
        {modelsError === "timeout" && (
          <div className="space-y-3">
            <Alert severity="warning" title="Connection timeout">
              <p>Ollama server is not responding. This can happen if:</p>
              <ul className="list-disc ml-4 mt-2 text-sm">
                <li>Ollama is still starting up</li>
                <li>A model is being loaded for the first time</li>
                <li>The server is processing a heavy request</li>
              </ul>
              <p className="mt-2 text-sm">Wait a moment and try again.</p>
            </Alert>

            <button
              onClick={fetchOllamaModels}
              disabled={modelsLoading}
              className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {modelsLoading ? "Checking..." : "Retry Connection"}
            </button>
          </div>
        )}

        {/* No Models Error */}
        {modelsError === "no_models" && (
          <div className="space-y-3">
            <Alert severity="warning" title="No models installed">
              <p className="mb-3">Ollama is running but no models are installed yet.</p>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-700 mt-3">
                <h5 className="font-bold text-gray-900 dark:text-white mb-3">📦 Install a Model</h5>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Open a terminal and run one of these commands:
                </p>

                <div className="space-y-3 text-sm">
                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">qwen3:1.7b</span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">Recommended</span>
                    </div>
                    <code className="text-xs">ollama pull qwen3:1.7b</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~1.5 GB • Fast • Good for testing</p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">llama3.2</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">Balanced</span>
                    </div>
                    <code className="text-xs">ollama pull llama3.2</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~2 GB • Good quality • Meta&apos;s latest</p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">mistral</span>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded">High Quality</span>
                    </div>
                    <code className="text-xs">ollama pull mistral</code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~4 GB • Excellent quality • Requires 8GB+ RAM</p>
                  </div>
                </div>
              </div>
            </Alert>

            <button
              onClick={fetchOllamaModels}
              disabled={modelsLoading}
              className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {modelsLoading ? "Checking..." : "Check for Models"}
            </button>
          </div>
        )}

        {/* Unknown Error */}
        {modelsError === "unknown" && (
          <div className="space-y-3">
            <Alert severity="error" title="Failed to fetch models">
              <p>An unexpected error occurred while connecting to Ollama.</p>
              <p className="mt-2 text-sm">Check the browser console for more details.</p>
            </Alert>

            <button
              onClick={fetchOllamaModels}
              disabled={modelsLoading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {modelsLoading ? "Checking..." : "Retry"}
            </button>
          </div>
        )}

        {/* Model Dropdown - only show when no errors */}
        {!modelsError && (
          <>
            <div className="mb-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">AI Model</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={modelsLoading || availableModels.length === 0}
              >
                {modelsLoading ? (
                  <option value="" disabled>Loading models...</option>
                ) : (
                  availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.details.parameter_size} • {formatModelSize(model.size)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchOllamaModels}
                disabled={modelsLoading}
                className="text-sm px-3 py-1.5 rounded flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {modelsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {modelsLoading ? "Checking..." : "Refresh Models"}
              </button>
              {selectedModel && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                  ✓ {selectedModel}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center opacity-50">
            <Sparkles size={64} className="mb-4" />
            <h3 className="text-xl font-bold mb-2">How can I help today?</h3>
            {modelsError ? (
              <p>⚠️ Please fix the Ollama setup above to start chatting.</p>
            ) : selectedModel ? (
              <>
                <p>You can start chatting below.</p>
                <p className="text-sm mt-2">Current model: <strong>{selectedModel}</strong></p>
              </>
            ) : modelsLoading ? (
              <p className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading available models...</p>
            ) : (
              <p>Select a model above to start chatting.</p>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            {/* Render User Text & Reasoning */}
            {message.parts?.map((part: any, i: number) => {
              const isUser = message.role === 'user';
              const baseClasses = `flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`;
              const avatarClasses = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-green-600'} text-white`;
              const bubbleClasses = `max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm`;

              if (part.type === "text" && isUser) {
                return (
                  <div key={i} className={baseClasses}>
                    <div className={avatarClasses}><User size={16} /></div>
                    <div className={`${bubbleClasses} bg-green-300 dark:bg-green-300 text-black dark:text-black rounded-tr-none`}>{part.text}</div>
                  </div>
                );
              }

              if (part.type === "reasoning") {
                return (
                  <div key={i} className={baseClasses}>
                    <div className={avatarClasses}><Bot size={16} /></div>
                    <details open className={`${bubbleClasses} bg-blue-300 dark:bg-blue-300 text-gray-900 dark:text-black rounded-tl-none`}>
                      <summary className="font-semibold cursor-pointer mb-2">Reasoning</summary>
                      {part.text}
                    </details>
                  </div>
                );
              }
              return null;
            })}

            {/* Render Bot Text */}
            {message.parts?.map((part: any, i: number) => {
              const isUser = message.role === 'user';
              const baseClasses = `flex gap-4`;
              const avatarClasses = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-600 text-white`;
              const bubbleClasses = `max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm`;

              if (part.type === "text" && !isUser && part.text) {
                return (
                  <div key={i} className={baseClasses}>
                    <div className={avatarClasses}><Bot size={16} /></div>
                    <div className={`${bubbleClasses} bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none`}>
                      {part.text}
                    </div>
                  </div>
                );
              }
              return null;
            })}


          </div>
        ))}

        {isChatLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
              {[0, 75, 150].map(d => <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form className="shrink-0 border-t p-3" onSubmit={handleSubmit}>
          <input
            type="text"
            className="w-full bg-gray-100 dark:bg-gray-700 border-0 rounded-full px-6 py-3 pr-14 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-500 disabled:opacity-50"
            placeholder={modelsError ? "Fix Ollama setup to enable chat" : "Message GPT..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!selectedModel || !!modelsError}
          />
          <button
            type="submit"
            disabled={!input.trim() || !selectedModel || !!modelsError || isChatLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Send size={18} />
          </button>
        </form>
        {isChatLoading && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => { stop(); setMessages([]); }}
              className="text-xs px-3 py-1.5 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700"
            >
              Stop generating
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLLM;
