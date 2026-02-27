"""
Audit Trail Service — Persists structured AI interaction records to MongoDB.

Records contain: user_id, request_id, timestamp, orchestration_type,
prompt_summary (truncated), model info, duration, success status,
capabilities_used.

Uses the same MongoDB instance (mongodb-abtest / ai_orchestration database)
as the A/B testing framework.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# MongoDB imports with fallback
try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False


class AuditService:
    """Writes structured audit records to MongoDB audit_trail collection."""

    def __init__(self, mongodb_url: str, database: str, collection: str = "audit_trail"):
        self._mongodb_url = mongodb_url
        self._database = database
        self._collection_name = collection
        self._client: Optional[AsyncIOMotorClient] = None
        self._collection: Optional[AsyncIOMotorCollection] = None
        self._enabled = MONGODB_AVAILABLE

    async def initialize(self, mongo_config=None):
        """Connect to MongoDB and obtain the audit_trail collection handle."""
        if not self._enabled:
            logger.warning("motor not installed -- audit trail disabled")
            return

        try:
            client_kwargs = {}
            if mongo_config:
                client_kwargs = {
                    "maxPoolSize": mongo_config.max_pool_size,
                    "minPoolSize": mongo_config.min_pool_size,
                    "serverSelectionTimeoutMS": mongo_config.server_selection_timeout_ms,
                }

            self._client = AsyncIOMotorClient(self._mongodb_url, **client_kwargs)
            db = self._client[self._database]
            self._collection = db[self._collection_name]

            # Ensure indexes exist
            await self._collection.create_index([("timestamp", -1)])
            await self._collection.create_index([("user_id", 1)])
            await self._collection.create_index([("request_id", 1)], unique=True)
            await self._collection.create_index([("user_id", 1), ("timestamp", -1)])

            logger.info("Audit trail service initialized (collection=%s)", self._collection_name)
        except Exception as e:
            logger.error("Failed to initialize audit trail: %s", e)
            self._enabled = False

    async def record(
        self,
        request_id: str,
        user_id: str,
        orchestration_type: str,
        prompt_summary: str,
        duration_ms: int,
        success: bool,
        capabilities_used: Optional[List[str]] = None,
        model_id: Optional[str] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Insert a single audit record. Fire-and-forget -- never raises."""
        if not self._enabled or self._collection is None:
            return

        doc = {
            "request_id": request_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "orchestration_type": orchestration_type,
            "prompt_summary": prompt_summary,
            "duration_ms": duration_ms,
            "success": success,
            "capabilities_used": capabilities_used or [],
            "model_id": model_id,
            "error": error,
            "metadata": metadata or {},
        }

        try:
            await self._collection.insert_one(doc)
        except Exception as e:
            logger.warning("Audit write failed (non-fatal): %s", e)

    async def close(self):
        """Close the MongoDB client."""
        if self._client:
            self._client.close()
