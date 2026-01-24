# backend/ai-orchestration-layer/src/core/human_in_loop.py

"""
Human-in-the-Loop (HITL) System for AI Orchestration
FIXED: Implements proper risk-based hybrid approach and preserves execution context.

Risk-Based Hybrid Approach:
- Low risk (< 0.3): Auto-approve immediately
- Medium risk (0.3 - 0.7): Auto-approve but flag for review
- High risk (> 0.7): Wait for human approval

This provides a good balance between:
- Fast response for routine operations
- Human oversight for risky operations
- Audit trail for all operations
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable, Tuple
from dataclasses import dataclass, asdict, field
import uuid

from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver

from core.state import UnifiedState, ExecutionContext, OrchestrationType

logger = logging.getLogger(__name__)


class ApprovalStatus(str, Enum):
    """Status of human approval requests"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    AUTO_APPROVED = "auto_approved"  # Low risk auto-approval
    FLAGGED = "flagged"  # Medium risk, auto-approved but flagged


class ApprovalType(str, Enum):
    """Types of approvals that may be required"""
    FINANCIAL = "financial"
    DATA_ACCESS = "data_access"
    EXTERNAL_API = "external_api"
    ML_DECISION = "ml_decision"
    WORKFLOW_BRANCH = "workflow_branch"
    AGENT_ACTION = "agent_action"
    CONTENT_GENERATION = "content_generation"


class RiskLevel(str, Enum):
    """Risk levels for operations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Risk thresholds for hybrid approach
RISK_THRESHOLD_AUTO_APPROVE = 0.1
RISK_THRESHOLD_REQUIRE_HUMAN = 0.3


@dataclass
class ApprovalRequest:
    """Represents a request for human approval with full execution context"""
    request_id: str
    orchestration_id: str
    node_name: str
    approval_type: ApprovalType
    status: ApprovalStatus
    created_at: datetime
    expires_at: datetime
    requester_id: int
    approver_id: Optional[int] = None
    approved_at: Optional[datetime] = None

    # Context for the approval
    context: Dict[str, Any] = field(default_factory=dict)
    proposed_action: str = ""
    risk_level: str = "medium"
    risk_score: float = 0.5
    risk_factors: List[str] = field(default_factory=list)

    # CRITICAL: Execution context for resuming workflow
    # This is what was missing - without this, nothing happens after approval!
    execution_context: Dict[str, Any] = field(default_factory=dict)

    # Approval details
    approval_notes: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['approval_type'] = self.approval_type.value if isinstance(self.approval_type, ApprovalType) else self.approval_type
        data['status'] = self.status.value if isinstance(self.status, ApprovalStatus) else self.status
        data['created_at'] = self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at
        data['expires_at'] = self.expires_at.isoformat() if isinstance(self.expires_at, datetime) else self.expires_at
        if self.approved_at and isinstance(self.approved_at, datetime):
            data['approved_at'] = self.approved_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict) -> 'ApprovalRequest':
        """Create from dictionary"""
        data = data.copy()
        if isinstance(data.get('approval_type'), str):
            data['approval_type'] = ApprovalType(data['approval_type'])
        if isinstance(data.get('status'), str):
            data['status'] = ApprovalStatus(data['status'])
        if isinstance(data.get('created_at'), str):
            data['created_at'] = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        if isinstance(data.get('expires_at'), str):
            data['expires_at'] = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00'))
        if data.get('approved_at') and isinstance(data['approved_at'], str):
            data['approved_at'] = datetime.fromisoformat(data['approved_at'].replace('Z', '+00:00'))
        return cls(**data)


class HumanInLoopManager:
    """
    Manages human-in-the-loop interactions with RISK-BASED HYBRID APPROACH.

    This is the RECOMMENDED mode that automatically decides whether to wait
    for approval based on the operation's risk score.
    """

    def __init__(
        self,
        notification_handler: Optional[Callable] = None,
        storage_backend: Optional[Any] = None,  # Redis or other persistent storage
        router_storage: Optional[Any] = None,  # ApprovalStorage from router for frontend sync
        router_notifier: Optional[Any] = None  # ApprovalNotifier from router for WebSocket broadcast
    ):
        """
        Initialize HITL manager with optional persistent storage.

        Args:
            notification_handler: Async function to notify humans of pending approvals
            storage_backend: Redis client or similar for persistent storage
            router_storage: ApprovalStorage instance from approvals_router for frontend sync
            router_notifier: ApprovalNotifier instance from approvals_router for WebSocket broadcast
        """
        self.pending_approvals: Dict[str, ApprovalRequest] = {}
        self.approval_history: List[ApprovalRequest] = []
        self.notification_handler = notification_handler
        self.storage_backend = storage_backend
        self.router_storage = router_storage
        self.router_notifier = router_notifier

        # Default timeout
        self.default_timeout_seconds = 300  # 5 minutes

        # Approval rules and thresholds
        self.approval_rules = self._initialize_approval_rules()

        # WebSocket connections for real-time updates
        self.active_connections: Set[Any] = set()

        # Event for signaling approval completion
        self._approval_events: Dict[str, asyncio.Event] = {}

        # Start background task for timeout handling
        self._timeout_task = None

        logger.info("HumanInLoopManager initialized with risk-based hybrid approach")

    async def start(self):
        """Start background tasks"""
        if self._timeout_task is None:
            self._timeout_task = asyncio.create_task(self._timeout_monitor())
            logger.info("HITL timeout monitor started")

    def set_router_deps(self, router_storage: Any, router_notifier: Any):
        """
        Set router dependencies for frontend sync.
        Call this after both orchestrator and router are initialized.
        """
        self.router_storage = router_storage
        self.router_notifier = router_notifier
        logger.info("HITL router dependencies set for frontend sync")

    async def stop(self):
        """Stop background tasks"""
        if self._timeout_task:
            self._timeout_task.cancel()
            try:
                await self._timeout_task
            except asyncio.CancelledError:
                pass
            self._timeout_task = None

    def _initialize_approval_rules(self) -> Dict[str, Any]:
        """Initialize approval rules and thresholds"""
        return {
            ApprovalType.FINANCIAL: {
                "threshold": 1000,
                "auto_approve_below": 100,
                "risk_weight": 0.3,
                "timeout_minutes": 10
            },
            ApprovalType.DATA_ACCESS: {
                "sensitive_fields": ["ssn", "credit_card", "medical_records"],
                "risk_weight": 0.4,
                "timeout_minutes": 15
            },
            ApprovalType.EXTERNAL_API: {
                "expensive_apis": ["gpt-4", "anthropic-claude"],
                "cost_threshold": 10,
                "risk_weight": 0.2,
                "timeout_minutes": 5
            },
            ApprovalType.ML_DECISION: {
                "confidence_threshold": 0.7,
                "risk_weight": 0.35,
                "timeout_minutes": 10
            },
            ApprovalType.WORKFLOW_BRANCH: {
                "risk_weight": 0.25,
                "timeout_minutes": 10
            },
            ApprovalType.AGENT_ACTION: {
                "risk_weight": 0.3,
                "timeout_minutes": 5
            },
            ApprovalType.CONTENT_GENERATION: {
                "risk_weight": 0.15,
                "timeout_minutes": 5
            }
        }

    def calculate_risk_score(self, state: UnifiedState, approval_type: ApprovalType) -> Tuple[float, List[str]]:
        """
        Calculate risk score for the operation (0.0 to 1.0).
        Returns (risk_score, list_of_risk_factors).

        This is the core of the risk-based hybrid approach.
        """
        risk = 0.0
        risk_factors = []

        query_lower = state.get("input_data", "").lower()
        intermediate_results = state.get("intermediate_results", {})

        # Base risk from approval type
        rules = self.approval_rules.get(approval_type, {})
        risk += rules.get("risk_weight", 0.2)

        # Financial risk factors
        if approval_type == ApprovalType.FINANCIAL:
            amount = intermediate_results.get("transaction_amount", 0)
            threshold = rules.get("threshold", 1000)
            auto_approve = rules.get("auto_approve_below", 100)

            if amount > threshold:
                risk += 0.4
                risk_factors.append(f"High transaction amount: ${amount}")
            elif amount > auto_approve:
                risk += 0.2
                risk_factors.append(f"Moderate transaction amount: ${amount}")

        # Data access risk factors
        elif approval_type == ApprovalType.DATA_ACCESS:
            sensitive_fields = rules.get("sensitive_fields", [])
            for field in sensitive_fields:
                if field in str(intermediate_results).lower():
                    risk += 0.3
                    risk_factors.append(f"Access to sensitive data: {field}")

        # ML decision risk factors
        elif approval_type == ApprovalType.ML_DECISION:
            confidence = intermediate_results.get("ml_confidence",
                         state.get("metrics", {}).get("ml_confidence", 1.0))
            threshold = rules.get("confidence_threshold", 0.7)

            if confidence < threshold:
                risk += 0.3
                risk_factors.append(f"Low ML confidence: {confidence:.2f}")

            # High risk for ML decisions affecting many records
            affected_records = intermediate_results.get("affected_records", 0)
            if affected_records > 100:
                risk += 0.2
                risk_factors.append(f"Affects {affected_records} records")

        # Destructive operation risk
        destructive_words = ["delete", "remove", "cancel", "terminate", "drop", "destroy"]
        if any(word in query_lower for word in destructive_words):
            risk += 0.3
            risk_factors.append("Destructive operation detected")

        # Bulk operation risk
        bulk_words = ["all", "bulk", "batch", "every", "mass"]
        if any(word in query_lower for word in bulk_words):
            risk += 0.15
            risk_factors.append("Bulk operation detected")

        # External API cost risk
        if approval_type == ApprovalType.EXTERNAL_API:
            estimated_cost = intermediate_results.get("estimated_api_cost", 0)
            if estimated_cost > rules.get("cost_threshold", 10):
                risk += 0.25
                risk_factors.append(f"High API cost: ${estimated_cost}")

        # Cap at 1.0
        risk = min(risk, 1.0)

        return risk, risk_factors

    def determine_risk_level(self, risk_score: float) -> RiskLevel:
        """Convert risk score to risk level"""
        if risk_score < 0.3:
            return RiskLevel.LOW
        elif risk_score < 0.5:
            return RiskLevel.MEDIUM
        elif risk_score < 0.7:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL

    async def check_requires_approval(
        self,
        state: UnifiedState,
        node_name: str
    ) -> Optional[ApprovalType]:
        """
        Check if the current state requires human approval.
        Returns ApprovalType if approval needed, None otherwise.
        """
        orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)

        # Explicit flag takes precedence
        if state.get("requires_human", False):
            return self._infer_approval_type(state, node_name)

        # Check based on orchestration type
        approval_type_map = {
            OrchestrationType.ML_PIPELINE: ApprovalType.ML_DECISION,
            OrchestrationType.AGENT_ROUTING: ApprovalType.AGENT_ACTION,
            OrchestrationType.WORKFLOW_EXECUTION: ApprovalType.WORKFLOW_BRANCH,
        }

        approval_type = approval_type_map.get(orchestration_type)

        if approval_type:
            risk_score, _ = self.calculate_risk_score(state, approval_type)
            # Only require approval if risk is above auto-approve threshold
            if risk_score > RISK_THRESHOLD_AUTO_APPROVE:
                return approval_type

        return None

    def _infer_approval_type(self, state: UnifiedState, node_name: str) -> ApprovalType:
        """Infer approval type from state and node name"""
        query_lower = state.get("input_data", "").lower()

        if "payment" in query_lower or "transaction" in query_lower or "money" in query_lower:
            return ApprovalType.FINANCIAL
        elif "predict" in query_lower or "model" in query_lower or "ml" in node_name.lower():
            return ApprovalType.ML_DECISION
        elif "data" in query_lower or "access" in query_lower:
            return ApprovalType.DATA_ACCESS
        elif "api" in query_lower or "external" in query_lower:
            return ApprovalType.EXTERNAL_API
        elif "workflow" in node_name.lower():
            return ApprovalType.WORKFLOW_BRANCH
        else:
            return ApprovalType.AGENT_ACTION

    def build_execution_context(self, state: UnifiedState, node_name: str) -> ExecutionContext:
        """
        Build execution context that will be preserved during HITL pause.

        THIS IS CRITICAL - without this, the orchestrator won't know what to
        execute after approval!
        """
        orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)
        intermediate_results = state.get("intermediate_results", {})

        # Map orchestration type to capability
        capability_map = {
            OrchestrationType.CONVERSATIONAL: "chat",
            OrchestrationType.AGENT_ROUTING: "agent",
            OrchestrationType.WORKFLOW_EXECUTION: "workflow",
            OrchestrationType.ML_PIPELINE: "ml",
            OrchestrationType.RAG_QUERY: "rag"
        }

        risk_score, risk_factors = self.calculate_risk_score(
            state,
            self._infer_approval_type(state, node_name)
        )

        ctx = ExecutionContext(
            # What to execute after approval
            next_capability=capability_map.get(orchestration_type, "chat"),
            selected_agent=intermediate_results.get("selected_agent"),

            # Planned actions
            planned_tool_calls=intermediate_results.get("planned_tool_calls", []),
            planned_workflow_steps=intermediate_results.get("planned_steps", []),

            # ML context
            ml_model_id=intermediate_results.get("ml_model_id"),
            ml_prediction_params=intermediate_results.get("ml_params"),

            # Agent context
            agent_task=intermediate_results.get("agent_task"),
            agent_tools_selected=intermediate_results.get("agent_tools", []),

            # RAG context
            rag_query=intermediate_results.get("rag_query"),
            rag_retrieved_docs=intermediate_results.get("retrieved_docs", []),

            # Workflow context
            workflow_id=intermediate_results.get("workflow_id"),
            workflow_step_index=intermediate_results.get("workflow_step", 0),
            workflow_branch=intermediate_results.get("workflow_branch"),

            # Risk info
            risk_score=risk_score,
            risk_factors=risk_factors
        )

        return ctx

    async def request_approval_risk_based(
        self,
        state: UnifiedState,
        node_name: str,
        approval_type: ApprovalType,
        timeout_seconds: Optional[int] = None
    ) -> Tuple[ApprovalStatus, Optional[ApprovalRequest]]:
        """
        RISK-BASED HYBRID APPROACH (RECOMMENDED)

        Automatically decides whether to wait for approval based on risk score:
        - Low risk (< 0.3): Auto-approve immediately
        - Medium risk (0.3 - 0.7): Auto-approve but flag for review
        - High risk (> 0.7): Wait for human approval
        """
        # Calculate risk
        risk_score, risk_factors = self.calculate_risk_score(state, approval_type)
        risk_level = self.determine_risk_level(risk_score)

        logger.info(f"Risk assessment for {node_name}: score={risk_score:.2f}, level={risk_level.value}")

        # Build execution context BEFORE making any decisions
        execution_context = self.build_execution_context(state, node_name)

        # LOW RISK: Auto-approve immediately
        if risk_score < RISK_THRESHOLD_AUTO_APPROVE:
            state["approval_status"] = "auto_approved"
            state["risk_score"] = risk_score
            state["auto_approved"] = True
            state["execution_context"] = dict(execution_context)
            state["logs"].append(f"Auto-approved (low risk: {risk_score:.2f})")

            logger.info(f"Auto-approved {node_name} (low risk)")
            return ApprovalStatus.AUTO_APPROVED, None

        # Create approval request
        request = await self.create_approval_request(
            orchestration_id=state["request_id"],
            node_name=node_name,
            approval_type=approval_type,
            requester_id=int(state.get("user_id", 0)) if str(state.get("user_id", "0")).isdigit() else 0,
            context={
                "query": state["input_data"],
                "orchestration_type": state.get("orchestration_type", OrchestrationType.CONVERSATIONAL).value,
                "intermediate_results": state.get("intermediate_results", {})
            },
            proposed_action=self._generate_proposed_action(state, node_name),
            execution_context=dict(execution_context),
            risk_score=risk_score,
            risk_factors=risk_factors,
            timeout_seconds=timeout_seconds or self.default_timeout_seconds
        )

        # Update state with approval request info
        state["approval_request_id"] = request.request_id
        state["risk_score"] = risk_score
        state["execution_context"] = dict(execution_context)

        # MEDIUM RISK: Auto-approve but flag for review
        if risk_score < RISK_THRESHOLD_REQUIRE_HUMAN:
            request.status = ApprovalStatus.FLAGGED
            state["approval_status"] = "flagged"
            state["auto_approved"] = True
            state["logs"].append(f"Flagged for review (medium risk: {risk_score:.2f})")

            # Store in history for audit trail
            self.approval_history.append(request)
            await self._persist_to_storage(request)

            logger.info(f"Flagged {node_name} for review (medium risk)")
            return ApprovalStatus.FLAGGED, request

        # HIGH RISK: Wait for human approval
        request.status = ApprovalStatus.PENDING
        state["approval_status"] = "pending"
        state["auto_approved"] = False
        state["logs"].append(f"Waiting for approval (high risk: {risk_score:.2f})")

        # Store pending request
        self.pending_approvals[request.request_id] = request
        await self._persist_to_storage(request)

        # Notify (WebSocket, email, etc.)
        if self.notification_handler:
            await self.notification_handler(request)
        await self._broadcast_approval_request(request)

        logger.info(f"Approval required for {node_name} (high risk: {risk_score:.2f})")
        return ApprovalStatus.PENDING, request

    async def create_approval_request(
        self,
        orchestration_id: str,
        node_name: str,
        approval_type: ApprovalType,
        requester_id: int,
        context: Dict[str, Any],
        proposed_action: str,
        execution_context: Dict[str, Any],
        risk_score: float,
        risk_factors: List[str],
        timeout_seconds: int = 300
    ) -> ApprovalRequest:
        """Create a new approval request with full execution context"""

        request_id = f"apr_{uuid.uuid4().hex[:12]}"
        now = datetime.now()

        request = ApprovalRequest(
            request_id=request_id,
            orchestration_id=orchestration_id,
            node_name=node_name,
            approval_type=approval_type,
            status=ApprovalStatus.PENDING,
            created_at=now,
            expires_at=now + timedelta(seconds=timeout_seconds),
            requester_id=requester_id,
            context=context,
            proposed_action=proposed_action,
            risk_level=self.determine_risk_level(risk_score).value,
            risk_score=risk_score,
            risk_factors=risk_factors,
            execution_context=execution_context,
            metadata={
                "session_id": context.get("session_id"),
                "orchestration_type": context.get("orchestration_type")
            }
        )

        # Create event for this request
        self._approval_events[request_id] = asyncio.Event()

        return request

    async def wait_for_approval(
        self,
        request: ApprovalRequest,
        state: UnifiedState,
        poll_interval: float = 1.0
    ) -> Tuple[ApprovalStatus, Optional[Dict]]:
        """
        Wait for human approval with timeout.

        This method blocks until approval is received, rejected, or times out.
        Works correctly even if WebSocket connection closes and reopens.

        Returns:
            tuple of (status, modifications)
        """
        request_id = request.request_id

        # Get or create event for this request
        if request_id not in self._approval_events:
            self._approval_events[request_id] = asyncio.Event()

        event = self._approval_events[request_id]

        try:
            # Calculate remaining timeout
            remaining = (request.expires_at - datetime.now()).total_seconds()

            if remaining <= 0:
                # Already expired
                return ApprovalStatus.TIMEOUT, None

            # Wait for event with timeout
            try:
                await asyncio.wait_for(event.wait(), timeout=remaining)
            except asyncio.TimeoutError:
                # Handle timeout
                request = self.pending_approvals.get(request_id)
                if request:
                    request.status = ApprovalStatus.TIMEOUT
                    self.approval_history.append(request)
                    del self.pending_approvals[request_id]
                    await self._persist_to_storage(request)

                state["logs"].append(f"Approval request {request_id} timed out")
                return ApprovalStatus.TIMEOUT, None

            # Event was set - check result
            current_request = self.pending_approvals.get(request_id)

            if not current_request:
                # Already processed, check history
                for hist in reversed(self.approval_history):
                    if hist.request_id == request_id:
                        return hist.status, hist.modifications

            # Move to history if still in pending
            if current_request and current_request.status != ApprovalStatus.PENDING:
                self.approval_history.append(current_request)
                del self.pending_approvals[request_id]
                return current_request.status, current_request.modifications

            return ApprovalStatus.PENDING, None

        finally:
            # Cleanup event
            self._approval_events.pop(request_id, None)

    async def process_approval(
        self,
        request_id: str,
        approver_id: int,
        approved: bool,
        notes: Optional[str] = None,
        modifications: Optional[Dict] = None
    ) -> Tuple[bool, Optional[ApprovalRequest]]:
        """
        Process an approval decision.

        Returns:
            tuple of (success, updated_request)
        """
        request = self.pending_approvals.get(request_id)

        if not request:
            # Try to load from storage
            request = await self._load_from_storage(request_id)
            if not request:
                logger.warning(f"Approval request {request_id} not found")
                return False, None

        # Update request
        request.approver_id = approver_id
        request.approved_at = datetime.now()
        request.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        request.approval_notes = notes
        request.modifications = modifications

        # Move to history
        if request_id in self.pending_approvals:
            del self.pending_approvals[request_id]
        self.approval_history.append(request)

        # Persist
        await self._persist_to_storage(request)

        # Signal waiting coroutines
        if request_id in self._approval_events:
            self._approval_events[request_id].set()

        # Broadcast update
        await self._broadcast_approval_update(request)

        logger.info(f"Approval {request_id} {'approved' if approved else 'rejected'} by user {approver_id}")
        return True, request

    def get_approval_request(self, request_id: str) -> Optional[ApprovalRequest]:
        """Get an approval request by ID (from pending or history)"""
        # Check pending first
        if request_id in self.pending_approvals:
            return self.pending_approvals[request_id]

        # Check history
        for req in reversed(self.approval_history):
            if req.request_id == request_id:
                return req

        return None

    def _generate_proposed_action(self, state: UnifiedState, node_name: str) -> str:
        """Generate human-readable description of proposed action"""
        orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)
        input_data = state.get("input_data", "")[:100]

        action_templates = {
            "agent_system": f"Execute agent action for: {input_data}...",
            "workflow_system": f"Continue workflow execution: {orchestration_type.value}",
            "ml_system": f"Apply ML prediction on user request",
            "rag_system": f"Retrieve and generate response for: {input_data}...",
            "chat_system": f"Generate response for: {input_data}...",
        }

        return action_templates.get(node_name, f"Execute {node_name}: {input_data}...")

    async def _persist_to_storage(self, request: ApprovalRequest):
        """Persist approval request to storage backend (Redis) and router storage"""
        request_dict = request.to_dict()

        # Persist to Redis if available
        if self.storage_backend:
            try:
                key = f"approval:{request.request_id}"
                data = json.dumps(request_dict)
                await self.storage_backend.set(key, data, ex=86400)  # 24 hour TTL
            except Exception as e:
                logger.error(f"Failed to persist approval to storage: {e}")

        # CRITICAL: Sync with router storage for frontend visibility
        if self.router_storage:
            try:
                if request.status == ApprovalStatus.PENDING:
                    # Add to pending so frontend can see it
                    await self.router_storage.add_pending(request.request_id, request_dict)
                    logger.debug(f"Synced pending approval {request.request_id} to router storage")
                else:
                    # Remove from pending, add to history
                    await self.router_storage.remove_pending(request.request_id)
                    await self.router_storage.add_to_history(request_dict)
                    logger.debug(f"Synced completed approval {request.request_id} to router storage")
            except Exception as e:
                logger.error(f"Failed to sync approval to router storage: {e}")

    async def _load_from_storage(self, request_id: str) -> Optional[ApprovalRequest]:
        """Load approval request from storage backend"""
        if self.storage_backend:
            try:
                key = f"approval:{request_id}"
                data = await self.storage_backend.get(key)
                if data:
                    return ApprovalRequest.from_dict(json.loads(data))
            except Exception as e:
                logger.error(f"Failed to load approval from storage: {e}")
        return None

    async def _broadcast_approval_request(self, request: ApprovalRequest):
        """Broadcast approval request to connected WebSocket clients"""
        message = {
            "type": "approval_request",
            "data": request.to_dict()
        }

        # Broadcast via router notifier (main WebSocket for frontend)
        if self.router_notifier:
            try:
                await self.router_notifier.broadcast(message)
                logger.debug(f"Broadcasted approval {request.request_id} via router notifier")
            except Exception as e:
                logger.error(f"Failed to broadcast via router notifier: {e}")

        # Also broadcast via local connections (backward compatibility)
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.active_connections.discard(connection)

    async def _broadcast_approval_update(self, request: ApprovalRequest):
        """Broadcast approval update to connected WebSocket clients"""
        message = {
            "type": "approval_decided" if request.status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] else "approval_update",
            "data": request.to_dict()
        }

        # Broadcast via router notifier (main WebSocket for frontend)
        if self.router_notifier:
            try:
                await self.router_notifier.broadcast(message)
                logger.debug(f"Broadcasted approval update {request.request_id} via router notifier")
            except Exception as e:
                logger.error(f"Failed to broadcast update via router notifier: {e}")

        # Also broadcast via local connections (backward compatibility)
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.active_connections.discard(connection)

    async def _timeout_monitor(self):
        """Background task to monitor and handle timeouts"""
        while True:
            try:
                now = datetime.now()
                expired = []

                for request_id, request in list(self.pending_approvals.items()):
                    if request.expires_at < now and request.status == ApprovalStatus.PENDING:
                        request.status = ApprovalStatus.TIMEOUT
                        expired.append(request_id)

                        # Signal waiting coroutines
                        if request_id in self._approval_events:
                            self._approval_events[request_id].set()

                        await self._broadcast_approval_update(request)

                # Move expired to history
                for request_id in expired:
                    request = self.pending_approvals.pop(request_id, None)
                    if request:
                        self.approval_history.append(request)
                        await self._persist_to_storage(request)
                        logger.info(f"Approval {request_id} expired")

                await asyncio.sleep(10)  # Check every 10 seconds

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in timeout monitor: {e}")
                await asyncio.sleep(10)

    def get_pending_approvals(self, user_id: Optional[int] = None) -> List[ApprovalRequest]:
        """Get list of pending approvals, optionally filtered by user"""
        approvals = list(self.pending_approvals.values())

        if user_id:
            approvals = [a for a in approvals if a.requester_id == user_id]

        return sorted(approvals, key=lambda x: x.created_at, reverse=True)

    def get_approval_history(
        self,
        user_id: Optional[int] = None,
        limit: int = 50
    ) -> List[ApprovalRequest]:
        """Get approval history"""
        history = self.approval_history

        if user_id:
            history = [a for a in history if a.requester_id == user_id or a.approver_id == user_id]

        return sorted(history, key=lambda x: x.created_at, reverse=True)[:limit]

    def add_websocket_connection(self, websocket):
        """Add a WebSocket connection for real-time updates"""
        self.active_connections.add(websocket)

    def remove_websocket_connection(self, websocket):
        """Remove a WebSocket connection"""
        self.active_connections.discard(websocket)


def create_hitl_wrapper(hitl_manager: HumanInLoopManager):
    """
    Create a wrapper function to add HITL to any node.
    Uses the RISK-BASED HYBRID APPROACH.

    Usage:
        hitl_wrapper = create_hitl_wrapper(hitl_manager)
        workflow.add_node("risky_node", hitl_wrapper(original_node_func))
    """
    def wrapper(func: Callable):
        async def wrapped(state: UnifiedState) -> UnifiedState:
            node_name = func.__name__

            # Check if approval needed
            approval_type = await hitl_manager.check_requires_approval(state, node_name)

            if approval_type:
                # Use risk-based hybrid approach
                status, request = await hitl_manager.request_approval_risk_based(
                    state, node_name, approval_type
                )

                # If pending (high risk), wait for approval
                if status == ApprovalStatus.PENDING and request:
                    status, modifications = await hitl_manager.wait_for_approval(request, state)

                    if status == ApprovalStatus.REJECTED:
                        state["logs"].append(f"Action rejected by human: {node_name}")
                        state["next_action"] = "skip"
                        state["approval_status"] = "rejected"
                        return state

                    elif status == ApprovalStatus.TIMEOUT:
                        state["logs"].append(f"Approval timeout: {node_name}")
                        state["next_action"] = "timeout_handling"
                        state["approval_status"] = "timeout"
                        return state

                    # Apply modifications if any
                    if modifications:
                        state["intermediate_results"].update(modifications)
                        state["human_modifications"] = modifications
                        state["logs"].append(f"Applied human modifications: {modifications}")

                state["approval_status"] = "approved"
            
            # Execute the original function
            if asyncio.iscoroutinefunction(func):
                return await func(state)
            else:
                return func(state)
        
        return wrapped
    
    return wrapper