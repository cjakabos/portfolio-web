# backend/ai-orchestration-layer/src/routers/conversation_sync.py

"""
Conversation Sync Router - Sync resumed workflow responses to chat interface.

This router allows the chat interface to retrieve responses from workflows
that were resumed via the approval interface, even if the original WebSocket
connection was closed.

Features:
- Store responses from resumed workflows
- Retrieve all responses for a session (for page refresh)
- Poll for new responses (for real-time updates)
- Mark responses as delivered (for one-time polling)
"""

import logging
import os
import json
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from routers.approvals_router import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversation-sync", tags=["Conversation Sync"])


# =============================================================================
# Pydantic Models
# =============================================================================

class SyncedMessage(BaseModel):
    """A message synced from approval resume to chat."""
    request_id: str
    user_message: str
    response: str
    capabilities_used: List[str] = Field(default_factory=list)
    timestamp: str
    delivered: bool = False


class MarkDeliveredRequest(BaseModel):
    """Request to mark messages as delivered."""
    request_ids: List[str]


class MarkDeliveredResponse(BaseModel):
    """Response after marking messages."""
    marked: int


# =============================================================================
# Redis Storage
# =============================================================================

_redis_client = None
RESPONSE_TTL = 86400  # 24 hours


async def init_redis():
    """Initialize Redis connection for conversation sync."""
    global _redis_client

    try:
        import redis.asyncio as redis
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        _redis_client = redis.from_url(redis_url, db=3)  # Use DB 3 for conversation sync
        await _redis_client.ping()
        logger.info("Conversation sync using Redis storage")
    except Exception as e:
        logger.warning(f"Redis not available for conversation sync: {e}")
        _redis_client = None


async def _ensure_initialized():
    """Ensure Redis is initialized."""
    if _redis_client is None:
        await init_redis()


# =============================================================================
# Storage Functions (can be imported by approvals_router)
# =============================================================================

async def store_resume_response(
    session_id: str,
    request_id: str,
    user_message: str,
    response: str,
    capabilities_used: List[str] = None
) -> bool:
    """
    Store a response from a resumed workflow for the chat interface to retrieve.

    Args:
        session_id: The session to associate the response with
        request_id: The orchestration request ID
        user_message: The original user message
        response: The LLM response
        capabilities_used: List of capabilities used

    Returns:
        True if stored successfully, False otherwise
    """
    await _ensure_initialized()

    if not _redis_client:
        logger.warning("Cannot store resume response - Redis not available")
        return False

    try:
        data = {
            "request_id": request_id,
            "user_message": user_message,
            "response": response,
            "capabilities_used": capabilities_used or [],
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "delivered": False
        }

        # Use sorted set for ordering by timestamp
        score = datetime.utcnow().timestamp()
        await _redis_client.zadd(
            f"session_responses:{session_id}",
            {json.dumps(data): score}
        )

        # Set TTL on the whole set
        await _redis_client.expire(f"session_responses:{session_id}", RESPONSE_TTL)

        logger.info(f"Stored resume response for session {session_id}, request {request_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to store resume response: {e}")
        return False


async def get_session_responses(
    session_id: str,
    since_timestamp: Optional[float] = None,
    include_delivered: bool = False
) -> List[Dict[str, Any]]:
    """
    Get responses for a session.

    Args:
        session_id: The session to get responses for
        since_timestamp: Only get responses after this Unix timestamp (for polling)
        include_delivered: If True, include already-delivered responses (for refresh)

    Returns:
        List of response dictionaries
    """
    await _ensure_initialized()

    if not _redis_client:
        return []

    try:
        # Get all responses ordered by timestamp
        if since_timestamp:
            # Only new responses (for polling)
            raw_responses = await _redis_client.zrangebyscore(
                f"session_responses:{session_id}",
                since_timestamp,
                "+inf"
            )
        else:
            # All responses (for refresh/reconnect)
            raw_responses = await _redis_client.zrange(
                f"session_responses:{session_id}",
                0, -1
            )

        responses = []
        for raw in raw_responses:
            try:
                data = json.loads(raw)
                if include_delivered or not data.get("delivered"):
                    responses.append(data)
            except json.JSONDecodeError:
                continue

        return responses

    except Exception as e:
        logger.error(f"Failed to get session responses: {e}")
        return []


async def mark_responses_delivered(
    session_id: str,
    request_ids: List[str]
) -> int:
    """
    Mark responses as delivered.

    Args:
        session_id: The session
        request_ids: List of request IDs to mark as delivered

    Returns:
        Number of responses marked
    """
    await _ensure_initialized()

    if not _redis_client:
        return 0

    try:
        # Get all responses with scores
        raw_responses = await _redis_client.zrange(
            f"session_responses:{session_id}",
            0, -1,
            withscores=True
        )

        marked = 0
        for raw, score in raw_responses:
            try:
                data = json.loads(raw)
                if data["request_id"] in request_ids and not data.get("delivered"):
                    # Update the entry
                    data["delivered"] = True
                    await _redis_client.zrem(f"session_responses:{session_id}", raw)
                    await _redis_client.zadd(
                        f"session_responses:{session_id}",
                        {json.dumps(data): score}
                    )
                    marked += 1
            except (json.JSONDecodeError, KeyError):
                continue

        return marked

    except Exception as e:
        logger.error(f"Failed to mark responses as delivered: {e}")
        return 0


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/session/{session_id}/responses", response_model=List[SyncedMessage])
async def get_responses(
    session_id: str,
    since_timestamp: Optional[float] = Query(None, description="Unix timestamp to get responses after"),
    include_delivered: bool = Query(False, description="Include already-delivered responses")
):
    """
    Get all responses for a session.

    Use cases:
    - Page refresh: Call with include_delivered=true to get all responses
    - Polling: Call with since_timestamp to get only new responses
    """
    responses = await get_session_responses(
        session_id=session_id,
        since_timestamp=since_timestamp,
        include_delivered=include_delivered
    )

    return [SyncedMessage(**r) for r in responses]


@router.post("/session/{session_id}/responses/mark-delivered", response_model=MarkDeliveredResponse)
async def mark_delivered(session_id: str, request: MarkDeliveredRequest):
    """
    Mark responses as delivered so they won't appear in future polls.

    Call this after successfully displaying responses in the chat interface.
    """
    marked = await mark_responses_delivered(
        session_id=session_id,
        request_ids=request.request_ids
    )

    return MarkDeliveredResponse(marked=marked)


@router.delete("/session/{session_id}/responses")
async def clear_session_responses(session_id: str):
    """
    Clear all responses for a session.

    Use this when starting a new conversation or for cleanup.
    """
    await _ensure_initialized()

    if _redis_client:
        await _redis_client.delete(f"session_responses:{session_id}")

    return {"status": "cleared", "session_id": session_id}


@router.get("/health")
async def health_check():
    """Health check for conversation sync."""
    await _ensure_initialized()

    return {
        "status": "healthy",
        "service": "conversation_sync",
        "storage": "redis" if _redis_client else "unavailable"
    }