# backend/ai-orchestration-layer/src/core/state.py

"""
Unified State for LangGraph workflows with HITL execution context support.
FIXED: Added execution_context to preserve workflow state during HITL pauses.
"""

from enum import Enum
from typing import TypedDict, Optional, List, Dict, Any
from datetime import datetime


class OrchestrationType(str, Enum):
    """Types of orchestration workflows"""
    CONVERSATIONAL = "conversational"
    AGENT_ROUTING = "agent_routing"
    WORKFLOW_EXECUTION = "workflow_execution"
    ML_PIPELINE = "ml_pipeline"
    RAG_QUERY = "rag_query"


class ExecutionContext(TypedDict, total=False):
    """
    Execution context preserved during HITL pauses.
    This is the CRITICAL piece that was missing - without this,
    the orchestrator doesn't know what to execute after approval.
    """
    # What capability/agent to execute after approval
    next_capability: str
    selected_agent: Optional[str]
    
    # Planned actions
    planned_tool_calls: List[Dict[str, Any]]
    planned_workflow_steps: List[str]
    
    # ML-specific context
    ml_model_id: Optional[str]
    ml_prediction_params: Optional[Dict[str, Any]]
    
    # Agent-specific context
    agent_task: Optional[str]
    agent_tools_selected: List[str]
    
    # RAG-specific context
    rag_query: Optional[str]
    rag_retrieved_docs: List[Dict[str, Any]]
    
    # Workflow-specific context
    workflow_id: Optional[str]
    workflow_step_index: int
    workflow_branch: Optional[str]
    
    # Risk assessment that triggered HITL
    risk_score: float
    risk_factors: List[str]
    
    # Checkpoint reference for recovery
    checkpoint_id: Optional[str]
    checkpoint_thread_id: Optional[str]


class UnifiedState(TypedDict, total=False):
    """
    Unified state for LangGraph workflows.
    Enhanced with execution_context for proper HITL support.
    """
    # Identifiers
    request_id: str
    user_id: str
    session_id: str

    # Orchestration
    orchestration_type: OrchestrationType
    current_node: str
    execution_path: List[str]
    next_action: str

    # Data
    input_data: str
    conversation_history: List[Dict[str, Any]]
    user_context: Dict[str, Any]
    intermediate_results: Dict[str, Any]
    final_output: Optional[str]
    
    # Messages for chat
    messages: List[Dict[str, Any]]

    # Control flow
    requires_human: bool
    
    # =========================================================================
    # HITL / Approval Fields (NEW)
    # =========================================================================
    # Approval status: pending, approved, rejected, auto_approved, timeout
    approval_status: Optional[str]
    
    # The approval request ID (for tracking)
    approval_request_id: Optional[str]
    
    # CRITICAL: Execution context preserved during HITL pause
    # This is what allows the workflow to resume after WS closes and reopens
    execution_context: Optional[ExecutionContext]
    
    # Risk score that triggered HITL (0.0 - 1.0)
    risk_score: float
    
    # Whether this was auto-approved due to low risk
    auto_approved: bool
    
    # Human feedback/modifications after approval
    human_feedback: Optional[Dict[str, Any]]
    human_modifications: Optional[Dict[str, Any]]

    # Resume control flag
    resuming_from_approval: bool
    
    # Errors during execution
    errors: List[str]

    # Observability
    logs: List[str]
    metrics: Dict[str, Any]
    start_time: datetime
    
    # Capabilities tracking
    capabilities_used: List[str]


def create_initial_state(
    request_id: str,
    user_id: str,
    session_id: str,
    input_data: str,
    orchestration_type: OrchestrationType = OrchestrationType.CONVERSATIONAL,
    user_context: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> UnifiedState:
    """
    Create a properly initialized UnifiedState.
    Use this instead of manually constructing the dict.
    """
    return UnifiedState(
        # Identifiers
        request_id=request_id,
        user_id=user_id,
        session_id=session_id,
        
        # Orchestration
        orchestration_type=orchestration_type,
        current_node="initialize",
        execution_path=[],
        next_action="",
        
        # Data
        input_data=input_data,
        conversation_history=conversation_history or [],
        user_context=user_context or {},
        intermediate_results={},
        final_output=None,
        messages=[],
        
        # Control flow
        requires_human=False,
        
        # HITL fields
        approval_status=None,
        approval_request_id=None,
        execution_context=None,
        risk_score=0.0,
        auto_approved=False,
        human_feedback=None,
        human_modifications=None,
        errors=[],
        
        # Observability
        logs=[],
        metrics={},
        start_time=datetime.now(),
        capabilities_used=[]
    )


def serialize_execution_context(ctx: ExecutionContext) -> Dict[str, Any]:
    """Serialize execution context for storage (Redis/DB)."""
    return dict(ctx) if ctx else {}


def deserialize_execution_context(data: Dict[str, Any]) -> ExecutionContext:
    """Deserialize execution context from storage."""
    if not data:
        return ExecutionContext()
    return ExecutionContext(**data)