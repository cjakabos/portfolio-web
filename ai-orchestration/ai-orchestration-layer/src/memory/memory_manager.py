# ============================================================================
# File: backend/ai-orchestration-layer/src/memory/memory_manager.py
# ============================================================================

from typing import Dict, List, Any
from datetime import datetime
import json

class MemoryManager:
    """
    Manages conversation memory and context
    """
    
    def __init__(self):
        self.sessions = {}
        self.max_history = 50
    
    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for session"""
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        
        return self.sessions[session_id]
    
    def save_interaction(self, session_id: str, user_message: str, 
                        assistant_response: Any, metadata: Dict[str, Any] = None):
        """Save an interaction to memory"""
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        
        interaction = {
            "timestamp": datetime.now().isoformat(),
            "user": user_message,
            "assistant": str(assistant_response),
            "metadata": metadata or {}
        }
        
        self.sessions[session_id].append(interaction)
        
        # Trim history if too long
        if len(self.sessions[session_id]) > self.max_history:
            self.sessions[session_id] = self.sessions[session_id][-self.max_history:]
    
    def clear_session(self, session_id: str):
        """Clear session memory"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def get_summary(self, session_id: str) -> str:
        """Get conversation summary"""
        history = self.get_history(session_id)
        if not history:
            return "No conversation history"
        
        return f"Session has {len(history)} interactions"