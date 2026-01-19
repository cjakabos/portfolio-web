# backend/ai-orchestration-layer/src/core/human_in_loop.py

"""
Human-in-the-Loop (HITL) System for AI Orchestration
Implements interrupt patterns for human approval as taught in LangGraph course
"""

import asyncio
import json
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Callable
from dataclasses import dataclass, asdict
import uuid

from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver

from core.state import UnifiedState


class ApprovalStatus(Enum):
    """Status of human approval requests"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class ApprovalType(Enum):
    """Types of approvals that may be required"""
    FINANCIAL = "financial"  # Transactions above threshold
    DATA_ACCESS = "data_access"  # Accessing sensitive data
    EXTERNAL_API = "external_api"  # Calling expensive external APIs
    ML_DECISION = "ml_decision"  # Critical ML model decisions
    WORKFLOW_BRANCH = "workflow_branch"  # Major workflow decisions
    AGENT_ACTION = "agent_action"  # Autonomous agent actions
    CONTENT_GENERATION = "content_generation"  # Generated content review


@dataclass
class ApprovalRequest:
    """Represents a request for human approval"""
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
    context: Dict[str, Any] = None
    proposed_action: str = ""
    risk_level: str = "medium"  # low, medium, high, critical
    
    # Approval details
    approval_notes: Optional[str] = None
    modifications: Optional[Dict[str, Any]] = None
    
    # Metadata
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['approval_type'] = self.approval_type.value
        data['status'] = self.status.value
        data['created_at'] = self.created_at.isoformat()
        data['expires_at'] = self.expires_at.isoformat()
        if self.approved_at:
            data['approved_at'] = self.approved_at.isoformat()
        return data


class HumanInLoopManager:
    """
    Manages human-in-the-loop interactions and approval workflows
    """
    
    def __init__(self, notification_handler: Optional[Callable] = None):
        """
        Initialize HITL manager
        
        Args:
            notification_handler: Async function to notify humans of pending approvals
        """
        self.pending_approvals: Dict[str, ApprovalRequest] = {}
        self.approval_history: List[ApprovalRequest] = []
        self.notification_handler = notification_handler
        self.approval_timeout = 300  # 5 minutes default
        
        # Approval rules and thresholds
        self.approval_rules = self._initialize_approval_rules()
        
        # WebSocket connections for real-time updates
        self.active_connections: Set[Any] = set()
        
        # Start background task for timeout handling
        asyncio.create_task(self._timeout_monitor())
    
    def _initialize_approval_rules(self) -> Dict[str, Any]:
        """Initialize approval rules and thresholds"""
        return {
            ApprovalType.FINANCIAL: {
                "threshold": 1000,  # Dollar amount
                "auto_approve_below": 100,
                "required_approvers": ["finance_team"],
                "timeout_minutes": 10
            },
            ApprovalType.DATA_ACCESS: {
                "sensitive_fields": ["ssn", "credit_card", "medical_records"],
                "required_approvers": ["data_team", "compliance"],
                "timeout_minutes": 15
            },
            ApprovalType.EXTERNAL_API: {
                "expensive_apis": ["gpt-4", "anthropic-claude"],
                "cost_threshold": 10,  # Dollars
                "required_approvers": ["tech_lead"],
                "timeout_minutes": 5
            },
            ApprovalType.ML_DECISION: {
                "confidence_threshold": 0.7,  # Below this requires approval
                "critical_models": ["fraud_detection", "loan_approval"],
                "required_approvers": ["ml_team", "business_owner"],
                "timeout_minutes": 20
            },
            ApprovalType.WORKFLOW_BRANCH: {
                "critical_branches": ["delete_data", "send_notification", "process_payment"],
                "required_approvers": ["workflow_owner"],
                "timeout_minutes": 10
            },
            ApprovalType.AGENT_ACTION: {
                "restricted_actions": ["send_email", "modify_database", "call_api"],
                "required_approvers": ["agent_supervisor"],
                "timeout_minutes": 5
            }
        }
    
    async def check_requires_approval(self, state: UnifiedState, node_name: str) -> Optional[ApprovalType]:
        """
        Check if current state/node requires human approval
        
        Returns:
            ApprovalType if approval needed, None otherwise
        """
        # Check various conditions that might require approval
        
        # 1. Check if explicitly marked as requiring human approval
        if state.get("requires_human", False):
            return ApprovalType.WORKFLOW_BRANCH
        
        # 2. Check financial thresholds
        if "transaction_amount" in state.get("intermediate_results", {}):
            amount = state["intermediate_results"]["transaction_amount"]
            threshold = self.approval_rules[ApprovalType.FINANCIAL]["threshold"]
            if amount > threshold:
                return ApprovalType.FINANCIAL
        
        # 3. Check ML confidence
        if "ml_confidence" in state.get("metrics", {}):
            confidence = state["metrics"]["ml_confidence"]
            threshold = self.approval_rules[ApprovalType.ML_DECISION]["confidence_threshold"]
            if confidence < threshold:
                return ApprovalType.ML_DECISION
        
        # 4. Check for sensitive data access
        if "accessing_fields" in state.get("intermediate_results", {}):
            fields = state["intermediate_results"]["accessing_fields"]
            sensitive = self.approval_rules[ApprovalType.DATA_ACCESS]["sensitive_fields"]
            if any(field in sensitive for field in fields):
                return ApprovalType.DATA_ACCESS
        
        # 5. Check for critical workflow branches
        if node_name in self.approval_rules[ApprovalType.WORKFLOW_BRANCH]["critical_branches"]:
            return ApprovalType.WORKFLOW_BRANCH
        
        # 6. Check for restricted agent actions
        if state.get("orchestration_type") == "AGENT_ROUTING":
            planned_actions = state.get("intermediate_results", {}).get("planned_actions", [])
            restricted = self.approval_rules[ApprovalType.AGENT_ACTION]["restricted_actions"]
            if any(action in restricted for action in planned_actions):
                return ApprovalType.AGENT_ACTION
        
        return None
    
    async def request_approval(
        self, 
        state: UnifiedState,
        node_name: str,
        approval_type: ApprovalType,
        context: Optional[Dict] = None
    ) -> ApprovalRequest:
        """
        Create and submit an approval request
        """
        # Create approval request
        request = ApprovalRequest(
            request_id=str(uuid.uuid4()),
            orchestration_id=state["request_id"],
            node_name=node_name,
            approval_type=approval_type,
            status=ApprovalStatus.PENDING,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(
                minutes=self.approval_rules[approval_type].get("timeout_minutes", 10)
            ),
            requester_id=state["user_id"],
            context=context or {
                "input": state.get("input_data"),
                "current_results": state.get("intermediate_results"),
                "execution_path": state.get("execution_path")
            },
            proposed_action=self._generate_proposed_action(state, node_name),
            risk_level=self._assess_risk_level(state, approval_type),
            metadata={
                "session_id": state.get("session_id"),
                "orchestration_type": state.get("orchestration_type")
            }
        )
        
        # Store request
        self.pending_approvals[request.request_id] = request
        
        # Send notification
        if self.notification_handler:
            await self.notification_handler(request)
        
        # Broadcast to WebSocket connections
        await self._broadcast_approval_request(request)
        
        # Log
        state["logs"].append(f"Human approval requested: {request.request_id}")
        
        return request
    
    async def wait_for_approval(
        self,
        request: ApprovalRequest,
        state: UnifiedState
    ) -> tuple[ApprovalStatus, Optional[Dict]]:
        """
        Wait for human approval with timeout
        
        Returns:
            tuple of (status, modifications)
        """
        start_time = datetime.now()
        
        while True:
            # Check if approved/rejected
            current_request = self.pending_approvals.get(request.request_id)
            
            if not current_request:
                # Request was processed
                for hist in reversed(self.approval_history):
                    if hist.request_id == request.request_id:
                        return hist.status, hist.modifications
            
            if current_request.status != ApprovalStatus.PENDING:
                # Move to history
                self.approval_history.append(current_request)
                del self.pending_approvals[request.request_id]
                return current_request.status, current_request.modifications
            
            # Check timeout
            if datetime.now() > request.expires_at:
                current_request.status = ApprovalStatus.TIMEOUT
                self.approval_history.append(current_request)
                del self.pending_approvals[request.request_id]
                
                state["logs"].append(f"Approval request {request.request_id} timed out")
                return ApprovalStatus.TIMEOUT, None
            
            # Wait a bit before checking again
            await asyncio.sleep(1)
    
    async def process_approval(
        self,
        request_id: str,
        approver_id: int,
        approved: bool,
        notes: Optional[str] = None,
        modifications: Optional[Dict] = None
    ) -> bool:
        """
        Process an approval decision
        """
        request = self.pending_approvals.get(request_id)
        
        if not request:
            return False
        
        request.approver_id = approver_id
        request.approved_at = datetime.now()
        request.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        request.approval_notes = notes
        request.modifications = modifications
        
        # Broadcast update
        await self._broadcast_approval_update(request)
        
        return True
    
    def _generate_proposed_action(self, state: UnifiedState, node_name: str) -> str:
        """Generate human-readable description of proposed action"""
        action_templates = {
            "agent_system": "Execute agent action: {action}",
            "workflow_system": "Continue workflow: {workflow}",
            "ml_system": "Apply ML prediction: {prediction}",
            "external_api": "Call external API: {api}",
            "process_payment": "Process payment of ${amount}"
        }
        
        template = action_templates.get(node_name, f"Execute {node_name}")
        
        # Fill in template with state data
        return template.format(
            action=state.get("next_action", "unknown"),
            workflow=state.get("orchestration_type", "unknown"),
            prediction=state.get("intermediate_results", {}).get("ml_prediction", "unknown"),
            api=state.get("intermediate_results", {}).get("api_call", "unknown"),
            amount=state.get("intermediate_results", {}).get("transaction_amount", 0)
        )
    
    def _assess_risk_level(self, state: UnifiedState, approval_type: ApprovalType) -> str:
        """Assess risk level of the action requiring approval"""
        # Simplified risk assessment logic
        risk_factors = {
            ApprovalType.FINANCIAL: lambda s: "critical" if s.get("intermediate_results", {}).get("transaction_amount", 0) > 10000 else "high",
            ApprovalType.DATA_ACCESS: lambda s: "high" if "medical" in str(s.get("intermediate_results", {})) else "medium",
            ApprovalType.ML_DECISION: lambda s: "high" if s.get("metrics", {}).get("ml_confidence", 1) < 0.5 else "medium",
            ApprovalType.EXTERNAL_API: lambda s: "medium",
            ApprovalType.WORKFLOW_BRANCH: lambda s: "high",
            ApprovalType.AGENT_ACTION: lambda s: "medium"
        }
        
        assessor = risk_factors.get(approval_type, lambda s: "medium")
        return assessor(state)
    
    async def _broadcast_approval_request(self, request: ApprovalRequest):
        """Broadcast approval request to connected WebSocket clients"""
        message = {
            "type": "approval_request",
            "data": request.to_dict()
        }
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                self.active_connections.discard(connection)
    
    async def _broadcast_approval_update(self, request: ApprovalRequest):
        """Broadcast approval update to connected clients"""
        message = {
            "type": "approval_update",
            "data": request.to_dict()
        }
        
        for connection in self.active_connections:
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
                
                for request_id, request in self.pending_approvals.items():
                    if request.expires_at < now and request.status == ApprovalStatus.PENDING:
                        request.status = ApprovalStatus.TIMEOUT
                        expired.append(request_id)
                        await self._broadcast_approval_update(request)
                
                # Move expired to history
                for request_id in expired:
                    request = self.pending_approvals.pop(request_id)
                    self.approval_history.append(request)
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                print(f"Error in timeout monitor: {e}")
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
    Create a wrapper function to add HITL to any node
    
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
                # Request approval
                request = await hitl_manager.request_approval(
                    state, node_name, approval_type
                )
                
                # Wait for approval
                status, modifications = await hitl_manager.wait_for_approval(request, state)
                
                if status == ApprovalStatus.REJECTED:
                    state["logs"].append(f"Action rejected by human: {node_name}")
                    state["next_action"] = "skip"
                    return state
                
                elif status == ApprovalStatus.TIMEOUT:
                    state["logs"].append(f"Approval timeout: {node_name}")
                    state["next_action"] = "timeout_handling"
                    return state
                
                # Apply modifications if any
                if modifications:
                    state["intermediate_results"].update(modifications)
                    state["logs"].append(f"Applied human modifications: {modifications}")
            
            # Execute the original function
            if asyncio.iscoroutinefunction(func):
                return await func(state)
            else:
                return func(state)
        
        return wrapped
    
    return wrapper