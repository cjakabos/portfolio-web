# backend/ai-orchestration-layer/src/core/orchestrator.py

"""
AI Orchestration Layer - COMPLETE VERSION WITH PROPER HITL INTEGRATION

FIXED: Human-in-the-Loop now uses RISK-BASED HYBRID APPROACH:
- Low risk (< 0.1): Auto-approve immediately
- Medium risk (0.1 - 0.3): Auto-approve but flag for review
- High risk (> 0.3): Wait for human approval

CRITICAL FIX: Execution context is now properly preserved during HITL pause,
allowing workflows to resume correctly even after WebSocket disconnection.
"""

from typing import Dict, Any, Literal, Optional, List
from datetime import datetime
import asyncio
import uuid

from langgraph.graph import StateGraph, END
from langgraph.types import Send
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage, SystemMessage

from core.state import UnifiedState, OrchestrationType, ExecutionContext, create_initial_state
from core.llm_manager import get_llm, get_streaming_llm
from core.config import get_config
from core.unified_logger import get_logger, get_state_logger, set_log_context
from core.tool_manager import get_tool_manager

# Import capabilities
from capabilities.agent_executor import AgentExecutor
from capabilities.workflow_executor import WorkflowExecutor
from capabilities.ml_orchestrator import MLOrchestrator
from capabilities.rag_engine import RAGEngine
from capabilities.chat_manager import ChatManager

# ============================================================================
# SAFE IMPORTS WITH FALLBACKS
# ============================================================================

# Checkpointing
CHECKPOINTING_AVAILABLE = False
SQLiteCheckpointer = None
RecoveryManager = None
try:
    from core.checkpoint_manager import SQLiteCheckpointer, RecoveryManager
    CHECKPOINTING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Checkpointing not available: {e}")
    print("   Will use in-memory checkpointing (MemorySaver)")

# Human-in-the-Loop
HITL_AVAILABLE = False
HumanInLoopManager = None
ApprovalType = None
ApprovalStatus = None
try:
    from core.human_in_loop import (
        HumanInLoopManager,
        ApprovalType,
        ApprovalStatus,
        RISK_THRESHOLD_AUTO_APPROVE,
        RISK_THRESHOLD_REQUIRE_HUMAN
    )
    HITL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Human-in-the-Loop not available: {e}")
    print("   Approval requests will be auto-approved")
    # Define fallback thresholds
    RISK_THRESHOLD_AUTO_APPROVE = 0.3
    RISK_THRESHOLD_REQUIRE_HUMAN = 0.7

# Parallel Execution
PARALLEL_AVAILABLE = False
ParallelExecutionManager = None
ParallelStrategy = None
try:
    from core.parallel_executor import ParallelExecutionManager, ParallelStrategy
    PARALLEL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Parallel execution not available: {e}")

# Streaming
STREAMING_AVAILABLE = False
StreamingOrchestrationManager = None
ChunkedResponseBuilder = None
try:
    from core.streaming_manager import StreamingOrchestrationManager, ChunkedResponseBuilder
    STREAMING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Streaming not available: {e}")

# Error Handling
ERROR_HANDLING_AVAILABLE = False
ErrorHandler = None
try:
    from core.error_handling import ErrorHandler
    ERROR_HANDLING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Error handling not available: {e}")

# Type alias
RoutingDecision = Literal["agent", "workflow", "ml", "rag", "chat", "human_review", "parallel", "error"]


class AIOrchestrationLayer:
    """
    Complete AI orchestration layer with RISK-BASED HITL integration.

    Features:
    ✅ Multi-node graph with routing
    ✅ Intent classification
    ✅ RISK-BASED HITL (auto-approve low risk, flag medium, wait for high)
    ✅ Execution context preservation for workflow resume
    ✅ Parallel execution coordination
    ✅ Token streaming support
    ✅ Memory updates
    ✅ Complete metrics tracking
    """

    def __init__(
        self,
        enable_checkpointing: bool = True,
        enable_hitl: bool = True,
        enable_parallel: bool = True,
        enable_streaming: bool = False,
        enable_error_handling: bool = True,
        max_parallel_workers: int = 10,
        checkpoint_db_path: str = "data/orchestration_checkpoints.db",
        hitl_wait_mode: str = "risk_based"  # "always_wait", "never_wait", "risk_based"
    ):
        """Initialize orchestration layer with RISK-BASED HITL."""

        # Configuration
        self.config = get_config()
        self.logger = get_logger()
        self.tool_manager = get_tool_manager()

        # HITL mode
        self.hitl_wait_mode = hitl_wait_mode

        # Feature availability
        self.features_available = {
            "checkpointing": CHECKPOINTING_AVAILABLE,
            "hitl": HITL_AVAILABLE,
            "parallel": PARALLEL_AVAILABLE,
            "streaming": STREAMING_AVAILABLE,
            "error_handling": ERROR_HANDLING_AVAILABLE
        }

        # Feature flags
        self.enable_checkpointing = enable_checkpointing and CHECKPOINTING_AVAILABLE
        self.enable_hitl = enable_hitl and HITL_AVAILABLE
        self.enable_parallel = enable_parallel and PARALLEL_AVAILABLE
        self.enable_streaming = enable_streaming and STREAMING_AVAILABLE
        self.enable_error_handling = enable_error_handling and ERROR_HANDLING_AVAILABLE

        # LLM
        #self.llm = get_llm()

        # Initialize capabilities
        self._init_capabilities()

        # Checkpointing
        if self.enable_checkpointing:
            self.checkpointer: BaseCheckpointSaver = SQLiteCheckpointer(checkpoint_db_path)
            self.recovery_manager = RecoveryManager(self.checkpointer)
            self.logger.info("checkpointing_enabled", {"db_path": checkpoint_db_path})
        else:
            self.checkpointer: BaseCheckpointSaver = MemorySaver()
            self.recovery_manager = None
            self.logger.warning("checkpointing_fallback", {"fallback": "in-memory"})

        # Human-in-the-Loop
        if self.enable_hitl:
            self.hitl_manager = HumanInLoopManager()
            # Start background tasks
            asyncio.create_task(self.hitl_manager.start())
            self.logger.info("hitl_enabled", {
                "mode": self.hitl_wait_mode,
                "auto_approve_threshold": RISK_THRESHOLD_AUTO_APPROVE,
                "require_human_threshold": RISK_THRESHOLD_REQUIRE_HUMAN
            })
        else:
            self.hitl_manager = None
            self.logger.warning("hitl_fallback", {"fallback": "all requests auto-approved"})

        # Parallel Execution
        if self.enable_parallel:
            self.parallel_manager = ParallelExecutionManager(max_workers=max_parallel_workers)
            self.logger.info("parallel_enabled", {"max_workers": max_parallel_workers})
        else:
            self.parallel_manager = None

        # Streaming
        if self.enable_streaming:
            self.streaming_manager = StreamingOrchestrationManager()
            # We fetch it dynamically when needed or use the manager
            self.response_builders: Dict[str, ChunkedResponseBuilder] = {}
            self.logger.info("streaming_enabled")
        else:
            self.streaming_manager = None

        # Error Handling
        if self.enable_error_handling:
            self.error_handler = ErrorHandler(
                max_history=1000,
                redis_url=self.config.redis.url
            )
            self._register_default_fallbacks()
            self.logger.info("error_handling_enabled")
        else:
            self.error_handler = None

        # Build the graph
        self.graph = self._build_complete_graph()

        self._log_initialization_summary()

    def _init_capabilities(self) -> None:
        """Initialize all capabilities."""
        self.agent_executor = AgentExecutor()
        self.workflow_executor = WorkflowExecutor()
        self.ml_orchestrator = MLOrchestrator()
        self.rag_engine = RAGEngine()
        self.chat_manager = ChatManager()

    def _register_default_fallbacks(self) -> None:
        """Register default fallback handlers."""
        if not self.error_handler:
            return

        # Register fallbacks for each capability
        fallbacks = {
            "agent_executor": lambda state: {**state, "result": "Agent temporarily unavailable"},
            "workflow_executor": lambda state: {**state, "result": "Workflow temporarily unavailable"},
            "ml_orchestrator": lambda state: {**state, "result": "ML service temporarily unavailable"},
            "rag_engine": lambda state: {**state, "result": "Knowledge base temporarily unavailable"},
            "chat_manager": lambda state: {**state, "result": "Chat service temporarily unavailable"},
        }

        for tool_name, fallback in fallbacks.items():
            self.error_handler.register_fallback(tool_name, fallback)

    def _log_initialization_summary(self) -> None:
        """Log initialization summary."""
        enabled = [k for k, v in {
            "Checkpointing": self.enable_checkpointing,
            "HITL": self.enable_hitl,
            "Parallel": self.enable_parallel,
            "Streaming": self.enable_streaming,
            "ErrorHandling": self.enable_error_handling
        }.items() if v]

        self.logger.info("orchestrator_initialized", {
            "enabled_features": enabled,
            "hitl_mode": self.hitl_wait_mode if self.enable_hitl else "disabled",
            "total_features": len(enabled)
        })

    def get_feature_status(self) -> Dict[str, Any]:
        """Get status of all system features."""
        available = dict(self.features_available)

        enabled = {
            "checkpointing": self.enable_checkpointing,
            "hitl": self.enable_hitl,
            "parallel": self.enable_parallel,
            "streaming": self.enable_streaming,
            "error_handling": self.enable_error_handling,
        }

        fallbacks = {
            "checkpointing": "in-memory" if not self.enable_checkpointing else None,
            "hitl": "auto-approve-all" if not self.enable_hitl else None,
            "parallel": "sequential" if not self.enable_parallel else None,
            "streaming": "batch-response" if not self.enable_streaming else None,
            "error_handling": "basic" if not self.enable_error_handling else None,
        }

        fixes_applied = {}
        if hasattr(self, 'checkpointer') and isinstance(self.checkpointer, MemorySaver):
            fixes_applied["checkpointing"] = "using_memory_saver_fallback"

        return {
            "available": available,
            "enabled": enabled,
            "fallbacks": fallbacks,
            "fixes_applied": fixes_applied,
        }

    # ========================================================================
    # GRAPH BUILDING
    # ========================================================================

    def _build_complete_graph(self) -> StateGraph:
        """Build the complete orchestration graph."""
        workflow = StateGraph(UnifiedState)

        # Add all nodes
        workflow.add_node("initialize", self.initialize_request)
        workflow.add_node("classify_intent", self.classify_user_intent)
        workflow.add_node("route_to_capability", self.route_to_capability)

        # Capability nodes
        workflow.add_node("agent_system", self.execute_agent_system)
        workflow.add_node("workflow_system", self.execute_workflow)
        workflow.add_node("ml_system", self.execute_ml_pipeline)
        workflow.add_node("rag_system", self.execute_rag_query)
        workflow.add_node("chat_system", self.execute_chat)

        # Final nodes
        workflow.add_node("synthesize_response", self.synthesize_response)
        workflow.add_node("update_memory", self.update_memory)

        # Optional nodes
        if self.enable_hitl:
            workflow.add_node("human_review", self.human_review_node_risk_based)
            workflow.add_node("apply_human_feedback", self.apply_human_feedback)

        if self.enable_parallel:
            workflow.add_node("parallel_coordinator", self.parallel_coordinator)
            workflow.add_node("merge_parallel_results", self.merge_parallel_results)

        # Define edges
        workflow.set_entry_point("initialize")
        workflow.add_edge("initialize", "classify_intent")
        workflow.add_edge("classify_intent", "route_to_capability")

        # Conditional routing
        self._define_routing_edges(workflow)

        # HITL edges
        if self.enable_hitl:
            self._define_hitl_edges(workflow)

        # Parallel edges
        if self.enable_parallel:
            self._define_parallel_edges(workflow)

        # Final edges
        self._define_final_edges(workflow)

        return workflow.compile(checkpointer=self.checkpointer)

    def _define_routing_edges(self, workflow: StateGraph) -> None:
        """Define routing edges."""
        routing_map = {
            "agent": "agent_system",
            "workflow": "workflow_system",
            "ml": "ml_system",
            "rag": "rag_system",
            "chat": "chat_system",
        }

        if self.enable_hitl:
            routing_map["human_review"] = "human_review"

        if self.enable_parallel:
            routing_map["parallel"] = "parallel_coordinator"

        if self.enable_error_handling:
            routing_map["error"] = "synthesize_response"

        workflow.add_conditional_edges(
            "route_to_capability",
            self.decide_execution_strategy,
            routing_map
        )

    def _define_hitl_edges(self, workflow: StateGraph) -> None:
        """Define HITL edges with risk-based routing."""
        workflow.add_conditional_edges(
            "human_review",
            self._hitl_decision_router,
            {
                "approved": "apply_human_feedback",
                "auto_approved": "apply_human_feedback",
                "flagged": "apply_human_feedback",
                "rejected": "synthesize_response",
                "timeout": "synthesize_response",
                "pending": "synthesize_response"  # Return pending status to client
            }
        )
        workflow.add_edge("apply_human_feedback", "synthesize_response")

    def _hitl_decision_router(self, state: UnifiedState) -> str:
        """Route based on approval status."""
        status = state.get("approval_status", "pending")

        if status in ["approved", "auto_approved", "flagged"]:
            return status if status in ["auto_approved", "flagged"] else "approved"
        elif status == "rejected":
            return "rejected"
        elif status == "timeout":
            return "timeout"
        else:
            return "pending"

    def _define_parallel_edges(self, workflow: StateGraph) -> None:
        """Define parallel execution edges."""
        workflow.add_edge("parallel_coordinator", "merge_parallel_results")
        workflow.add_edge("merge_parallel_results", "synthesize_response")

    def _define_final_edges(self, workflow: StateGraph) -> None:
        """Define final processing edges."""
        for node in ["agent_system", "workflow_system", "ml_system", "rag_system", "chat_system"]:
            workflow.add_edge(node, "synthesize_response")

        workflow.add_edge("synthesize_response", "update_memory")
        workflow.add_edge("update_memory", END)

    # ========================================================================
    # CORE NODES
    # ========================================================================

    def initialize_request(self, state: UnifiedState) -> UnifiedState:
        """Initialize request."""
        state_logger = get_state_logger(state)
        state_logger.info(f"Initializing request {state['request_id']}")

        set_log_context(
            request_id=state["request_id"],
            user_id=state["user_id"],
            session_id=state["session_id"]
        )

        state["execution_path"].append("initialize")
        state["metrics"]["start_time"] = datetime.now().isoformat()

        # Initialize fields
        if not state.get("input_data"):
            state["input_data"] = ""
        if "conversation_history" not in state:
            state["conversation_history"] = []
        if not state.get("user_context"):
            state["user_context"] = {}
        if not state.get("intermediate_results"):
            state["intermediate_results"] = {}
        if "errors" not in state:
            state["errors"] = []
        if "logs" not in state:
            state["logs"] = []
        if "capabilities_used" not in state:
            state["capabilities_used"] = []

        return state

    async def classify_user_intent(self, state: UnifiedState) -> UnifiedState:
        """Classify user intent."""
        state_logger = get_state_logger(state)
        state["execution_path"].append("classify_intent")

        query: str = state["input_data"].lower()

        # Rule-based classification
        if any(word in query for word in ["shop", "cart", "order", "buy", "pet", "vehicle", "schedule"]):
            state["orchestration_type"] = OrchestrationType.AGENT_ROUTING
        elif any(word in query for word in ["book", "groom", "supply", "workflow"]):
            state["orchestration_type"] = OrchestrationType.WORKFLOW_EXECUTION
        elif any(word in query for word in ["predict", "segment", "analyze", "insight", "model"]):
            state["orchestration_type"] = OrchestrationType.ML_PIPELINE
        elif any(word in query for word in ["note", "document", "find", "knowledge", "wrote"]):
            state["orchestration_type"] = OrchestrationType.RAG_QUERY
        else:
            state["orchestration_type"] = OrchestrationType.CONVERSATIONAL

        state_logger.info(f"Classified as: {state['orchestration_type'].value}")
        return state

    def route_to_capability(self, state: UnifiedState) -> UnifiedState:
        """Route to appropriate capability."""
        state["execution_path"].append("route_to_capability")
        return state

    def decide_execution_strategy(self, state: UnifiedState) -> RoutingDecision:
        """Decide execution strategy with RISK-BASED HITL."""

        # =========================================================================
        # Important: Skip HITL routing if resuming from approved request
        # =========================================================================
        if state.get("resuming_from_approval") and state.get("approval_status") == "approved":
            # Get the capability from execution context and route directly to it
            execution_context = state.get("execution_context", {})
            next_capability = execution_context.get("next_capability", "chat")
            return next_capability  # Returns "agent", "workflow", "ml", "rag", or "chat"

        # Check for errors
        if self.enable_error_handling and state.get("errors"):
            return "error"

        # Calculate risk and decide HITL
        if self.enable_hitl and self.hitl_manager:
            risk_score = self._calculate_risk_score(state)
            state["risk_score"] = risk_score

            # Explicit human flag
            if state.get("requires_human", False):
                return "human_review"

            # Risk-based decision for ML operations
            if state.get("orchestration_type") == OrchestrationType.ML_PIPELINE:
                if risk_score > RISK_THRESHOLD_AUTO_APPROVE:
                    return "human_review"

            # Risk-based for agent actions with destructive operations
            if state.get("orchestration_type") == OrchestrationType.AGENT_ROUTING:
                if risk_score > RISK_THRESHOLD_REQUIRE_HUMAN:
                    return "human_review"

        # Check for parallel execution
        if self.enable_parallel:
            capabilities_needed = self._identify_needed_capabilities(state)
            if len(capabilities_needed) > 1:
                return "parallel"

        # Route to capability
        orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)

        routing_map: Dict[OrchestrationType, RoutingDecision] = {
            OrchestrationType.CONVERSATIONAL: "chat",
            OrchestrationType.AGENT_ROUTING: "agent",
            OrchestrationType.WORKFLOW_EXECUTION: "workflow",
            OrchestrationType.ML_PIPELINE: "ml",
            OrchestrationType.RAG_QUERY: "rag"
        }

        return routing_map.get(orchestration_type, "chat")

    def _calculate_risk_score(self, state: UnifiedState) -> float:
        """Calculate risk score for HITL decision."""
        risk = 0.0
        query_lower = state.get("input_data", "").lower()

        # Risk from orchestration type
        type_risk = {
            OrchestrationType.ML_PIPELINE: 0.3,
            OrchestrationType.AGENT_ROUTING: 0.2,
            OrchestrationType.WORKFLOW_EXECUTION: 0.15,
            OrchestrationType.RAG_QUERY: 0.1,
            OrchestrationType.CONVERSATIONAL: 0.05
        }
        risk += type_risk.get(state.get("orchestration_type", OrchestrationType.CONVERSATIONAL), 0.1)

        # Destructive operations
        if any(word in query_lower for word in ["delete", "remove", "cancel", "terminate", "drop"]):
            risk += 0.4

        # Bulk operations
        if any(word in query_lower for word in ["all", "bulk", "batch", "every"]):
            risk += 0.15

        # Financial operations
        if any(word in query_lower for word in ["payment", "transaction", "transfer", "money"]):
            risk += 0.25

        return min(risk, 1.0)

    def _identify_needed_capabilities(self, state: UnifiedState) -> List[str]:
        """Identify needed capabilities."""
        capabilities = []
        input_data = str(state.get("input_data", "")).lower()

        if any(word in input_data for word in ["shop", "order"]):
            capabilities.append("agent")
        if any(word in input_data for word in ["document", "knowledge"]):
            capabilities.append("rag")
        if any(word in input_data for word in ["predict", "analyze"]):
            capabilities.append("ml")

        return capabilities

    # ========================================================================
    # HITL NODES - RISK-BASED HYBRID APPROACH
    # ========================================================================

    async def human_review_node_risk_based(self, state: UnifiedState) -> UnifiedState:
        """
        Request human approval - RISK-BASED MODE (RECOMMENDED)

        This mode automatically decides whether to wait for approval
        based on the operation's risk score:
        - Low risk (< 0.1): Auto-approve immediately
        - Medium risk (0.1 - 0.3): Auto-approve but flag for review
        - High risk (> 0.3): Wait for human approval
        """

        if not self.enable_hitl or not self.hitl_manager:
            # Fallback: auto-approve
            state["approval_status"] = "auto_approved"
            state["auto_approved"] = True
            return state

        state_logger = get_state_logger(state)
        state["execution_path"].append("human_review")

        # Determine approval type
        approval_type = self.hitl_manager._infer_approval_type(state, "human_review")

        # Use risk-based hybrid approach
        status, request = await self.hitl_manager.request_approval_risk_based(
            state=state,
            node_name="human_review",
            approval_type=approval_type,
            timeout_seconds=300
        )

        state_logger.info(f"Risk-based approval result: {status.value}")

        # Handle different outcomes
        if status == ApprovalStatus.AUTO_APPROVED:
            # Low risk - continue immediately
            state["approval_status"] = "auto_approved"
            state["auto_approved"] = True
            state_logger.info("Auto-approved (low risk)")

        elif status == ApprovalStatus.FLAGGED:
            # Medium risk - continue but flag for review
            state["approval_status"] = "flagged"
            state["auto_approved"] = True
            state_logger.info("Flagged for review (medium risk)")

        elif status == ApprovalStatus.PENDING and request:
            # High risk - need to wait for human approval
            state_logger.info(f"Waiting for human approval: {request.request_id}")

            # IMPORTANT: At this point, the workflow will return to the client
            # with status="pending". The client should poll or use WebSocket
            # to check for approval, then call the /resume endpoint.

            if self.hitl_wait_mode == "always_wait":
                # Block and wait for approval (not recommended for web apps)
                approval_status, modifications = await self.hitl_manager.wait_for_approval(
                    request, state
                )

                if approval_status == ApprovalStatus.APPROVED:
                    state["approval_status"] = "approved"
                    if modifications:
                        state["human_modifications"] = modifications
                        state["intermediate_results"].update(modifications)
                elif approval_status == ApprovalStatus.REJECTED:
                    state["approval_status"] = "rejected"
                elif approval_status == ApprovalStatus.TIMEOUT:
                    state["approval_status"] = "timeout"
            else:
                # Return pending status - client should use /resume endpoint
                state["approval_status"] = "pending"
                state["final_output"] = (
                    f"⏳ This operation requires human approval due to high risk "
                    f"(score: {state.get('risk_score', 0):.2f}). "
                    f"Approval request ID: {request.request_id}. "
                    f"Please check the approval queue."
                )

        return state

    async def apply_human_feedback(self, state: UnifiedState) -> UnifiedState:
        """Apply human feedback after approval."""
        state_logger = get_state_logger(state)
        state["execution_path"].append("apply_human_feedback")

        # Apply any modifications
        if state.get("human_modifications"):
            state["intermediate_results"].update(state["human_modifications"])
            state_logger.info(f"Applied human modifications")

        # Get the next capability to execute
        execution_context = state.get("execution_context", {})
        next_capability = execution_context.get("next_capability")

        if next_capability:
            state_logger.info(f"Continuing to {next_capability} after approval")
            # The routing will pick up from intermediate_results

        return state

    # ========================================================================
    # CAPABILITY EXECUTION
    # ========================================================================

    async def execute_agent_system(self, state: UnifiedState) -> UnifiedState:
        """Execute agent system."""
        state["capabilities_used"].append("agent")

        if self.enable_error_handling and self.error_handler:
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.agent_executor.execute,
                tool_name="agent_executor",
                state=state
            )
        else:
            try:
                result_state = await self.agent_executor.execute(state)
            except Exception as e:
                self.logger.error("agent_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["final_output"] = f"Error executing agent: {str(e)}"

        return result_state

    async def execute_workflow(self, state: UnifiedState) -> UnifiedState:
        """Execute workflow system."""
        state["capabilities_used"].append("workflow")

        if self.enable_error_handling and self.error_handler:
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.workflow_executor.execute,
                tool_name="workflow_executor",
                state=state
            )
        else:
            try:
                result_state = await self.workflow_executor.execute(state)
            except Exception as e:
                self.logger.error("workflow_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["final_output"] = f"Error executing workflow: {str(e)}"

        return result_state

    async def execute_ml_pipeline(self, state: UnifiedState) -> UnifiedState:
        """Execute ML pipeline."""
        state["capabilities_used"].append("ml")

        if self.enable_error_handling and self.error_handler:
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.ml_orchestrator.execute,
                tool_name="ml_orchestrator",
                state=state
            )
        else:
            try:
                result_state = await self.ml_orchestrator.execute(state)
            except Exception as e:
                self.logger.error("ml_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["final_output"] = f"Error executing ML: {str(e)}"

        return result_state

    async def execute_rag_query(self, state: UnifiedState) -> UnifiedState:
        """Execute RAG query."""
        state["capabilities_used"].append("rag")

        if self.enable_error_handling and self.error_handler:
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.rag_engine.execute,
                tool_name="rag_engine",
                state=state
            )
        else:
            try:
                result_state = await self.rag_engine.execute(state)
            except Exception as e:
                self.logger.error("rag_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["final_output"] = f"Error executing RAG: {str(e)}"

        return result_state

    async def execute_chat(self, state: UnifiedState) -> UnifiedState:
        """Execute chat."""
        state["capabilities_used"].append("chat")

        if self.enable_error_handling and self.error_handler:
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.chat_manager.execute,
                tool_name="chat_manager",
                state=state
            )
        else:
            try:
                result_state = await self.chat_manager.execute(state)
            except Exception as e:
                self.logger.error("chat_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["final_output"] = f"Error executing chat: {str(e)}"

        return result_state

    # ========================================================================
    # PARALLEL EXECUTION
    # ========================================================================

    async def parallel_coordinator(self, state: UnifiedState) -> UnifiedState:
        """Coordinate parallel execution."""
        if not self.enable_parallel:
            return state

        state_logger = get_state_logger(state)
        state["execution_path"].append("parallel_coordinator")

        capabilities_needed = self._identify_needed_capabilities(state)

        tasks = []
        for cap in capabilities_needed:
            if cap == "agent":
                tasks.append(("agent_system", self.execute_agent_system))
            elif cap == "rag":
                tasks.append(("rag_system", self.execute_rag_query))
            elif cap == "ml":
                tasks.append(("ml_system", self.execute_ml_pipeline))

        results = await self.parallel_manager.execute_parallel_nodes(
            state, tasks, ParallelStrategy.ALL
        )

        state["intermediate_results"]["parallel_execution"] = results
        return state

    async def merge_parallel_results(self, state: UnifiedState) -> UnifiedState:
        """Merge parallel results."""
        state_logger = get_state_logger(state)
        state["execution_path"].append("merge_parallel_results")

        parallel_results = state.get("intermediate_results", {}).get("parallel_execution", {})

        merged = {}
        for node_name, result in parallel_results.items():
            if isinstance(result, dict):
                merged.update(result)

        state["intermediate_results"]["merged_results"] = merged
        return state

    # ========================================================================
    # FINAL NODES
    # ========================================================================

    def synthesize_response(self, state: UnifiedState) -> UnifiedState:
        """Synthesize final response."""
        state_logger = get_state_logger(state)
        state["execution_path"].append("synthesize_response")

        # Handle different approval statuses
        approval_status = state.get("approval_status")

        if approval_status == "rejected":
            state["final_output"] = "❌ Request was rejected by the approver."
        elif approval_status == "timeout":
            state["final_output"] = "⏰ Approval request timed out."
        elif not state.get("final_output"):
            state["final_output"] = "Request processed successfully."

        # Add message to conversation
        if state.get("final_output"):
            ai_message = {
                "role": "assistant",
                "content": state["final_output"],
                "timestamp": datetime.now().isoformat(),
                "approval_status": approval_status,
                "risk_score": state.get("risk_score", 0)
            }

            if "messages" not in state:
                state["messages"] = []
            state["messages"].append(ai_message)

        return state

    def update_memory(self, state: UnifiedState) -> UnifiedState:
        """Update memory and finalize."""
        state_logger = get_state_logger(state)
        state["execution_path"].append("update_memory")

        # Calculate metrics
        if state.get("metrics", {}).get("start_time"):
            start = datetime.fromisoformat(state["metrics"]["start_time"])
            duration = (datetime.now() - start).total_seconds() * 1000
            state["metrics"]["duration_ms"] = duration
            state["metrics"]["end_time"] = datetime.now().isoformat()

        state["metrics"]["execution_path_length"] = len(state.get("execution_path", []))
        state["metrics"]["capabilities_used"] = state.get("capabilities_used", [])

        return state

    # ========================================================================
    # PUBLIC API
    # ========================================================================

    async def invoke(self, state: UnifiedState) -> UnifiedState:
        """Invoke the orchestration graph."""
        config = {"configurable": {"thread_id": state.get("session_id", str(uuid.uuid4()))}}
        return await self.graph.ainvoke(state, config)

    async def astream(self, state: UnifiedState):
        """Stream orchestration results."""
        config = {"configurable": {"thread_id": state.get("session_id", str(uuid.uuid4()))}}
        async for chunk in self.graph.astream(state, config):
            yield chunk

    async def cleanup(self):
        """Cleanup resources."""
        if self.hitl_manager:
            await self.hitl_manager.stop()
        self.logger.info("orchestrator_cleanup_complete")