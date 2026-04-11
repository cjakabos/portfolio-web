from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException, Request, WebSocket

from core.orchestrator import AIOrchestrationLayer
from memory.context_store import ContextStore
from memory.memory_manager import MemoryManager


@dataclass
class AIControlPlaneState:
    orchestrator: Optional[AIOrchestrationLayer] = None
    memory_manager: Optional[MemoryManager] = None
    context_store: Optional[ContextStore] = None
    tool_manager: Any = None
    audit_service: Any = None


def get_ai_control_plane_state(request: Request) -> AIControlPlaneState:
    state = getattr(request.app.state, "ai_control_plane", None)
    if state is None:
        raise HTTPException(status_code=503, detail="AI control plane state not initialized")
    return state


def get_ai_control_plane_state_from_websocket(websocket: WebSocket) -> AIControlPlaneState:
    state = getattr(websocket.app.state, "ai_control_plane", None)
    if state is None:
        raise HTTPException(status_code=503, detail="AI control plane state not initialized")
    return state
