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


class UnifiedState(TypedDict, total=False):
    """Unified state for LangGraph workflows"""
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

    # Control flow
    requires_human: bool

    # Observability
    logs: List[str]
    metrics: Dict[str, Any]
    start_time: datetime