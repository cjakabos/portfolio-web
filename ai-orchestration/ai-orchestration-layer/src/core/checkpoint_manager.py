# backend/ai-orchestration-layer/src/core/checkpoint_manager.py

"""
Enhanced Checkpointing and Recovery System for AI Orchestration Layer
Based on LangGraph best practices for persistence and fault tolerance
"""

import json
import sqlite3
import uuid
from typing import Any, Dict, List, Optional, Tuple, Iterator, AsyncIterator
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

# LangGraph imports
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    CheckpointTuple,
    Checkpoint,
    CheckpointMetadata,
    ChannelVersions
)

class SQLiteCheckpointer(BaseCheckpointSaver):
    """
    SQLite-based checkpointer that implements the full LangGraph v0.2+ Async Interface.
    """
    def __init__(self, db_path: str):
        super().__init__()
        self.db_path = db_path
        self.conn = None
        self._init_db()

    def _init_db(self):
        """Initialize the SQLite database schema."""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        cursor = self.conn.cursor()

        # Checkpoints table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkpoints (
            thread_id TEXT,
            thread_ts TEXT,
            parent_ts TEXT,
            checkpoint BLOB,
            metadata BLOB,
            PRIMARY KEY (thread_id, thread_ts)
        )
        """)

        # Writes table (for intermediate state)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkpoint_writes (
            thread_id TEXT,
            thread_ts TEXT,
            task_id TEXT,
            idx INTEGER,
            channel TEXT,
            type TEXT,
            value BLOB,
            PRIMARY KEY (thread_id, thread_ts, task_id, idx)
        )
        """)
        self.conn.commit()

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Synchronous get_tuple (Legacy support)."""
        thread_id = config["configurable"]["thread_id"]
        thread_ts = config["configurable"].get("thread_ts")

        cursor = self.conn.cursor()

        if thread_ts:
            cursor.execute(
                "SELECT checkpoint, metadata, parent_ts FROM checkpoints WHERE thread_id = ? AND thread_ts = ?",
                (thread_id, thread_ts)
            )
        else:
            cursor.execute(
                "SELECT checkpoint, metadata, parent_ts, thread_ts FROM checkpoints WHERE thread_id = ? ORDER BY thread_ts DESC LIMIT 1",
                (thread_id,)
            )

        row = cursor.fetchone()
        if not row:
            return None

        if thread_ts:
            checkpoint_data, metadata_data, parent_ts = row
        else:
            checkpoint_data, metadata_data, parent_ts, thread_ts = row
            config = {"configurable": {"thread_id": thread_id, "thread_ts": thread_ts}}

        # Deserialize
        checkpoint = json.loads(checkpoint_data)
        metadata = json.loads(metadata_data) if metadata_data else {}

        # COMPATIBILITY FIXES for LangGraph v0.2+
        # 1. Ensure 'channel_values' key exists
        if isinstance(checkpoint, dict) and "channel_values" not in checkpoint:
            checkpoint["channel_values"] = checkpoint.get("v", checkpoint)

        # 2. Ensure 'step' key exists in metadata
        if "step" not in metadata:
            metadata["step"] = 0

        # Fetch pending writes if any
        cursor.execute(
            "SELECT task_id, channel, type, value FROM checkpoint_writes WHERE thread_id = ? AND thread_ts = ?",
            (thread_id, thread_ts)
        )
        writes = []
        for task_id, channel, type_, value_data in cursor.fetchall():
            writes.append((task_id, channel, json.loads(value_data)))

        return CheckpointTuple(
            config=config,
            checkpoint=checkpoint,
            metadata=metadata,
            parent_config={"configurable": {"thread_id": thread_id, "thread_ts": parent_ts}} if parent_ts else None,
            pending_writes=writes
        )

    # --- ASYNC METHODS (REQUIRED FOR LANGGRAPH v0.2+) ---

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Async wrapper for get_tuple."""
        return self.get_tuple(config)

    def list(self, config: Optional[RunnableConfig], *, filter: Optional[Dict[str, Any]] = None, before: Optional[RunnableConfig] = None, limit: int = 10) -> Iterator[CheckpointTuple]:
        """Synchronous list checkpoints."""
        thread_id = config["configurable"]["thread_id"]
        cursor = self.conn.cursor()

        query = "SELECT thread_ts, parent_ts, checkpoint, metadata FROM checkpoints WHERE thread_id = ? ORDER BY thread_ts DESC LIMIT ?"
        cursor.execute(query, (thread_id, limit))

        for row in cursor.fetchall():
            thread_ts, parent_ts, checkpoint_data, metadata_data = row
            checkpoint = json.loads(checkpoint_data)
            metadata = json.loads(metadata_data) if metadata_data else {}

            # Compatibility Fixes
            if isinstance(checkpoint, dict) and "channel_values" not in checkpoint:
                checkpoint["channel_values"] = checkpoint.get("v", checkpoint)
            if "step" not in metadata:
                metadata["step"] = 0

            yield CheckpointTuple(
                config={"configurable": {"thread_id": thread_id, "thread_ts": thread_ts}},
                checkpoint=checkpoint,
                metadata=metadata,
                parent_config={"configurable": {"thread_id": thread_id, "thread_ts": parent_ts}} if parent_ts else None,
                pending_writes=[]
            )

    async def alist(self, config: Optional[RunnableConfig], *, filter: Optional[Dict[str, Any]] = None, before: Optional[RunnableConfig] = None, limit: int = 10) -> AsyncIterator[CheckpointTuple]:
        """Async wrapper for list."""
        for item in self.list(config, filter=filter, before=before, limit=limit):
            yield item

    def put(self, config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, new_versions: ChannelVersions = None) -> RunnableConfig:
        """Synchronous save checkpoint."""
        thread_id = config["configurable"]["thread_id"]
        thread_ts = checkpoint["id"]
        parent_ts = config["configurable"].get("thread_ts")

        # Serialize
        checkpoint_json = json.dumps(checkpoint)
        metadata_json = json.dumps(metadata)

        cursor = self.conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO checkpoints (thread_id, thread_ts, parent_ts, checkpoint, metadata) VALUES (?, ?, ?, ?, ?)",
            (thread_id, thread_ts, parent_ts, checkpoint_json, metadata_json)
        )
        self.conn.commit()

        return {
            "configurable": {
                "thread_id": thread_id,
                "thread_ts": thread_ts,
            }
        }

    async def aput(self, config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, new_versions: ChannelVersions = None) -> RunnableConfig:
        """Async wrapper for put."""
        return self.put(config, checkpoint, metadata, new_versions)

    def put_writes(self, config: RunnableConfig, writes: List[tuple[str, Any]], task_id: str) -> None:
        # Fix: Safely access configurable keys
        configurable = config.get("configurable", {})
        thread_id = configurable.get("thread_id")
        thread_ts = configurable.get("thread_ts")

        # If thread_ts is missing (e.g., during an early crash), we skip saving
        # because the database requires it for the Primary Key.
        if not thread_id or not thread_ts:
            return

        cursor = self.conn.cursor()
        for idx, (channel, value) in enumerate(writes):
            value_json = json.dumps(value)
            type_ = "json" # simplified for sqlite

            cursor.execute(
                "INSERT OR REPLACE INTO checkpoint_writes (thread_id, thread_ts, task_id, idx, channel, type, value) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (thread_id, thread_ts, task_id, idx, channel, type_, value_json)
            )
        self.conn.commit()

    async def aput_writes(self, config: RunnableConfig, writes: List[tuple[str, Any]], task_id: str) -> None:
        """Async wrapper for put_writes."""
        return self.put_writes(config, writes, task_id)

class RecoveryManager:
    """
    Manages recovery from failed orchestrations
    Implements retry strategies and failure analysis
    """
    
    def __init__(self, checkpointer: SQLiteCheckpointer):
        self.checkpointer = checkpointer
        self.max_retries = 3
        self.retry_delay = 5  # seconds
    
    def get_failed_orchestrations(self, hours: int = 24) -> List[Dict]:
        """Get list of failed orchestrations in the last N hours"""
        cutoff = datetime.now() - timedelta(hours=hours)
        
        with self.checkpointer._get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    thread_id,
                    checkpoint_id,
                    metadata,
                    created_at
                FROM checkpoints
                WHERE 
                    created_at > ? AND
                    json_extract(metadata, '$.status') = 'failed'
                ORDER BY created_at DESC
            """, (cutoff,))
            
            return [dict(row) for row in cursor]
    
    def can_retry(self, thread_id: str) -> tuple[bool, Optional[str]]:
        """Check if an orchestration can be retried"""
        config = {"configurable": {"thread_id": thread_id}}
        checkpoints = self.checkpointer.list(config, limit=self.max_retries + 1)
        
        if not checkpoints:
            return False, "No checkpoints found"
        
        # Count retry attempts
        retry_count = sum(
            1 for _, metadata, _ in checkpoints
            if metadata.get("is_retry", False)
        )
        
        if retry_count >= self.max_retries:
            return False, f"Max retries ({self.max_retries}) exceeded"
        
        # Check if last attempt was recent (avoid retry storms)
        last_checkpoint = checkpoints[0]
        last_metadata = last_checkpoint[1]
        last_attempt = datetime.fromisoformat(last_metadata.get("timestamp", ""))
        
        if (datetime.now() - last_attempt).seconds < self.retry_delay:
            return False, "Too soon to retry"
        
        return True, None
    
    def prepare_retry_state(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Prepare state for retry from last successful checkpoint"""
        config = {"configurable": {"thread_id": thread_id}}
        
        # Find last successful checkpoint
        checkpoints = self.checkpointer.list(config, limit=10)
        
        for checkpoint, metadata, checkpoint_config in checkpoints:
            if metadata.get("status") == "success":
                # Restore state from this checkpoint
                state = checkpoint.get("channel_values", {}).get("__root__", {})
                
                # Mark as retry
                state["is_retry"] = True
                state["retry_from_checkpoint"] = checkpoint_config["configurable"]["checkpoint_id"]
                state["retry_attempt"] = metadata.get("retry_attempt", 0) + 1
                
                return UnifiedState(**state)
        
        return None
    
    def analyze_failure_patterns(self, days: int = 7) -> Dict:
        """Analyze common failure patterns for improvement"""
        cutoff = datetime.now() - timedelta(days=days)
        
        with self.checkpointer._get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    json_extract(metadata, '$.error_type') as error_type,
                    json_extract(metadata, '$.failed_node') as failed_node,
                    COUNT(*) as count
                FROM checkpoints
                WHERE 
                    created_at > ? AND
                    json_extract(metadata, '$.status') = 'failed'
                GROUP BY error_type, failed_node
                ORDER BY count DESC
            """, (cutoff,))
            
            patterns = {}
            for row in cursor:
                error_type = row["error_type"] or "unknown"
                if error_type not in patterns:
                    patterns[error_type] = {
                        "count": 0,
                        "nodes": {}
                    }
                
                patterns[error_type]["count"] += row["count"]
                node = row["failed_node"] or "unknown"
                patterns[error_type]["nodes"][node] = row["count"]
            
            return patterns


# Integration with existing orchestrator
def enhance_orchestrator_with_checkpointing():
    """
    Function to integrate checkpointing into existing AIOrchestrationLayer
    """
    from core.orchestrator import AIOrchestrationLayer
    
    # Create checkpointer
    checkpointer = SQLiteCheckpointer("data/orchestration_checkpoints.db")
    
    # Modify the graph compilation to include checkpointer
    original_build_graph = AIOrchestrationLayer._build_unified_graph
    
    def _build_unified_graph_with_checkpoint(self):
        workflow = original_build_graph(self)
        # Compile with checkpointer
        return workflow.compile(checkpointer=checkpointer)
    
    # Monkey patch for demonstration (in production, modify the class directly)
    AIOrchestrationLayer._build_unified_graph = _build_unified_graph_with_checkpoint
    
    # Add recovery manager
    recovery_manager = RecoveryManager(checkpointer)
    
    return checkpointer, recovery_manager