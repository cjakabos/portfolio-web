// =============================================================================
// StreamingInterface - Real-time Chat with WebSocket Streaming
// =============================================================================
// UPDATED: Added model selector dropdown with full-page error states
// =============================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Bot, User, Zap, Activity, Brain, Database,
  Workflow, RefreshCw, Wifi, WifiOff, Loader2, X,
  AlertCircle, Settings, Trash2, Copy, Check, Clock, Cpu
} from 'lucide-react';
import { useStreaming } from '../hooks/useOrchestrationHooks';
import { useConversationSync, SyncedMessage } from '../hooks/useConversationSync';
import { getPersistentSessionId } from '../utils/sessionUtils';
import { ModelSelector } from './ModelSelector';
import type { ChatMessage } from '../types';

interface StreamingInterfaceProps {
  embedded?: boolean;
  userId?: number;
  sessionId?: string;
}

export default function StreamingInterface({
  embedded = false,
  userId = 1,
  sessionId
}: StreamingInterfaceProps) {

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  // FIX: Use persistent session ID if none provided
  const effectiveSessionId = sessionId || getPersistentSessionId();
  const [localSessionId, setLocalSessionId] = useState(effectiveSessionId);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  // ==========================================================================
  // FIX: Local state for synced messages from approval resumes
  // ==========================================================================
  const [syncedMessages, setSyncedMessages] = useState<ChatMessage[]>([]);

  // ==========================================================================
  // FIX: Pending user messages with sessionStorage persistence
  // ==========================================================================
  const [pendingUserMessages, setPendingUserMessages] = useState<ChatMessage[]>([]);

  // Load pending messages from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`pending_messages_${localSessionId}`);
      console.log('[StreamingInterface] Loading pending messages for session:', localSessionId, 'Found:', stored);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('[StreamingInterface] Restored pending messages:', parsed.length);
          setPendingUserMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load pending messages:', e);
    }
  }, [localSessionId]);

  // Persist pending messages to sessionStorage whenever they change
  useEffect(() => {
    console.log('[StreamingInterface] Pending messages changed:', pendingUserMessages.length, pendingUserMessages.map(m => m.content.slice(0, 30)));
    try {
      if (pendingUserMessages.length > 0) {
        sessionStorage.setItem(
          `pending_messages_${localSessionId}`,
          JSON.stringify(pendingUserMessages)
        );
      } else {
        sessionStorage.removeItem(`pending_messages_${localSessionId}`);
      }
    } catch (e) {
      console.warn('Failed to persist pending messages:', e);
    }
  }, [pendingUserMessages, localSessionId]);

  // FIXED: Memoize error handler to prevent infinite reconnection loop
  const handleStreamingError = useCallback((err: string) => {
    console.error('Streaming error:', err);
    setError('Connection lost. Please check your network or backend service.');
  }, []);

  // Use streaming hook for backend integration
  const {
    isConnected,
    isStreaming,
    messages: streamingMessages,
    activeNodes,
    currentStreamingContent,
    connect,
    disconnect,
    sendMessage: sendStreamingMessage,
    clearMessages,
  } = useStreaming({
    userId,
    sessionId: localSessionId,
    onError: handleStreamingError,
    autoConnect: true,
  });

  // ==========================================================================
  // Merge all message sources with proper deduplication
  // ==========================================================================
  const messages = useMemo(() => {
    console.log('[StreamingInterface] Merging messages - streaming:', streamingMessages.length,
                'synced:', syncedMessages.length, 'pending:', pendingUserMessages.length);

    const streamingIds = new Set(streamingMessages.map(m => m.id));
    const syncedIds = new Set(syncedMessages.map(m => m.id));

    const syncedUserContents = new Set(
      syncedMessages.filter(m => m.role === 'user').map(m => m.content)
    );

    const streamingUserContents = new Set(
      streamingMessages.filter(m => m.role === 'user').map(m => m.content)
    );

    const uniqueSyncedMessages = syncedMessages.filter(
      m => !streamingIds.has(m.id)
    );

    const uniquePendingMessages = pendingUserMessages.filter(pending => {
      if (streamingIds.has(pending.id) || syncedIds.has(pending.id)) {
        console.log('[StreamingInterface] Filtering pending (by ID):', pending.content.slice(0, 30));
        return false;
      }
      if (syncedUserContents.has(pending.content)) {
        console.log('[StreamingInterface] Filtering pending (synced):', pending.content.slice(0, 30));
        return false;
      }
      if (streamingUserContents.has(pending.content)) {
        console.log('[StreamingInterface] Filtering pending (in streaming):', pending.content.slice(0, 30));
        return false;
      }
      return true;
    });

    console.log('[StreamingInterface] After filtering - unique pending:', uniquePendingMessages.length);

    const allMessages = [...streamingMessages, ...uniqueSyncedMessages, ...uniquePendingMessages];

    return allMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [streamingMessages, syncedMessages, pendingUserMessages]);

  // ==========================================================================
  // Clean up pending messages when response received
  // ==========================================================================
  useEffect(() => {
    if (pendingUserMessages.length === 0) return;

    const allAssistantMessages = [
      ...streamingMessages.filter(m => m.role === 'assistant'),
      ...syncedMessages.filter(m => m.role === 'assistant')
    ];

    if (allAssistantMessages.length > 0) {
      const latestResponse = allAssistantMessages[allAssistantMessages.length - 1];
      const latestResponseTime = new Date(latestResponse.timestamp).getTime();

      setPendingUserMessages(prev =>
        prev.filter(pending => {
          const pendingTime = new Date(pending.timestamp).getTime();
          return pendingTime > latestResponseTime;
        })
      );
    }
  }, [streamingMessages, syncedMessages, pendingUserMessages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingContent]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !isConnected) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      metadata: { pending: true }
    };

    setPendingUserMessages(prev => [...prev, userMessage]);
    const messageContent = input.trim();
    setInput('');

    try {
      await sendStreamingMessage(messageContent);
      setPendingUserMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, metadata: { ...msg.metadata, pending: false } }
            : msg
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  }, [input, isStreaming, isConnected, sendStreamingMessage]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Copy session ID
  const copySessionId = useCallback(() => {
    navigator.clipboard.writeText(localSessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [localSessionId]);

  // Reset session
  const handleResetSession = useCallback(() => {
    clearMessages();
    setSyncedMessages([]);
    setPendingUserMessages([]);
    sessionStorage.removeItem(`pending_messages_${localSessionId}`);
  }, [clearMessages, localSessionId]);

  // Handle synced messages from approval flow
  const handleSyncedMessages = useCallback((syncedData: SyncedMessage[]) => {
    setSyncedMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newChatMessages: ChatMessage[] = [];

      for (const synced of syncedData) {
        const userMsgId = `synced-user-${synced.request_id}`;
        if (!existingIds.has(userMsgId) && synced.original_message) {
          newChatMessages.push({
            id: userMsgId,
            role: 'user',
            content: synced.original_message,
            timestamp: synced.timestamp,
            metadata: { approvalId: synced.approval_id }
          });
        }

        const assistantMsgId = `synced-assistant-${synced.request_id}`;
        if (!existingIds.has(assistantMsgId)) {
          newChatMessages.push({
            id: assistantMsgId,
            role: 'assistant',
            content: synced.response,
            timestamp: synced.timestamp,
            metadata: {
              capabilities: synced.capabilities_used,
              resumedFromApproval: true
            }
          });
        }
      }

      if (newChatMessages.length === 0) return prev;

      return [...prev, ...newChatMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, []);

  // Enable conversation sync
  const { isSyncing, refresh: refreshSync } = useConversationSync({
    sessionId: localSessionId,
    onNewMessages: handleSyncedMessages,
    pollInterval: 5000
  });

  return (
    <div className={`flex flex-col bg-gray-50 ${embedded ? 'h-full' : 'h-screen'}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className={`flex items-center justify-between ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-sm">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">AI Chat</h1>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <span className="flex items-center text-xs text-green-600 font-medium">
                    <Wifi className="w-3 h-3 mr-1" />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center text-xs text-red-500 font-medium">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </span>
                )}
                {isSyncing && (
                  <span className="flex items-center text-xs text-blue-600 font-medium">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Syncing
                  </span>
                )}
                {pendingUserMessages.length > 0 && (
                  <span className="flex items-center text-xs text-amber-600 font-medium">
                    <Clock className="w-3 h-3 mr-1" />
                    Awaiting response
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* ============================================================ */}
            {/* MODEL SELECTOR - COMPACT VERSION IN HEADER */}
            {/* Only show non-embedding models for chat */}
            {/* ============================================================ */}
            <ModelSelector
              target="chat"
              compact={true}
              excludeFilter="embed"
            />

            {/* Refresh Sync Button */}
            <button
              onClick={refreshSync}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Refresh synced messages"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Reconnect button */}
            {!isConnected && (
              <button
                onClick={connect}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-3">
          <div className={`flex items-center justify-between ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${embedded ? 'p-4' : 'max-w-3xl mx-auto p-6'} space-y-4`}>
          {/* Welcome Message with Model Selector - shows full-page errors when needed */}
          {messages.length === 0 && !currentStreamingContent && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                AI Orchestration Ready
              </h2>
              <p className="text-gray-500 max-w-md mx-auto text-sm mb-6">
                I can help with data analysis, API integrations, workflow automation, and more.
                Start by typing your message below.
              </p>

              {/* ============================================================ */}
              {/* MODEL SELECTOR - with fullPageErrors to show setup guide */}
              {/* ============================================================ */}
              <div className="max-w-md mx-auto">
                <ModelSelector
                  target="chat"
                  compact={false}
                  fullPageErrors={true}
                  excludeFilter="embed"
                />
              </div>

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

          {/* Messages - ALWAYS show */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                  message.role === 'user'
                    ? message.metadata?.pending
                      ? 'bg-blue-400 text-white shadow-md'
                      : 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                }`}
              >
                {/* Pending indicator for user messages */}
                {message.metadata?.pending && (
                  <div className="flex items-center space-x-1 mb-2 text-blue-100">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-medium">Sending...</span>
                  </div>
                )}

                {/* Resumed from approval indicator */}
                {message.metadata?.resumedFromApproval && (
                  <div className="flex items-center space-x-1 mb-2 text-amber-600">
                    <RefreshCw className="w-3 h-3" />
                    <span className="text-xs font-medium">Completed via approval</span>
                  </div>
                )}

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

                {/* Capabilities badge for resumed messages */}
                {message.metadata?.capabilities && message.metadata.capabilities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.metadata.capabilities.map((cap: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

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
              {/* ============================================================ */}
              {/* MODEL SELECTOR IN SETTINGS MODAL */}
              {/* Only show non-embedding models for chat */}
              {/* ============================================================ */}
              <ModelSelector
                target="chat"
                label="Chat Model"
                compact={false}
                excludeFilter="embed"
              />

              <div className="border-t border-gray-100 pt-4">
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

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Synced Messages</label>
                <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200">
                  {syncedMessages.length} messages from approvals
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Pending Messages</label>
                <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200">
                  {pendingUserMessages.length} awaiting response
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