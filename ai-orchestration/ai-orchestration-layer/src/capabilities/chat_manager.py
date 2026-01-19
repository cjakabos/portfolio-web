# backend/ai-orchestration-layer/src/capabilities/chat_manager.py

"""
Chat Manager - FIXED
Now fully async with standardized error handling
"""

from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from capabilities.base_capability import BaseCapability, CapabilityError
from core.state import UnifiedState


class ChatManager(BaseCapability):
    """
    Advanced Conversational AI Manager
    Handles general chat and contextual conversations
    """
    
    def __init__(self):
        super().__init__(capability_name="chat_manager")
        
        self.system_prompt = """You are a helpful AI assistant for a multi-service platform.
You can help users with:
- Shopping and orders (cloudapp store)
- Pet care scheduling (petstore)
- Vehicle tracking
- Customer insights and analytics
- General questions and conversation

Be friendly, concise, and helpful. If you need to perform specific actions,
let the user know what services are available."""
    
    async def _execute_internal(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Internal execution logic - generates conversational response
        
        Args:
            state: Current unified state
        
        Returns:
            Chat response
        """
        query = state["input_data"]
        conversation_history = state.get("conversation_history", [])
        
        try:
            # Build messages with history
            messages = [SystemMessage(content=self.system_prompt)]
            
            # Add conversation history (last 10 messages)
            for msg in conversation_history[-10:]:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
            
            # Add current query
            messages.append(HumanMessage(content=query))
            
            # Get response from LLM (async)
            response = await self.llm.ainvoke(messages)
            
            # Extract content
            if hasattr(response, 'content'):
                response_text = response.content
            else:
                response_text = str(response)
            
            return {
                "response": response_text,
                "result": response_text,
                "message_count": len(messages),
                "status": "success"
            }
            
        except Exception as e:
            raise CapabilityError(
                message=f"Chat generation failed: {str(e)}",
                capability_name=self.capability_name,
                error_code="CHAT_GENERATION_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def _execute_fallback(self, state: UnifiedState) -> Dict[str, Any]:
        """Fallback when chat generation fails"""
        fallback_responses = [
            "I'm having trouble processing that right now. Could you try rephrasing?",
            "I can help you with shopping, pet care, or vehicle tracking. What would you like to do?",
            "Let me help you. What specific service are you interested in?"
        ]
        
        # Choose response based on query content
        query_lower = state["input_data"].lower()
        
        if any(word in query_lower for word in ["help", "what", "can you"]):
            response = fallback_responses[1]
        else:
            response = fallback_responses[0]
        
        return {
            "response": response,
            "result": response,
            "status": "fallback"
        }
