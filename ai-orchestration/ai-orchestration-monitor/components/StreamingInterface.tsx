// =============================================================================
// StreamingInterface - Real-time Chat with WebSocket Streaming
// =============================================================================
// Fully integrated with backend - with restored UI functionality
// FIXED: Memoized callbacks to prevent WebSocket reconnection loop
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Bot, User, Zap, Activity, Brain, Database,
  Workflow, RefreshCw, Wifi, WifiOff, Loader2, X,
  AlertCircle, Settings, Trash2, Copy, Check
} from 'lucide-react';
import { useStreaming } from '../hooks/useOrchestrationHooks';
import type { ChatMessage } from '../types';

interface StreamingInterfaceProps {
  embedded?: boolean;
  userId?: number;
  sessionId?: string;
}

export default function StreamingInterface({
  embedded = false,
  userId = 1,
  sessionId = `session_${Date.now()}`
}: StreamingInterfaceProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [localSessionId, setLocalSessionId] = useState(sessionId);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FIXED: Memoize error handler to prevent infinite reconnection loop
  // This was causing the useEffect -> connect -> disconnect cycle
  const handleStreamingError = useCallback((err: string) => {
    console.error('Streaming error:', err);
    setError('Connection lost. Please check your network or backend service.');
  }, []);

  // Use streaming hook for backend integration
  const {
    isConnected,
    isStreaming,
    messages,
    activeNodes,
    currentStreamingContent,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
  } = useStreaming({
    userId,
    sessionId: localSessionId,
    onError: handleStreamingError,  // Use memoized callback
    autoConnect: true,
  });

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingContent, scrollToBottom]);

  // Calculate metrics
  const [metrics, setMetrics] = useState({
    tokensPerSecond: 0,
    totalTokens: 0,
    latency: 0
  });

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.metrics) {
        setMetrics({
          tokensPerSecond: Math.round(lastMessage.metrics.tokensPerSecond) || 0,
          totalTokens: lastMessage.metrics.totalTokens || 0,
          latency: Math.round(lastMessage.metrics.latency) || 0
        });
      }
    }
  }, [messages]);

  // Handle sending messages
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput('');
    setError(null);

    try {
      await sendMessage(message);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  }, [input, isStreaming, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleResetSession = useCallback(() => {
    disconnect();
    clearMessages();
    setLocalSessionId(`session_${Date.now()}`);
    setError(null);
    setTimeout(() => connect(), 100);
  }, [disconnect, clearMessages, connect]);

  const copySessionId = useCallback(() => {
    navigator.clipboard.writeText(localSessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [localSessionId]);

  // Node icons
  const getNodeIcon = useCallback((node: string) => {
    const icons: Record<string, React.ReactNode> = {
      'classify_intent': <Brain className="w-4 h-4" />,
      'agent_system': <Bot className="w-4 h-4" />,
      'rag_system': <Database className="w-4 h-4" />,
      'workflow_system': <Workflow className="w-4 h-4" />,
      'synthesize_response': <Zap className="w-4 h-4" />,
      'tool_execution': <Settings className="w-4 h-4" />
    };
    return icons[node] || <Activity className="w-4 h-4" />;
  }, []);

  return (
    <div className={`flex flex-col h-full bg-white relative ${embedded ? '' : 'shadow-sm border-x border-gray-200'}`}>
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Orchestration Streaming</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time token streaming with LangGraph</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                isConnected
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Disconnected</span>
                  </>
                )}
              </div>

              {/* Metrics */}
              <div className="flex items-center space-x-6 text-sm bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-700 font-medium">{metrics.tokensPerSecond} tokens/sec</span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700 font-medium">{metrics.latency}ms latency</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                 <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetSession}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Reset Session"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <div className="w-px h-6 bg-gray-200 mx-2"></div>
                {!isConnected ? (
                  <button
                    onClick={connect}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={clearMessages}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Embedded metrics strip */}
      {embedded && (
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-1.5 text-xs font-medium ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            <span className="text-xs text-gray-400">Session: {localSessionId.slice(0, 12)}...</span>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span className="text-gray-700 font-medium">{metrics.tokensPerSecond} t/s</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Activity className="w-3 h-3 text-green-500" />
              <span className="text-gray-700 font-medium">{metrics.latency}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Nodes Display */}
      {activeNodes.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 transition-all">
          <div className="flex items-center space-x-4">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Active Nodes:</span>
            <div className="flex items-center space-x-2">
              {activeNodes.map(node => (
                <div
                  key={node}
                  className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-blue-100 animate-pulse"
                >
                  {getNodeIcon(node)}
                  <span className="text-xs font-medium text-gray-700 capitalize">
                    {node.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
        <div className={`mx-auto space-y-6 ${embedded ? 'max-w-full' : 'max-w-3xl'}`}>
          {/* Welcome message if no messages */}
          {messages.length === 0 && !currentStreamingContent && (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">AI Orchestration Ready</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Start a conversation to interact with the AI orchestration layer.
                Your messages will be processed through LangGraph workflows in real-time.
              </p>
              {!isConnected && (
                <button
                  onClick={connect}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Connect to Stream
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                }`}
              >
                {/* Message Icon */}
                <div className={`flex items-center space-x-2 mb-2 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}>
                  {message.role === 'assistant' && <Bot className="w-4 h-4 text-blue-600" />}
                  <span className={`text-xs font-medium ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.role === 'user' ? 'You' : 'AI Assistant'}
                  </span>
                  {message.role === 'user' && <User className="w-4 h-4 text-blue-100" />}
                </div>

                {/* Message Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

                {/* Metrics Badge */}
                {message.metrics && message.role === 'assistant' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>{message.metrics.totalTokens} tokens</span>
                    <span>{message.metrics.latency}ms</span>
                  </div>
                )}

                {/* Timestamp */}
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Streaming Message */}
          {currentStreamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-white text-gray-800 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-500">AI Assistant</span>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {currentStreamingContent}
                  <span className="inline-block w-2 h-4 bg-blue-600 ml-0.5 animate-pulse" />
                </p>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className={`mx-auto ${embedded ? 'max-w-full' : 'max-w-3xl'}`}>
          <div className="flex items-end space-x-4">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isConnected ? "Type your message..." : "Connect to start chatting..."}
                disabled={isStreaming}
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-[50px] max-h-[150px] transition-all disabled:bg-gray-50 disabled:text-gray-400 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || !isConnected}
                className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-xs text-gray-400">
              AI Orchestration Monitor • {localSessionId.slice(0, 16)}...
            </p>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Session Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Session ID</label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 font-mono break-all">
                    {localSessionId}
                  </code>
                  <button
                    onClick={copySessionId}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">User ID</label>
                <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 font-mono">
                  {userId}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                 <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleResetSession();
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Reset Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}