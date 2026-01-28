// frontend/utils/sessionUtils.ts
// =============================================================================
// Session ID Utilities - Ensures consistent session ID across all chat interfaces
// =============================================================================
// This module provides functions to manage a persistent session ID that is shared
// across both the standalone Chat view and the embedded Live chat in Operations.
// This ensures that messages synced from approval resumes are visible regardless
// of which chat interface the user returns to.
// =============================================================================

const SESSION_ID_KEY = 'ai_orchestration_session_id';

/**
 * Gets or creates a persistent session ID for the current user.
 * The session ID is stored in localStorage and persists across page reloads.
 * 
 * @returns The persistent session ID
 */
export function getPersistentSessionId(): string {
  // Try to get existing session ID from localStorage
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (!sessionId) {
    // Generate a new session ID if none exists
    sessionId = `session_${Date.now()}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
    console.log('[SessionUtils] Created new persistent session ID:', sessionId);
  } else {
    console.log('[SessionUtils] Using existing persistent session ID:', sessionId);
  }
  
  return sessionId;
}

/**
 * Resets the persistent session ID, creating a new one.
 * Useful when the user explicitly wants to start a new conversation.
 * 
 * @returns The new session ID
 */
export function resetPersistentSessionId(): string {
  const newSessionId = `session_${Date.now()}`;
  localStorage.setItem(SESSION_ID_KEY, newSessionId);
  console.log('[SessionUtils] Reset session ID to:', newSessionId);
  return newSessionId;
}

/**
 * Clears the persistent session ID entirely.
 * The next call to getPersistentSessionId() will create a new one.
 */
export function clearPersistentSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY);
  console.log('[SessionUtils] Cleared persistent session ID');
}

export default {
  getPersistentSessionId,
  resetPersistentSessionId,
  clearPersistentSessionId,
};
