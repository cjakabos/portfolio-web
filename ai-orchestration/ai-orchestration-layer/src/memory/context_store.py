# ============================================================================
# File: backend/ai-orchestration-layer/src/memory/context_store.py
# ============================================================================

from typing import Dict, Any, Optional

class ContextStore:
    """
    Stores user context and preferences
    """
    
    def __init__(self):
        self.contexts = {}
    
    def load_user_profile(self, user_id: int) -> Dict[str, Any]:
        """Load user profile and preferences"""
        if user_id not in self.contexts:
            self.contexts[user_id] = {
                "user_id": user_id,
                "preferences": {},
                "metadata": {}
            }
        
        return self.contexts[user_id]
    
    def update_context(self, user_id: int, updates: Dict[str, Any]):
        """Update user context"""
        profile = self.load_user_profile(user_id)
        profile.update(updates)
        self.contexts[user_id] = profile
    
    def get_preference(self, user_id: int, key: str) -> Optional[Any]:
        """Get a specific user preference"""
        profile = self.load_user_profile(user_id)
        return profile.get("preferences", {}).get(key)
    
    def set_preference(self, user_id: int, key: str, value: Any):
        """Set a user preference"""
        profile = self.load_user_profile(user_id)
        if "preferences" not in profile:
            profile["preferences"] = {}
        profile["preferences"][key] = value
        self.contexts[user_id] = profile