"""
Approvals Router - Human-in-the-Loop (HITL) Approval System

FIXES APPLIED:
1. .dict() → .model_dump() (Pydantic v2)
2. @router.on_event("startup") → exported initialize_approvals() function
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
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
    context: ApprovalContext


class ApprovalDecision(BaseModel):
    approved: bool
    approver_id: int
    approval_notes: Optional[str] = None


class ApprovalHistoryItem(ApprovalRequest):
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
# In-Memory Storage (Redis fallback)
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
            # Set expiration
            expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
            ttl = int((expires_at - datetime.now()).total_seconds())
            if ttl > 0:
                await self._redis_client.expire(f"approvals:pending:{request_id}", ttl)
        else:
            self._pending[request_id] = data
    
    async def get_pending(self, request_id: str) -> Optional[dict]:
        """Get a pending approval by ID."""
        if self._use_redis and self._redis_client:
            data = await self._redis_client.hget("approvals:pending", request_id)
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
            # Keep only last 1000 entries
            await self._redis_client.ltrim("approvals:history", 0, 999)
        else:
            self._history.insert(0, data)
            self._history = self._history[:1000]
    
    async def get_history(self, limit: int = 100, offset: int = 0) -> List[dict]:
        """Get approval history."""
        if self._use_redis and self._redis_client:
            data = await self._redis_client.lrange("approvals:history", offset, offset + limit - 1)
            return [json.loads(item) for item in data]
        return self._history[offset:offset + limit]
    
    async def get_stats(self) -> dict:
        """Get approval statistics."""
        history = await self.get_history(limit=1000)
        pending = await self.get_all_pending()
        
        total_approved = sum(1 for h in history if h.get("status") == "approved")
        total_rejected = sum(1 for h in history if h.get("status") == "rejected")
        total_expired = sum(1 for h in history if h.get("status") in ["expired", "timeout"])
        
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
            "avg_response_time_seconds": sum(response_times) / len(response_times) if response_times else 0,
            "by_type": by_type,
            "by_risk_level": by_risk
        }


# Global storage instance
storage = ApprovalStorage()

# Background task reference
_expiration_task = None


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
                expires_at = datetime.fromisoformat(approval["expires_at"].replace("Z", "+00:00"))
                if now > expires_at:
                    # Move to history as expired
                    expired = await storage.remove_pending(approval["request_id"])
                    if expired:
                        expired["status"] = "expired"
                        expired["approved_at"] = now.isoformat() + "Z"
                        await storage.add_to_history(expired)
                        logger.info(f"Approval {approval['request_id']} expired")
        except Exception as e:
            logger.error(f"Error in expiration check: {e}")
        
        await asyncio.sleep(30)  # Check every 30 seconds


# =============================================================================
# Initialization Function (called from main.py lifespan)
# =============================================================================

async def initialize_approvals():
    """
    Initialize approval storage and start background tasks.
    Called from main.py lifespan.
    """
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


# =============================================================================
# Helper to ensure initialization
# =============================================================================

async def _ensure_initialized():
    """Ensure storage is initialized before operations."""
    if not storage._initialized:
        await storage.initialize()


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/request", response_model=ApprovalRequest)
async def create_approval_request(request: ApprovalRequestCreate):
    """Create a new approval request."""
    await _ensure_initialized()
    
    request_id = f"req-{uuid.uuid4().hex[:8]}"
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
        "context": request.context.model_dump()  # FIXED: was .dict()
    }
    
    await storage.add_pending(request_id, approval_data)
    logger.info(f"Created approval request {request_id}")
    
    return ApprovalRequest(**approval_data)


@router.get("/pending", response_model=List[ApprovalRequest])
async def get_pending_approvals(
    approval_type: Optional[ApprovalType] = None,
    risk_level: Optional[RiskLevel] = None
):
    """Get all pending approval requests."""
    await _ensure_initialized()
    
    pending = await storage.get_all_pending()
    
    # Apply filters
    if approval_type:
        pending = [p for p in pending if p["approval_type"] == approval_type.value]
    if risk_level:
        pending = [p for p in pending if p["risk_level"] == risk_level.value]
    
    # Sort by creation time (newest first)
    pending.sort(key=lambda x: x["created_at"], reverse=True)
    
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
    
    await storage.add_to_history(approval)
    
    action = "approved" if decision.approved else "rejected"
    logger.info(f"Approval {request_id} {action} by user {decision.approver_id}")
    
    return ApprovalHistoryItem(**approval)


@router.get("/history", response_model=List[ApprovalHistoryItem])
async def get_approval_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[ApprovalStatus] = None,
    approval_type: Optional[ApprovalType] = None
):
    """Get approval history."""
    await _ensure_initialized()
    
    history = await storage.get_history(limit=limit + 100, offset=0)  # Get extra for filtering
    
    # Apply filters
    if status:
        history = [h for h in history if h["status"] == status.value]
    if approval_type:
        history = [h for h in history if h["approval_type"] == approval_type.value]
    
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
    
    return {"status": "success", "message": f"Approval {request_id} cancelled"}


# =============================================================================
# WebSocket for Real-time Updates (Optional)
# =============================================================================

from fastapi import WebSocket, WebSocketDisconnect


class ApprovalNotifier:
    """Manages WebSocket connections for real-time approval notifications."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


notifier = ApprovalNotifier()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time approval notifications."""
    await notifier.connect(websocket)
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            # Could handle subscription filters here
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
        "pending_count": stats["total_pending"]
    }
