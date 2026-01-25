// frontend/hooks/useConversationSync.ts

/**
 * Hook for syncing conversation responses from approval resumes.
 * 
 * This hook handles:
 * - Initial load of all responses on mount (for page refresh)
 * - Polling for new responses
 * - Marking responses as delivered
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SyncedMessage {
  request_id: string;
  user_message: string;
  response: string;
  capabilities_used: string[];
  timestamp: string;
  delivered: boolean;
}

interface UseConversationSyncOptions {
  sessionId: string;
  onNewMessages: (messages: SyncedMessage[]) => void;
  pollInterval?: number;  // ms, default 5000
  enabled?: boolean;      // default true
  baseUrl?: string;       // API base URL
}

interface UseConversationSyncReturn {
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastSyncTime: Date | null;
}

// =============================================================================
// API Client Functions
// =============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8700';

async function fetchSessionResponses(
  sessionId: string,
  options: {
    sinceTimestamp?: number;
    includeDelivered?: boolean;
  } = {}
): Promise<SyncedMessage[]> {
  const params = new URLSearchParams();
  
  if (options.sinceTimestamp !== undefined) {
    params.append('since_timestamp', String(options.sinceTimestamp));
  }
  if (options.includeDelivered !== undefined) {
    params.append('include_delivered', String(options.includeDelivered));
  }
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(
    `${API_BASE}/conversation-sync/session/${sessionId}/responses${query}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch responses: ${response.statusText}`);
  }
  
  return response.json();
}

async function markResponsesDelivered(
  sessionId: string,
  requestIds: string[]
): Promise<{ marked: number }> {
  const response = await fetch(
    `${API_BASE}/conversation-sync/session/${sessionId}/responses/mark-delivered`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_ids: requestIds })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to mark delivered: ${response.statusText}`);
  }
  
  return response.json();
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useConversationSync({
  sessionId,
  onNewMessages,
  pollInterval = 5000,
  enabled = true,
}: UseConversationSyncOptions): UseConversationSyncReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Track state across renders
  const lastFetchTime = useRef<number>(0);
  const deliveredIds = useRef<Set<string>>(new Set());
  const isMounted = useRef(true);

  // -------------------------------------------------------------------------
  // Fetch ALL messages (for initial load / page refresh)
  // -------------------------------------------------------------------------
  const fetchAllMessages = useCallback(async () => {
    if (!enabled || !sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const messages = await fetchSessionResponses(sessionId, {
        includeDelivered: true  // Get everything on refresh
      });
      
      if (!isMounted.current) return;
      
      if (messages.length > 0) {
        // Call handler with all messages
        onNewMessages(messages);
        
        // Track which ones we've seen
        messages.forEach(m => deliveredIds.current.add(m.request_id));
        
        // Update last fetch time to the latest message
        const latestTimestamp = Math.max(
          ...messages.map(m => new Date(m.timestamp).getTime() / 1000)
        );
        lastFetchTime.current = latestTimestamp;
        setLastSyncTime(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to sync messages');
        console.error('Failed to fetch all messages:', err);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [sessionId, onNewMessages, enabled]);

  // -------------------------------------------------------------------------
  // Poll for NEW messages only
  // -------------------------------------------------------------------------
  const pollNewMessages = useCallback(async () => {
    if (!enabled || !sessionId) return;
    
    // Initialize timestamp if needed (last hour)
    if (!lastFetchTime.current) {
      lastFetchTime.current = Date.now() / 1000 - 3600;
    }
    
    setIsSyncing(true);
    
    try {
      const messages = await fetchSessionResponses(sessionId, {
        sinceTimestamp: lastFetchTime.current
      });
      
      if (!isMounted.current) return;
      
      // Filter out already delivered
      const newMessages = messages.filter(
        m => !deliveredIds.current.has(m.request_id)
      );
      
      if (newMessages.length > 0) {
        // Call handler with new messages
        onNewMessages(newMessages);
        
        // Mark as delivered on backend
        const newIds = newMessages.map(m => m.request_id);
        newIds.forEach(id => deliveredIds.current.add(id));
        
        try {
          await markResponsesDelivered(sessionId, newIds);
        } catch (markError) {
          console.warn('Failed to mark messages as delivered:', markError);
          // Non-fatal, continue anyway
        }
        
        // Update timestamp
        const latestTimestamp = Math.max(
          ...newMessages.map(m => new Date(m.timestamp).getTime() / 1000)
        );
        lastFetchTime.current = latestTimestamp;
        setLastSyncTime(new Date());
      }
    } catch (err) {
      // Don't set error state for polling failures - they're expected occasionally
      console.debug('Polling error (will retry):', err);
    } finally {
      if (isMounted.current) {
        setIsSyncing(false);
      }
    }
  }, [sessionId, onNewMessages, enabled]);

  // -------------------------------------------------------------------------
  // Initial load on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    isMounted.current = true;
    
    if (enabled && sessionId) {
      fetchAllMessages();
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [fetchAllMessages, enabled, sessionId]);

  // -------------------------------------------------------------------------
  // Polling interval
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !sessionId) return;
    
    const interval = setInterval(pollNewMessages, pollInterval);
    
    return () => clearInterval(interval);
  }, [pollNewMessages, pollInterval, enabled, sessionId]);

  // -------------------------------------------------------------------------
  // Reset when session changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    deliveredIds.current.clear();
    lastFetchTime.current = 0;
    setLastSyncTime(null);
    setError(null);
  }, [sessionId]);

  return {
    isLoading,
    isSyncing,
    error,
    refresh: fetchAllMessages,
    lastSyncTime
  };
}

export default useConversationSync;