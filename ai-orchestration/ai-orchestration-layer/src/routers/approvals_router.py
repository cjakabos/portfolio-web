# =============================================================================
# File: src/routers/approvals_router.py
# FIXED: Connected to Orchestrator's HumanInLoopManager
# =============================================================================
"""
Approvals Router - Human-in-the-Loop (HITL) Approval System

CRITICAL FIX: Now reads from orchestrator.hitl_manager.pending_approvals
instead of a separate ApprovalStorage class.

The orchestrator creates approval requests via hitl_manager.request_approval()
and this router exposes those approvals via the REST API.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
import asyncio
import json

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


# =============================================================================
# Pydantic Models
# =============================================================================

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
    expires_in_seconds: int = Field(default=300, ge=60, le=3600)


class ApprovalRequestResponse(BaseModel):
    request_id: str
    orchestration_id: str
    approval_type: str
    status: str
    created_at: str
    expires_at: str
    requester_id: Any
    proposed_action: str
    risk_level: str
    context: Dict[str, Any]


class ApprovalDecision(BaseModel):
    approved: bool
    approver_id: int
    approval_notes: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None


class ApprovalHistoryItem(BaseModel):
    request_id: str
    orchestration_id: str
    approval_type: str
    status: str
    created_at: str
    expires_at: str
    requester_id: Any
    proposed_action: str
    risk_level: str
    context: Dict[str, Any]
    approved_at: Optional[str] = None
    approver_id: Optional[int] = None
    approval_notes: Optional[str] = None


class ApprovalStats(BaseModel):
    total_pending: int
    total_approved: int
    total_rejected: int
    total_expired: int
    avg_response_time_seconds: float
    by_type: Dict[str, int]
    by_risk_level: Dict[str, int]


# =============================================================================
# CRITICAL: Reference to Orchestrator's HumanInLoopManager
# =============================================================================

# This will be set via dependency injection from main.py
_hitl_manager = None
_orchestrator = None

# History storage (approvals that have been decided)
_approval_history: List[dict] = []


def set_approvals_hitl_manager(hitl_manager, orchestrator=None):
    """
    Dependency injection - connect this router to the orchestrator's hitl_manager.
    
    Called from main.py lifespan:
        from routers import approvals_router
        approvals_router.set_approvals_hitl_manager(orchestrator.hitl_manager, orchestrator)
    """
    global _hitl_manager, _orchestrator
    _hitl_manager = hitl_manager
    _orchestrator = orchestrator
    logger.info("Approvals router connected to HumanInLoopManager")


def _get_hitl_manager():
    """Get the HumanInLoopManager, raising error if not connected."""
    if _hitl_manager is None:
        raise HTTPException(
            status_code=503, 
            detail="Approvals system not initialized. HumanInLoopManager not connected."
        )
    return _hitl_manager


# =============================================================================
# Helper Functions
# =============================================================================

def _approval_request_to_dict(request) -> dict:
    """Convert ApprovalRequest dataclass to dict for JSON serialization."""
    return {
        "request_id": request.request_id,
        "orchestration_id": request.orchestration_id,
        "node_name": getattr(request, 'node_name', 'unknown'),
        "approval_type": request.approval_type.value if hasattr(request.approval_type, 'value') else str(request.approval_type),
        "status": request.status.value if hasattr(request.status, 'value') else str(request.status),
        "created_at": request.created_at.isoformat() + "Z" if hasattr(request.created_at, 'isoformat') else str(request.created_at),
        "expires_at": request.expires_at.isoformat() + "Z" if hasattr(request.expires_at, 'isoformat') else str(request.expires_at),
        "requester_id": request.requester_id,
        "proposed_action": request.proposed_action,
        "risk_level": request.risk_level.value if hasattr(request.risk_level, 'value') else str(request.risk_level),
        "context": request.context if isinstance(request.context, dict) else {},
        "metadata": getattr(request, 'metadata', {})
    }


def _get_risk_level_from_score(score: float) -> str:
    """Convert risk score to risk level string."""
    if score < 0.3:
        return "low"
    elif score < 0.7:
        return "medium"
    elif score < 0.9:
        return "high"
    else:
        return "critical"


# =============================================================================
# Background Tasks
# =============================================================================

_expiration_task = None


async def check_expired_approvals():
    """Background task to expire old approvals."""
    while True:
        try:
            hitl = _hitl_manager
            if hitl and hasattr(hitl, 'pending_approvals'):
                now = datetime.utcnow()
                expired_ids = []
                
                for request_id, request in list(hitl.pending_approvals.items()):
                    if hasattr(request, 'expires_at') and now > request.expires_at:
                        expired_ids.append(request_id)
                
                for request_id in expired_ids:
                    request = hitl.pending_approvals.pop(request_id, None)
                    if request:
                        # Add to history as expired
                        history_item = _approval_request_to_dict(request)
                        history_item["status"] = "expired"
                        history_item["approved_at"] = now.isoformat() + "Z"
                        _approval_history.insert(0, history_item)
                        logger.info(f"Approval {request_id} expired")
                        
        except Exception as e:
            logger.error(f"Error in expiration check: {e}")
        
        await asyncio.sleep(30)  # Check every 30 seconds


# =============================================================================
# Initialization Functions (called from main.py lifespan)
# =============================================================================

async def initialize_approvals():
    """
    Initialize approval system and start background tasks.
    Called from main.py lifespan AFTER orchestrator is created.
    """
    global _expiration_task
    _expiration_task = asyncio.create_task(check_expired_approvals())
    logger.info("Approvals background task started")


async def shutdown_approvals():
    """Cleanup on shutdown."""
    global _expiration_task
    if _expiration_task:
        _expiration_task.cancel()
        try:
            await _expiration_task
        except asyncio.CancelledError:
            pass


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/pending", response_model=List[ApprovalRequestResponse])
async def get_pending_approvals(
    approval_type: Optional[ApprovalType] = None,
    risk_level: Optional[RiskLevel] = None
):
    """
    Get all pending approval requests.
    
    FIXED: Now reads from orchestrator.hitl_manager.pending_approvals
    """
    hitl = _get_hitl_manager()
    
    # Get pending approvals from HumanInLoopManager
    pending_requests = list(hitl.pending_approvals.values())
    
    # Convert to dicts
    pending = [_approval_request_to_dict(req) for req in pending_requests]
    
    # Apply filters
    if approval_type:
        pending = [p for p in pending if p["approval_type"] == approval_type.value]
    if risk_level:
        pending = [p for p in pending if p.get("risk_level") == risk_level.value]
    
    # Sort by creation time (newest first)
    pending.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    logger.info(f"Returning {len(pending)} pending approvals")
    return pending


@router.get("/pending/{request_id}", response_model=ApprovalRequestResponse)
async def get_pending_approval(request_id: str):
    """Get a specific pending approval."""
    hitl = _get_hitl_manager()
    
    request = hitl.pending_approvals.get(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    return _approval_request_to_dict(request)


@router.post("/pending/{request_id}/decide", response_model=ApprovalHistoryItem)
async def decide_approval(request_id: str, decision: ApprovalDecision):
    """
    Approve or reject a pending request.
    
    FIXED: Now calls hitl_manager.process_approval() to unblock the waiting orchestration.
    """
    hitl = _get_hitl_manager()
    
    # Check if request exists
    request = hitl.pending_approvals.get(request_id)
    if not request:
        raise HTTPException(
            status_code=404, 
            detail="Approval request not found or already processed"
        )
    
    # Process the approval through HumanInLoopManager
    # This will update the status and trigger the waiting asyncio.Event
    try:
        if decision.approved:
            from core.human_in_loop import ApprovalStatus as HITLApprovalStatus
            await hitl.process_approval(
                request_id=request_id,
                approved=True,
                approver_id=decision.approver_id,
                notes=decision.approval_notes,
                modifications=decision.modifications
            )
            status = "approved"
        else:
            await hitl.process_approval(
                request_id=request_id,
                approved=False,
                approver_id=decision.approver_id,
                notes=decision.approval_notes
            )
            status = "rejected"
    except Exception as e:
        logger.error(f"Error processing approval: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Create history item
    now = datetime.utcnow()
    history_item = _approval_request_to_dict(request)
    history_item["status"] = status
    history_item["approved_at"] = now.isoformat() + "Z"
    history_item["approver_id"] = decision.approver_id
    history_item["approval_notes"] = decision.approval_notes
    
    # Add to history
    _approval_history.insert(0, history_item)
    _approval_history[:] = _approval_history[:1000]  # Keep last 1000
    
    action = "approved" if decision.approved else "rejected"
    logger.info(f"Approval {request_id} {action} by user {decision.approver_id}")
    
    return history_item


@router.delete("/pending/{request_id}")
async def cancel_approval_request(request_id: str):
    """Cancel a pending approval request."""
    hitl = _get_hitl_manager()
    
    request = hitl.pending_approvals.pop(request_id, None)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    # Add to history as cancelled
    now = datetime.utcnow()
    history_item = _approval_request_to_dict(request)
    history_item["status"] = "cancelled"
    history_item["approved_at"] = now.isoformat() + "Z"
    _approval_history.insert(0, history_item)
    
    logger.info(f"Approval {request_id} cancelled")
    
    return {"status": "cancelled", "request_id": request_id}


@router.get("/history", response_model=List[ApprovalHistoryItem])
async def get_approval_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[ApprovalStatus] = None,
    approval_type: Optional[ApprovalType] = None
):
    """Get approval history."""
    history = _approval_history[offset:offset + limit]
    
    # Apply filters
    if status:
        history = [h for h in history if h.get("status") == status.value]
    if approval_type:
        history = [h for h in history if h.get("approval_type") == approval_type.value]
    
    return history


@router.get("/stats", response_model=ApprovalStats)
async def get_approval_stats():
    """Get approval statistics."""
    hitl = _get_hitl_manager()
    
    pending = list(hitl.pending_approvals.values())
    history = _approval_history
    
    total_approved = sum(1 for h in history if h.get("status") == "approved")
    total_rejected = sum(1 for h in history if h.get("status") == "rejected")
    total_expired = sum(1 for h in history if h.get("status") in ["expired", "timeout", "cancelled"])
    
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
    
    # Count by type and risk
    by_type = {}
    by_risk = {}
    
    all_items = [_approval_request_to_dict(p) for p in pending] + history
    for item in all_items:
        atype = item.get("approval_type", "unknown")
        risk = item.get("risk_level", "unknown")
        by_type[atype] = by_type.get(atype, 0) + 1
        by_risk[risk] = by_risk.get(risk, 0) + 1
    
    return ApprovalStats(
        total_pending=len(pending),
        total_approved=total_approved,
        total_rejected=total_rejected,
        total_expired=total_expired,
        avg_response_time_seconds=sum(response_times) / len(response_times) if response_times else 0,
        by_type=by_type,
        by_risk_level=by_risk
    )


@router.get("/health")
async def health_check():
    """Check approvals system health."""
    hitl = _hitl_manager
    connected = hitl is not None
    pending_count = len(hitl.pending_approvals) if hitl else 0
    
    return {
        "status": "healthy" if connected else "degraded",
        "service": "approvals",
        "hitl_connected": connected,
        "pending_count": pending_count,
        "history_count": len(_approval_history)
    }


# =============================================================================
# WebSocket for Real-time Updates
# =============================================================================

_ws_connections: List[WebSocket] = []


@router.websocket("/ws")
async def approvals_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time approval updates."""
    await websocket.accept()
    _ws_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total: {len(_ws_connections)}")
    
    try:
        while True:
            # Keep connection alive, listen for pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_connections:
            _ws_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(_ws_connections)}")


async def broadcast_approval_update(event_type: str, data: dict):
    """Broadcast approval update to all connected WebSocket clients."""
    message = json.dumps({"event": event_type, "data": data})
    disconnected = []
    
    for ws in _ws_connections:
        try:
            await ws.send_text(message)
        except:
            disconnected.append(ws)
    
    for ws in disconnected:
        if ws in _ws_connections:
            _ws_connections.remove(ws)