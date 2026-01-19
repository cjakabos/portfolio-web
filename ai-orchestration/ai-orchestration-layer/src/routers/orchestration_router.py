import uuid
import time
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from starlette.websockets import WebSocketState
import json
import uuid
from pydantic import BaseModel

# Import core types needed for logic
# (Assuming these exist in your project structure based on the old file)
from core.orchestrator import AIOrchestrationLayer, UnifiedState, OrchestrationType
from memory.memory_manager import MemoryManager
from memory.context_store import ContextStore

# Configure Router
router = APIRouter(tags=["Orchestration"])
logger = logging.getLogger(__name__)

# =============================================================================
# Global Dependencies (Injected from main.py)
# =============================================================================
_orchestrator: Optional[AIOrchestrationLayer] = None
_memory_manager: Optional[MemoryManager] = None
_context_store: Optional[ContextStore] = None

def set_orchestration_deps(
    orchestrator: AIOrchestrationLayer,
    memory_manager: MemoryManager,
    context_store: ContextStore
):
    """Dependency Injection helper called from main.py lifespan."""
    global _orchestrator, _memory_manager, _context_store
    _orchestrator = orchestrator
    _memory_manager = memory_manager
    _context_store = context_store

def get_context_store_dependency() -> ContextStore:
    if not _context_store:
        raise HTTPException(status_code=503, detail="Context Store not initialized")
    return _context_store

# =============================================================================
# Data Models
# =============================================================================
class OrchestrationRequest(BaseModel):
    message: str
    user_id: str
    session_id: str
    context: Optional[Dict[str, Any]] = None
    orchestration_type: Optional[str] = "conversational"

# =============================================================================
# Endpoints
# =============================================================================

@router.post("/orchestrate")
async def orchestrate(request: OrchestrationRequest):
    """
    Main orchestration endpoint.
    Routes the request through the LangGraph workflow.
    """
    if not _orchestrator or not _context_store or not _memory_manager:
        raise HTTPException(status_code=503, detail="Orchestration layer not initialized")

    request_id = str(uuid.uuid4())
    start_time = time.time()

    logger.info("request_received", extra={
        "request_id": request_id,
        "user_id": request.user_id,
        "type": request.orchestration_type
    })

    try:
        # 1. Load User Context
        user_profile = _context_store.load_user_profile(request.user_id)

        # 2. Load Conversation History
        history = _memory_manager.get_history(request.session_id)

        # 3. Merge Contexts
        merged_context = {**user_profile, **(request.context or {})}

        # 4. Create State
        initial_state = UnifiedState(
            request_id=request_id,
            user_id=request.user_id,
            session_id=request.session_id,
            orchestration_type=OrchestrationType(request.orchestration_type),
            conversation_history=history,
            user_context=merged_context,
            current_node="initialize",
            execution_path=[],
            input_data=request.message,
            intermediate_results={},
            final_output=None,
            next_action="",
            requires_human=False,
            logs=[],
            metrics={}
        )

        # 5. Execute Workflow
        result_state = await _orchestrator.invoke(initial_state)

        # 6. Calculate Duration
        duration = (time.time() - start_time) * 1000

        # 7. Save Interaction
        if result_state.get("final_output"):
            _memory_manager.save_interaction(
                session_id=request.session_id,
                user_message=request.message,
                assistant_response=result_state["final_output"],
                metadata={"request_id": request_id, "duration": duration}
            )

        return {
            "request_id": request_id,
            "response": result_state.get("final_output"),
            "execution_path": result_state.get("execution_path"),
            "metrics": result_state.get("metrics"),
            "requires_human": result_state.get("requires_human")
        }

    except Exception as e:
        logger.error(f"Orchestration failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/preferences/{user_id}/{key}")
async def delete_user_preference(
    user_id: str,
    key: str,
    ctx_store: ContextStore = Depends(get_context_store_dependency)
):
    """Delete a specific user preference."""
    profile = ctx_store.load_user_profile(user_id)
    if "preferences" in profile and key in profile["preferences"]:
        del profile["preferences"][key]
        ctx_store.contexts[user_id] = profile  # Ensure persistence logic is handled in ContextStore

        logger.info(f"User preference deleted: {key} for user {user_id}")

        return {
            "user_id": user_id,
            "key": key,
            "status": "deleted"
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Preference '{key}' not found for user {user_id}"
        )

@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time streaming orchestration.
    Supports bidirectional communication for chat-style interactions.

    FIXED: Properly handles client disconnects without error logging
    """
    client_id = str(uuid.uuid4())[:8]
    logger.info(f"WebSocket connection attempt from client {client_id}")

    try:
        await websocket.accept()
        logger.info(f"WebSocket {client_id} accepted")
    except Exception as e:
        logger.warning(f"WebSocket {client_id} failed to accept: {e}")
        return

    if not _orchestrator:
        logger.warning(f"WebSocket {client_id}: Orchestrator not initialized, closing")
        await websocket.close(code=1011, reason="Orchestrator not ready")
        return

    logger.info(f"WebSocket {client_id} ready, entering message loop")

    try:
        while True:
            # Check if connection is still open
            if websocket.client_state != WebSocketState.CONNECTED:
                logger.debug(f"WebSocket {client_id}: Client no longer connected")
                break

            # Receive message from client
            try:
                raw_data = await websocket.receive_text()
            except WebSocketDisconnect as e:
                # Normal disconnect - not an error
                logger.info(f"WebSocket {client_id} disconnected normally (code: {e.code})")
                break

            # Parse JSON
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "error": "Invalid JSON format"
                })
                continue

            # Extract request parameters
            message = data.get("message", "")
            user_id = data.get("user_id", "anonymous")
            session_id = data.get("session_id", str(uuid.uuid4()))
            context = data.get("context", {})

            if not message:
                await websocket.send_json({
                    "type": "error",
                    "error": "No message provided"
                })
                continue

            # Send acknowledgment
            await websocket.send_json({
                "type": "ack",
                "message": "Processing request..."
            })

            try:
                # Process with orchestrator
                request_id = str(uuid.uuid4())

                # Load context if available
                user_profile = {}
                history = []

                if _context_store:
                    user_profile = _context_store.load_user_profile(str(user_id))
                if _memory_manager:
                    history = _memory_manager.get_history(session_id)

                # Create initial state
                initial_state = UnifiedState(
                    request_id=request_id,
                    user_id=str(user_id),
                    session_id=session_id,
                    orchestration_type=OrchestrationType.CONVERSATIONAL,
                    conversation_history=history,
                    user_context={**user_profile, **context},
                    current_node="initialize",
                    execution_path=[],
                    input_data=message,
                    intermediate_results={},
                    final_output=None,
                    next_action="",
                    requires_human=False,
                    logs=[],
                    metrics={}
                )

                # Check if orchestrator supports streaming
                if hasattr(_orchestrator, 'astream'):
                    # Stream response chunks
                    async for chunk in _orchestrator.astream(initial_state):
                        if websocket.client_state != WebSocketState.CONNECTED:
                            break

                        if "final_output" in chunk and chunk["final_output"]:
                            await websocket.send_json({
                                "type": "token",
                                "data": {"token": chunk["final_output"]},
                                "request_id": request_id
                            })
                        elif "current_node" in chunk:
                            await websocket.send_json({
                                "type": "node_start",
                                "data": {"node": chunk["current_node"]},
                                "request_id": request_id
                            })
                else:
                    # Non-streaming fallback
                    result_state = await _orchestrator.invoke(initial_state)

                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "complete",
                            "data": {
                                "content": result_state.get("final_output", ""),
                                "metrics": result_state.get("metrics", {})
                            },
                            "request_id": request_id
                        })

                # Send completion if still connected
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({
                        "type": "complete",
                        "data": {
                            "content": initial_state.get("final_output") or "",
                            "metrics": initial_state.get("metrics")
                        },
                        "request_id": request_id
                    })

            except Exception as e:
                logger.error(f"WebSocket {client_id} orchestration error: {e}", exc_info=True)
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({
                        "type": "error",
                        "error": str(e)
                    })

    except WebSocketDisconnect as e:
        # Normal client disconnect
        logger.info(f"WebSocket {client_id} client disconnected (code: {e.code})")
    except Exception as e:
        # Classify the error
        error_str = str(e)

        # These are normal client disconnects, not errors
        if any(code in error_str for code in ['1000', '1001', '1005', '1006']):
            logger.debug(f"WebSocket {client_id} closed by client: {e}")
        elif 'WebSocket is closed' in error_str:
            logger.debug(f"WebSocket {client_id} connection closed: {e}")
        else:
            # Actual error
            logger.error(f"WebSocket {client_id} unexpected error: {e}", exc_info=True)
    finally:
        # Ensure we close the connection
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.close()
        except Exception:
            pass
        logger.debug(f"WebSocket {client_id} handler finished")