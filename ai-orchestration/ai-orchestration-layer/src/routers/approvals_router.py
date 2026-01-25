# backend/ai-orchestration-layer/src/routers/approvals_router.py

"""
HITL Approvals Router - API endpoints for human-in-the-loop approval workflows.

FIXED: Added resume endpoint that properly uses execution_context to continue
workflow after approval, even if WebSocket was closed.
"""

import logging
import os
import uuid
import asyncio
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/approvals", tags=["HITL Approvals"])


# =============================================================================
# Enums
# =============================================================================

class ApprovalType(str, Enum):
    FINANCIAL = "financial"
    ML_DECISION = "ml_decision"
    DATA_ACCESS = "data_access"
    WORKFLOW_BRANCH = "workflow_branch"
    AGENT_ACTION = "agent_action"
    EXTERNAL_API = "external_api"
    CONTENT_GENERATION = "content_generation"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    TIMEOUT = "timeout"
    AUTO_APPROVED = "auto_approved"
    FLAGGED = "flagged"


# =============================================================================
# Pydantic Models
# =============================================================================

class ExecutionContextModel(BaseModel):
    """Execution context preserved during HITL pause"""
    next_capability: Optional[str] = None
    selected_agent: Optional[str] = None
    planned_tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    planned_workflow_steps: List[str] = Field(default_factory=list)
    ml_model_id: Optional[str] = None
    ml_prediction_params: Optional[Dict[str, Any]] = None
    agent_task: Optional[str] = None
    agent_tools_selected: List[str] = Field(default_factory=list)
    rag_query: Optional[str] = None
    rag_retrieved_docs: List[Dict[str, Any]] = Field(default_factory=list)
    workflow_id: Optional[str] = None
    workflow_step_index: int = 0
    workflow_branch: Optional[str] = None
    risk_score: float = 0.0
    risk_factors: List[str] = Field(default_factory=list)
    checkpoint_id: Optional[str] = None
    checkpoint_thread_id: Optional[str] = None


class ApprovalContext(BaseModel):
    state_summary: Dict[str, Any] = Field(default_factory=dict)
    risk_score: float = 0.0
    current_results: Optional[Dict[str, Any]] = None
    additional_info: Optional[Dict[str, Any]] = None


class ApprovalRequestCreate(BaseModel):
    orchestration_id: str
    approval_type: ApprovalType
    proposed_action: str
    risk_level: RiskLevel
    requester_id: int
    context: ApprovalContext
    execution_context: Optional[ExecutionContextModel] = None
    risk_score: float = 0.5
    risk_factors: List[str] = Field(default_factory=list)
    expires_in_seconds: int = Field(default=300, ge=60, le=3600)


class ApprovalRequest(BaseModel):
    request_id: str
    orchestration_id: str
    approval_type: ApprovalType
    status: ApprovalStatus
    created_at: str
    expires_at: str
    requester_id: int
    proposed_action: str
    risk_level: RiskLevel
    risk_score: float = 0.5
    risk_factors: List[str] = Field(default_factory=list)
    context: ApprovalContext
    execution_context: Optional[ExecutionContextModel] = None


class ApprovalDecision(BaseModel):
    approved: bool
    approver_id: int
    approval_notes: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None


class ApprovalHistoryItem(ApprovalRequest):
    approved_at: Optional[str] = None
    approver_id: Optional[int] = None
    approval_notes: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None


class ApprovalStats(BaseModel):
    total_pending: int
    total_approved: int
    total_rejected: int
    total_expired: int
    total_auto_approved: int = 0
    total_flagged: int = 0
    avg_response_time_seconds: float
    by_type: Dict[str, int]
    by_risk_level: Dict[str, int]


class ResumeRequest(BaseModel):
    """Request to resume workflow after approval"""
    user_id: int
    session_id: str
    additional_context: Optional[Dict[str, Any]] = None


class ResumeResponse(BaseModel):
    """Response after resuming workflow"""
    request_id: str
    approval_id: str
    status: str
    response: Optional[str] = None
    execution_path: List[str] = Field(default_factory=list)
    capabilities_used: List[str] = Field(default_factory=list)
    error: Optional[str] = None


# =============================================================================
# Storage Backend
# =============================================================================

class ApprovalStorage:
    """In-memory approval storage with optional Redis backend."""

    def __init__(self):
        self._pending: Dict[str, dict] = {}
        self._history: List[dict] = []
        self._redis_client = None
        self._use_redis = False
        self._initialized = False

    async def initialize(self):
        """Try to connect to Redis, fallback to in-memory."""
        if self._initialized:
            return

        try:
            import redis.asyncio as redis
            redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
            self._redis_client = redis.from_url(redis_url, db=2)
            await self._redis_client.ping()
            self._use_redis = True
            logger.info("Approvals storage using Redis")
        except Exception as e:
            logger.warning(f"Redis unavailable for approvals, using in-memory: {e}")
            self._use_redis = False

        self._initialized = True

    async def add_pending(self, request_id: str, data: dict):
        """Add a pending approval request."""
        if self._use_redis and self._redis_client:
            await self._redis_client.hset("approvals:pending", request_id, json.dumps(data))
            # Also store full data with TTL for resume functionality
            ttl = 86400  # 24 hours
            await self._redis_client.set(f"approval:{request_id}", json.dumps(data), ex=ttl)
        else:
            self._pending[request_id] = data

    async def get_pending(self, request_id: str) -> Optional[dict]:
        """Get a pending approval by ID."""
        if self._use_redis and self._redis_client:
            data = await self._redis_client.hget("approvals:pending", request_id)
            if not data:
                # Try full key
                data = await self._redis_client.get(f"approval:{request_id}")
            return json.loads(data) if data else None
        return self._pending.get(request_id)

    async def get_all_pending(self) -> List[dict]:
        """Get all pending approvals."""
        if self._use_redis and self._redis_client:
            all_data = await self._redis_client.hgetall("approvals:pending")
            return [json.loads(v) for v in all_data.values()]
        return list(self._pending.values())

    async def remove_pending(self, request_id: str) -> Optional[dict]:
        """Remove a pending approval."""
        if self._use_redis and self._redis_client:
            data = await self._redis_client.hget("approvals:pending", request_id)
            if data:
                await self._redis_client.hdel("approvals:pending", request_id)
                return json.loads(data)
            return None
        return self._pending.pop(request_id, None)

    async def add_to_history(self, data: dict):
        """Add an approval to history."""
        if self._use_redis and self._redis_client:
            await self._redis_client.lpush("approvals:history", json.dumps(data))
            await self._redis_client.ltrim("approvals:history", 0, 999)
            # Also update the full key for resume
            await self._redis_client.set(f"approval:{data['request_id']}", json.dumps(data), ex=86400)
        else:
            self._history.insert(0, data)
            self._history = self._history[:1000]

    async def get_history(self, limit: int = 100, offset: int = 0) -> List[dict]:
        """Get approval history."""
        if self._use_redis and self._redis_client:
            data = await self._redis_client.lrange("approvals:history", offset, offset + limit - 1)
            return [json.loads(item) for item in data]
        return self._history[offset:offset + limit]

    async def get_approval(self, request_id: str) -> Optional[dict]:
        """Get any approval by ID (pending or history)."""
        # Check pending first
        result = await self.get_pending(request_id)
        if result:
            return result

        # Check full key (works for both pending and processed)
        if self._use_redis and self._redis_client:
            data = await self._redis_client.get(f"approval:{request_id}")
            if data:
                return json.loads(data)

        # Check in-memory history
        for item in self._history:
            if item.get("request_id") == request_id:
                return item

        return None

    async def get_stats(self) -> dict:
        """Get approval statistics."""
        history = await self.get_history(limit=1000)
        pending = await self.get_all_pending()

        total_approved = sum(1 for h in history if h.get("status") == "approved")
        total_rejected = sum(1 for h in history if h.get("status") == "rejected")
        total_expired = sum(1 for h in history if h.get("status") in ["expired", "timeout"])
        total_auto_approved = sum(1 for h in history if h.get("status") == "auto_approved")
        total_flagged = sum(1 for h in history if h.get("status") == "flagged")

        # Calculate average response time
        response_times = []
        for h in history:
            if h.get("created_at") and h.get("approved_at"):
                try:
                    created = datetime.fromisoformat(h["created_at"].replace("Z", "+00:00"))
                    approved = datetime.fromisoformat(h["approved_at"].replace("Z", "+00:00"))
                    response_times.append((approved - created).total_seconds())
                except:
                    pass

        by_type = {}
        by_risk = {}
        for item in history + pending:
            atype = item.get("approval_type", "unknown")
            risk = item.get("risk_level", "unknown")
            by_type[atype] = by_type.get(atype, 0) + 1
            by_risk[risk] = by_risk.get(risk, 0) + 1

        return {
            "total_pending": len(pending),
            "total_approved": total_approved,
            "total_rejected": total_rejected,
            "total_expired": total_expired,
            "total_auto_approved": total_auto_approved,
            "total_flagged": total_flagged,
            "avg_response_time_seconds": sum(response_times) / len(response_times) if response_times else 0,
            "by_type": by_type,
            "by_risk_level": by_risk
        }


# Global storage instance
storage = ApprovalStorage()

# Background task reference
_expiration_task = None


# =============================================================================
# WebSocket Notifier (moved up for set_orchestration_deps)
# =============================================================================

class ApprovalNotifier:
    """Manages WebSocket connections for real-time approval notifications."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Approval WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Approval WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


notifier = ApprovalNotifier()


# Orchestrator reference (set from main.py)
_orchestrator = None
_memory_manager = None
_context_store = None


def set_orchestration_deps(orchestrator, memory_manager=None, context_store=None):
    """Set orchestration dependencies for resume functionality."""
    global _orchestrator, _memory_manager, _context_store
    _orchestrator = orchestrator
    _memory_manager = memory_manager
    _context_store = context_store
    logger.info("Approvals router orchestration dependencies set")

    # CRITICAL: Connect HITL manager to router storage for frontend visibility
    if orchestrator and hasattr(orchestrator, 'hitl_manager') and orchestrator.hitl_manager:
        orchestrator.hitl_manager.set_router_deps(storage, notifier)
        logger.info("HITL manager connected to router storage and notifier")


# =============================================================================
# Background Tasks
# =============================================================================

async def check_expired_approvals():
    """Background task to expire old approvals."""
    while True:
        try:
            pending = await storage.get_all_pending()
            now = datetime.utcnow()

            for approval in pending:
                try:
                    expires_at_str = approval.get("expires_at", "")
                    if not expires_at_str:
                        continue
                    expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                    if now > expires_at.replace(tzinfo=None):
                        # Move to history as expired
                        expired = await storage.remove_pending(approval["request_id"])
                        if expired:
                            expired["status"] = "expired"
                            expired["approved_at"] = now.isoformat() + "Z"
                            await storage.add_to_history(expired)
                            logger.info(f"Approval {approval['request_id']} expired")

                            # Broadcast expiration
                            await notifier.broadcast({
                                "type": "approval_expired",
                                "data": expired
                            })
                except Exception as e:
                    logger.error(f"Error processing approval expiration: {e}")
        except Exception as e:
            logger.error(f"Error in expiration check: {e}")

        await asyncio.sleep(30)


# =============================================================================
# Initialization
# =============================================================================

async def initialize_approvals():
    """Initialize approval storage and start background tasks."""
    global _expiration_task
    await storage.initialize()
    _expiration_task = asyncio.create_task(check_expired_approvals())
    logger.info("Approvals system initialized")


async def shutdown_approvals():
    """Cleanup on shutdown."""
    global _expiration_task
    if _expiration_task:
        _expiration_task.cancel()
        try:
            await _expiration_task
        except asyncio.CancelledError:
            pass


async def _ensure_initialized():
    """Ensure storage is initialized."""
    if not storage._initialized:
        await storage.initialize()


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/request", response_model=ApprovalRequest)
async def create_approval_request(request: ApprovalRequestCreate):
    """Create a new approval request."""
    await _ensure_initialized()

    request_id = f"apr_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=request.expires_in_seconds)

    approval_data = {
        "request_id": request_id,
        "orchestration_id": request.orchestration_id,
        "approval_type": request.approval_type.value,
        "status": ApprovalStatus.PENDING.value,
        "created_at": now.isoformat() + "Z",
        "expires_at": expires_at.isoformat() + "Z",
        "requester_id": request.requester_id,
        "proposed_action": request.proposed_action,
        "risk_level": request.risk_level.value,
        "risk_score": request.risk_score,
        "risk_factors": request.risk_factors,
        "context": request.context.model_dump(),
        "execution_context": request.execution_context.model_dump() if request.execution_context else None
    }

    await storage.add_pending(request_id, approval_data)
    logger.info(f"Created approval request {request_id} (risk: {request.risk_score:.2f})")

    # Broadcast new request
    await notifier.broadcast({
        "type": "approval_request",
        "data": approval_data
    })

    return ApprovalRequest(**approval_data)


@router.get("/pending", response_model=List[ApprovalRequest])
async def get_pending_approvals(
    approval_type: Optional[ApprovalType] = None,
    risk_level: Optional[RiskLevel] = None,
    min_risk_score: Optional[float] = None
):
    """Get all pending approval requests."""
    await _ensure_initialized()

    pending = await storage.get_all_pending()

    # Apply filters
    if approval_type:
        pending = [p for p in pending if p["approval_type"] == approval_type.value]
    if risk_level:
        pending = [p for p in pending if p["risk_level"] == risk_level.value]
    if min_risk_score is not None:
        pending = [p for p in pending if p.get("risk_score", 0) >= min_risk_score]

    # Sort by risk score (highest first), then creation time
    pending.sort(key=lambda x: (-x.get("risk_score", 0), x["created_at"]), reverse=False)

    return [ApprovalRequest(**p) for p in pending]


@router.get("/pending/{request_id}", response_model=ApprovalRequest)
async def get_pending_approval(request_id: str):
    """Get a specific pending approval."""
    await _ensure_initialized()

    approval = await storage.get_pending(request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return ApprovalRequest(**approval)


@router.post("/pending/{request_id}/decide", response_model=ApprovalHistoryItem)
async def decide_approval(request_id: str, decision: ApprovalDecision):
    """Approve or reject a pending request."""
    await _ensure_initialized()

    approval = await storage.remove_pending(request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found or already processed")

    now = datetime.utcnow()
    approval["status"] = ApprovalStatus.APPROVED.value if decision.approved else ApprovalStatus.REJECTED.value
    approval["approved_at"] = now.isoformat() + "Z"
    approval["approver_id"] = decision.approver_id
    approval["approval_notes"] = decision.approval_notes
    approval["modifications"] = decision.modifications

    await storage.add_to_history(approval)

    action = "approved" if decision.approved else "rejected"
    logger.info(f"Approval {request_id} {action} by user {decision.approver_id}")

    # Broadcast decision
    await notifier.broadcast({
        "type": "approval_decided",
        "data": approval
    })

    return ApprovalHistoryItem(**approval)


@router.post("/pending/{request_id}/resume", response_model=ResumeResponse)
async def resume_after_approval(request_id: str, resume_request: ResumeRequest):
    """
    Resume workflow execution after approval.

    This is the CRITICAL endpoint that uses the preserved execution_context
    to continue the workflow, even if the WebSocket connection was closed.
    """
    await _ensure_initialized()

    # Get the approval (from history or pending)
    approval = await storage.get_approval(request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Check status
    status = approval.get("status")
    if status == ApprovalStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Approval is still pending")
    if status == ApprovalStatus.REJECTED.value:
        return ResumeResponse(
            request_id=approval.get("orchestration_id", ""),
            approval_id=request_id,
            status="rejected",
            response="Request was rejected by approver",
            error=f"Rejected: {approval.get('approval_notes', 'No reason provided')}"
        )
    if status in [ApprovalStatus.EXPIRED.value, ApprovalStatus.TIMEOUT.value]:
        return ResumeResponse(
            request_id=approval.get("orchestration_id", ""),
            approval_id=request_id,
            status="expired",
            error="Approval request expired"
        )

    # Get execution context
    execution_context = approval.get("execution_context")
    if not execution_context:
        raise HTTPException(
            status_code=400,
            detail="No execution context found - cannot resume workflow"
        )

    # Check if orchestrator is available
    if not _orchestrator:
        raise HTTPException(
            status_code=503,
            detail="Orchestrator not available"
        )

    try:
        # Import state types
        from core.state import UnifiedState, OrchestrationType, create_initial_state

        # Reconstruct state from execution context
        orchestration_id = approval.get("orchestration_id", str(uuid.uuid4()))
        context_data = approval.get("context", {})

        # =================================================================
        # FIX: Get the ORIGINAL session_id from approval context
        # This is the session that was active when the approval was created
        # The graph execution may overwrite session_id, so we preserve it here
        # =================================================================
        original_session_id = (
            context_data.get("state_summary", {}).get("session_id")
            or context_data.get("session_id")
            or execution_context.get("session_id")
            or approval.get("session_id")
            or resume_request.session_id  # fallback to request
        )

        logger.info(f"Resuming with original session_id: {original_session_id}")

        # Determine orchestration type from execution context
        capability_to_type = {
            "chat": OrchestrationType.CONVERSATIONAL,
            "agent": OrchestrationType.AGENT_ROUTING,
            "workflow": OrchestrationType.WORKFLOW_EXECUTION,
            "ml": OrchestrationType.ML_PIPELINE,
            "rag": OrchestrationType.RAG_QUERY
        }

        next_capability = execution_context.get("next_capability", "chat")
        orchestration_type = capability_to_type.get(next_capability, OrchestrationType.CONVERSATIONAL)

        # Get original input from context
        original_input = context_data.get("state_summary", {}).get("input", "")
        if not original_input:
            original_input = context_data.get("query", "Resume approved operation")

        # Load user context
        user_context = {}
        history = []

        if _context_store:
            user_context = _context_store.load_user_profile(str(resume_request.user_id))
        if _memory_manager:
            # Use original session_id for history lookup
            history = _memory_manager.get_history(original_session_id)

        # Merge additional context
        if resume_request.additional_context:
            user_context.update(resume_request.additional_context)

        # Create state with preserved execution context
        # Use ORIGINAL session_id, not the one from resume_request
        state = create_initial_state(
            request_id=orchestration_id,
            user_id=str(resume_request.user_id),
            session_id=original_session_id,  # FIX: Use original session_id
            input_data=original_input,
            orchestration_type=orchestration_type,
            user_context=user_context,
            conversation_history=history
        )

        # FIX: Convert datetime to ISO string for JSON serialization
        if "start_time" in state and hasattr(state["start_time"], 'isoformat'):
            state["start_time"] = state["start_time"].isoformat()

        # Restore execution context
        state["execution_context"] = execution_context
        state["approval_status"] = "approved"
        state["approval_request_id"] = request_id
        state["auto_approved"] = False
        state["resuming_from_approval"] = True

        # Restore intermediate results from execution context
        if execution_context.get("planned_tool_calls"):
            state["intermediate_results"]["planned_tool_calls"] = execution_context["planned_tool_calls"]
        if execution_context.get("selected_agent"):
            state["intermediate_results"]["selected_agent"] = execution_context["selected_agent"]
        if execution_context.get("ml_model_id"):
            state["intermediate_results"]["ml_model_id"] = execution_context["ml_model_id"]
        if execution_context.get("ml_prediction_params"):
            state["intermediate_results"]["ml_params"] = execution_context["ml_prediction_params"]
        if execution_context.get("rag_retrieved_docs"):
            state["intermediate_results"]["retrieved_docs"] = execution_context["rag_retrieved_docs"]
        if execution_context.get("workflow_id"):
            state["intermediate_results"]["workflow_id"] = execution_context["workflow_id"]

        # Apply any human modifications
        modifications = approval.get("modifications")
        if modifications:
            state["intermediate_results"].update(modifications)
            state["human_modifications"] = modifications

        # Skip directly to the capability execution (bypass classification and routing)
        state["execution_path"].append("resume_from_approval")
        state["current_node"] = f"{next_capability}_system"

        logger.info(f"Resuming workflow {orchestration_id} with capability {next_capability}")

        # Execute the resumed workflow
        # Use original session_id for thread_id as well
        config = {"configurable": {"thread_id": original_session_id}}

        if hasattr(_orchestrator, 'graph'):
            # Use the compiled graph
            result_state = await _orchestrator.graph.ainvoke(state, config)
        else:
            # Fallback to direct invoke
            result_state = await _orchestrator.invoke(state)

        # Save interaction
        if _memory_manager and result_state.get("final_output"):
            _memory_manager.save_interaction(
                session_id=original_session_id,
                user_message=original_input,
                assistant_response=result_state["final_output"],
                metadata={"request_id": orchestration_id, "resumed_from_approval": request_id}
            )

        # Store for conversation sync with ORIGINAL session_id
        # This is critical - the frontend polls using the original session_id
        try:
            from routers.conversation_sync import store_resume_response
            await store_resume_response(
                session_id=original_session_id,  # FIX: Use original session_id
                request_id=orchestration_id,
                user_message=original_input,
                response=result_state.get("final_output", ""),
                capabilities_used=result_state.get("capabilities_used", [])
            )
            logger.info(f"Stored resume response for session {original_session_id}")
        except ImportError:
            logger.warning("conversation_sync not available, skipping response sync")
        except Exception as e:
            logger.error(f"Failed to store resume response: {e}")

        return ResumeResponse(
            request_id=orchestration_id,
            approval_id=request_id,
            status="completed",
            response=result_state.get("final_output"),
            execution_path=result_state.get("execution_path", []),
            capabilities_used=result_state.get("capabilities_used", [])
        )

    except Exception as e:
        logger.error(f"Failed to resume workflow: {e}", exc_info=True)
        return ResumeResponse(
            request_id=approval.get("orchestration_id", ""),
            approval_id=request_id,
            status="error",
            error=str(e)
        )


@router.get("/history", response_model=List[ApprovalHistoryItem])
async def get_approval_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[ApprovalStatus] = None,
    approval_type: Optional[ApprovalType] = None,
    include_auto_approved: bool = True
):
    """Get approval history."""
    await _ensure_initialized()

    history = await storage.get_history(limit=limit + 100, offset=0)

    # Apply filters
    if status:
        history = [h for h in history if h["status"] == status.value]
    if approval_type:
        history = [h for h in history if h["approval_type"] == approval_type.value]
    if not include_auto_approved:
        history = [h for h in history if h["status"] not in ["auto_approved", "flagged"]]

    # Apply pagination after filtering
    history = history[offset:offset + limit]

    return [ApprovalHistoryItem(**h) for h in history]


@router.get("/stats", response_model=ApprovalStats)
async def get_approval_stats():
    """Get approval statistics."""
    await _ensure_initialized()

    stats = await storage.get_stats()
    return ApprovalStats(**stats)


@router.delete("/pending/{request_id}")
async def cancel_approval_request(request_id: str):
    """Cancel a pending approval request."""
    await _ensure_initialized()

    approval = await storage.remove_pending(request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Add to history as cancelled
    approval["status"] = "cancelled"
    approval["approved_at"] = datetime.utcnow().isoformat() + "Z"
    await storage.add_to_history(approval)

    # Broadcast cancellation
    await notifier.broadcast({
        "type": "approval_cancelled",
        "data": approval
    })

    return {"status": "success", "message": f"Approval {request_id} cancelled"}


@router.get("/{request_id}", response_model=ApprovalHistoryItem)
async def get_approval(request_id: str):
    """Get any approval by ID (pending or processed)."""
    await _ensure_initialized()

    approval = await storage.get_approval(request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    return ApprovalHistoryItem(**approval)


# =============================================================================
# WebSocket Endpoint
# =============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time approval notifications."""
    await notifier.connect(websocket)
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()

            # Handle subscription/ping messages
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg.get("type") == "subscribe":
                    # Could implement filtering here
                    await websocket.send_json({"type": "subscribed", "status": "ok"})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        notifier.disconnect(websocket)


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check():
    """Check approval system health."""
    await _ensure_initialized()

    stats = await storage.get_stats()
    return {
        "status": "healthy",
        "service": "approvals",
        "storage": "redis" if storage._use_redis else "memory",
        "pending_count": stats["total_pending"],
        "orchestrator_available": _orchestrator is not None
    }


