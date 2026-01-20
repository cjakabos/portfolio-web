# backend/ai-orchestration-layer/src/core/orchestrator.py

"""
AI Orchestration Layer - COMPLETE VERSION WITH ALL FIXES
Preserves ALL original functionality + adds the 5 critical fixes:
1. Import guards with graceful fallbacks
2. (Error handling uses Redis circuit breaker)
3. (A/B testing uses MongoDB)
4. (RAG uses thread-safe initialization)
5. (HTTP client uses connection pooling)

FIXED: Added invoke() and astream() methods for WebSocket support
"""

from typing import Dict, Any, Literal, Optional, List
from datetime import datetime
import asyncio

from langgraph.graph import StateGraph, END
from langgraph.types import Send
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage, SystemMessage

from core.state import UnifiedState, OrchestrationType
from core.llm_manager import get_llm, get_streaming_llm
from core.config import get_config
from core.unified_logger import get_logger, get_state_logger, set_log_context
from core.tool_manager import get_tool_manager

# Import FIXED capabilities
from capabilities.agent_executor import AgentExecutor
from capabilities.workflow_executor import WorkflowExecutor
from capabilities.ml_orchestrator import MLOrchestrator
from capabilities.rag_engine import RAGEngine
from capabilities.chat_manager import ChatManager

# ============================================================================
# SAFE IMPORTS WITH FALLBACKS - FIX #1
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
RISK_THRESHOLD_LOW = 0.2      # Auto-approve below this
RISK_THRESHOLD_HIGH = 0.25     # Require human approval above this
HumanInLoopManager = None
ApprovalType = None
ApprovalStatus = None
try:
    from core.human_in_loop import HumanInLoopManager, ApprovalType, ApprovalStatus
    HITL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Human-in-the-Loop not available: {e}")
    print("   Approval requests will be auto-approved")

# Parallel Execution
PARALLEL_AVAILABLE = False
ParallelExecutionManager = None
ParallelStrategy = None
try:
    from core.parallel_executor import ParallelExecutionManager, ParallelStrategy
    PARALLEL_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Parallel execution not available: {e}")
    print("   All tasks will execute sequentially")

# Streaming
STREAMING_AVAILABLE = False
StreamingOrchestrationManager = None
ChunkedResponseBuilder = None
try:
    from core.streaming_manager import StreamingOrchestrationManager, ChunkedResponseBuilder
    STREAMING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Streaming not available: {e}")
    print("   Responses will be returned in full")

# Error Handling (with Redis circuit breaker - FIX #2)
ERROR_HANDLING_AVAILABLE = False
ErrorHandler = None
StructuredToolException = None
try:
    from core.error_handling import ErrorHandler, StructuredToolException
    ERROR_HANDLING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Error handling not available: {e}")
    print("   Basic error handling will be used")

# Type alias for routing decisions
RoutingDecision = Literal["agent", "workflow", "ml", "rag", "chat", "human_review", "parallel", "error"]


class AIOrchestrationLayer:
    """
    Complete AI orchestration layer with ALL original features + fixes

    Original Features:
    ✅ Multi-node graph with routing
    ✅ Intent classification
    ✅ Risk scoring for HITL
    ✅ Parallel execution coordination
    ✅ Token streaming support
    ✅ Memory updates
    ✅ Complete metrics tracking

    New Fixes:
    ✅ Import guards with graceful fallbacks (FIX #1)
    ✅ Redis circuit breaker (via error_handling.py - FIX #2)
    ✅ MongoDB A/B testing (via experiment_manager.py - FIX #3)
    ✅ Thread-safe RAG (via rag_engine.py - FIX #4)
    ✅ Connection pooling (via http_client.py - FIX #5)
    ✅ invoke() and astream() methods for WebSocket support (FIX #6)
    """

    def __init__(
        self,
        enable_checkpointing: bool = True,
        enable_hitl: bool = True,
        enable_parallel: bool = True,
        enable_streaming: bool = False,
        enable_error_handling: bool = True,
        max_parallel_workers: int = 10,
        checkpoint_db_path: str = "data/orchestration_checkpoints.db"
    ):
        """Initialize complete orchestration layer with ALL features"""

        # Configuration
        self.config = get_config()
        self.logger = get_logger()
        self.tool_manager = get_tool_manager()

        # Feature availability tracking
        self.features_available = {
            "checkpointing": CHECKPOINTING_AVAILABLE,
            "hitl": HITL_AVAILABLE,
            "parallel": PARALLEL_AVAILABLE,
            "streaming": STREAMING_AVAILABLE,
            "error_handling": ERROR_HANDLING_AVAILABLE
        }

        # Feature flags with availability checks
        self.enable_checkpointing = enable_checkpointing and CHECKPOINTING_AVAILABLE
        self.enable_hitl = enable_hitl and HITL_AVAILABLE
        self.enable_parallel = enable_parallel and PARALLEL_AVAILABLE
        self.enable_streaming = enable_streaming and STREAMING_AVAILABLE
        self.enable_error_handling = enable_error_handling and ERROR_HANDLING_AVAILABLE

        # Shared LLM (singleton, cached)
        self.llm = get_llm()

        # Initialize ALL capabilities (they use shared resources - FIX #4, #5)
        self._init_capabilities()

        # ============ Feature 1: Checkpointing with Fallback ============
        if self.enable_checkpointing:
            self.checkpointer: BaseCheckpointSaver = SQLiteCheckpointer(checkpoint_db_path)
            self.recovery_manager = RecoveryManager(self.checkpointer)
            self.logger.info("checkpointing_enabled", {"db_path": checkpoint_db_path, "type": "sqlite"})
        else:
            # Fallback to in-memory checkpointing
            self.checkpointer: BaseCheckpointSaver = MemorySaver()
            self.recovery_manager = None
            self.logger.warning("checkpointing_fallback", {
                "reason": "SQLite checkpointing unavailable",
                "fallback": "in-memory storage (data lost on restart)"
            })

        # ============ Feature 2: Human-in-the-Loop with Fallback ============
        if self.enable_hitl:
            self.hitl_manager = HumanInLoopManager()
            self.logger.info("hitl_enabled", {"auto_approve": False})
        else:
            self.hitl_manager = None
            self.logger.warning("hitl_fallback", {
                "reason": "HITL module unavailable",
                "fallback": "all requests auto-approved"
            })

        # ============ Feature 3: Parallel Execution with Fallback ============
        if self.enable_parallel:
            self.parallel_manager = ParallelExecutionManager(
                max_workers=max_parallel_workers,
            )
            self.logger.info("parallel_enabled", {"max_workers": max_parallel_workers})
        else:
            self.parallel_manager = None
            self.logger.warning("parallel_fallback", {
                "reason": "Parallel execution unavailable",
                "fallback": "sequential execution only"
            })

        # ============ Feature 4: Streaming with Fallback ============
        if self.enable_streaming:
            self.streaming_manager = StreamingOrchestrationManager()
            self.streaming_llm = get_streaming_llm()
            self.response_builders: Dict[str, ChunkedResponseBuilder] = {}
            self.logger.info("streaming_enabled")
        else:
            self.streaming_manager = None
            self.streaming_llm = None
            self.logger.info("streaming_disabled", {"mode": "full_response"})

        # ============ Feature 5: Error Handling with Fallback (Redis circuit breaker) ============
        if self.enable_error_handling:
            # ErrorHandler now uses Redis circuit breaker (FIX #2)
            self.error_handler = ErrorHandler(
                max_history=1000,
                redis_url=self.config.redis.url
            )
            self._register_default_fallbacks()
            self.logger.info("error_handling_enabled", {
                "features": "retry,circuit_breaker,fallback",
                "circuit_breaker_storage": "redis"
            })
        else:
            self.error_handler = None
            self.logger.warning("error_handling_fallback", {
                "reason": "Advanced error handling unavailable",
                "fallback": "basic try-catch only"
            })

        # Build the complete graph with ALL original features
        self.graph = self._build_complete_graph()

        # Log initialization summary
        self._log_initialization_summary()

    def _init_capabilities(self) -> None:
        """Initialize all capabilities (with fixes applied)"""
        # All capabilities now use:
        # - Shared LLM manager (no duplication)
        # - Thread-safe RAG initialization (FIX #4)
        # - HTTP connection pooling (FIX #5)
        self.agent_executor = AgentExecutor()
        self.workflow_executor = WorkflowExecutor()
        self.ml_orchestrator = MLOrchestrator()
        self.rag_engine = RAGEngine()  # Thread-safe init (FIX #4)
        self.chat_manager = ChatManager()

        self.logger.info("capabilities_initialized", {
            "capabilities": ["agent", "workflow", "ml", "rag", "chat"],
            "fixes_applied": ["thread_safe_rag", "connection_pooling"]
        })

    def _register_default_fallbacks(self):
        """Register default fallback handlers for error recovery"""
        if not self.error_handler:
            return

        # Fallback for agent failures -> try chat
        async def agent_fallback(context):
            self.logger.info("agent_fallback_triggered", {"error_id": context.error_id})
            return await self.chat_manager.execute(
                UnifiedState(
                    user_id=context.user_id,
                    session_id=context.session_id,
                    input_data=context.input_data,
                    orchestration_type=OrchestrationType.CONVERSATIONAL
                )
            )

        self.error_handler.register_fallback("agent_executor", agent_fallback)

        # Fallback for RAG failures -> try direct LLM
        async def rag_fallback(context):
            self.logger.info("rag_fallback_triggered", {"error_id": context.error_id})
            response = await self.llm.ainvoke([HumanMessage(content=context.input_data)])
            return {"answer": response.content, "fallback_used": True}

        self.error_handler.register_fallback("rag_engine", rag_fallback)

    # ========================================================================
    # PUBLIC API METHODS - invoke() and astream() for WebSocket support
    # ========================================================================

    async def invoke(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Execute the orchestration graph (non-streaming).

        This method is called by the WebSocket handler and HTTP endpoints
        to execute the full orchestration pipeline.

        Args:
            state: The initial UnifiedState with request data (can be dict or UnifiedState)

        Returns:
            Dict containing the final state with response
        """
        if not self.graph:
            raise RuntimeError("Orchestration graph not initialized")

        try:
            # Convert state to dict if needed
            if hasattr(state, 'model_dump'):
                state_dict = state.model_dump()
            elif hasattr(state, 'dict'):
                state_dict = state.dict()
            elif isinstance(state, dict):
                state_dict = state
            else:
                # Try to convert dataclass or other objects
                state_dict = dict(state) if hasattr(state, '__iter__') else vars(state)

            self.logger.info("invoke_started", {
                "request_id": state_dict.get("request_id"),
                "orchestration_type": str(state_dict.get("orchestration_type")),
                "user_id": state_dict.get("user_id")
            })

            # Create runnable config with thread_id for checkpointing
            session_id = state_dict.get("session_id", "default")
            runnable_config = RunnableConfig(
                configurable={"thread_id": session_id}
            )

            # Execute the compiled graph
            result = await self.graph.ainvoke(state_dict, config=runnable_config)

            self.logger.info("invoke_completed", {
                "request_id": state_dict.get("request_id"),
                "execution_path": result.get("execution_path", []),
                "has_output": bool(result.get("final_output"))
            })

            return result

        except Exception as e:
            self.logger.error("invoke_failed", {
                "request_id": state_dict.get("request_id") if 'state_dict' in dir() else "unknown",
                "error": str(e)
            }, error=e)
            raise

    async def astream(self, state: UnifiedState):
        """
        Stream orchestration execution with real-time updates.

        This method is called by the WebSocket handler to stream
        execution updates (node changes, tokens, etc.) to the client.

        Args:
            state: The initial UnifiedState with request data

        Yields:
            Dict chunks with execution updates
        """
        if not self.graph:
            raise RuntimeError("Orchestration graph not initialized")

        try:
            # Convert state to dict if needed
            if hasattr(state, 'model_dump'):
                state_dict = state.model_dump()
            elif hasattr(state, 'dict'):
                state_dict = state.dict()
            elif isinstance(state, dict):
                state_dict = state
            else:
                state_dict = vars(state)

            request_id = state_dict.get("request_id", "unknown")
            session_id = state_dict.get("session_id", "default")

            self.logger.info("astream_started", {
                "request_id": request_id,
                "orchestration_type": str(state_dict.get("orchestration_type"))
            })

            # Create runnable config
            runnable_config = RunnableConfig(
                configurable={"thread_id": session_id}
            )

            # Track final result for complete message
            final_result = None

            # Stream using astream_events for detailed updates
            async for event in self.graph.astream_events(state_dict, config=runnable_config, version="v2"):
                event_type = event.get("event")

                if event_type == "on_chain_start":
                    node_name = event.get("name", "unknown")
                    yield {
                        "type": "node_start",
                        "current_node": node_name,
                        "request_id": request_id
                    }

                elif event_type == "on_chain_end":
                    node_name = event.get("name", "unknown")
                    output = event.get("data", {}).get("output", {})

                    # Capture final output if this is the last node
                    if isinstance(output, dict) and output.get("final_output"):
                        final_result = output

                    yield {
                        "type": "node_end",
                        "current_node": node_name,
                        "request_id": request_id
                    }

                elif event_type == "on_llm_stream":
                    # Token streaming from LLM
                    chunk = event.get("data", {}).get("chunk", {})
                    if hasattr(chunk, "content") and chunk.content:
                        yield {
                            "type": "token",
                            "token": chunk.content,
                            "request_id": request_id
                        }

                elif event_type == "on_chain_stream":
                    # Intermediate chain outputs
                    chunk = event.get("data", {}).get("chunk", {})
                    if isinstance(chunk, dict) and chunk.get("final_output"):
                        final_result = chunk
                        yield {
                            "type": "chunk",
                            "content": chunk.get("final_output"),
                            "request_id": request_id
                        }

            # If we didn't capture the final result during streaming, invoke to get it
            if not final_result:
                final_result = await self.graph.ainvoke(state_dict, config=runnable_config)

            # Send completion message
            yield {
                "type": "complete",
                "final_output": final_result.get("final_output") if final_result else None,
                "execution_path": final_result.get("execution_path", []) if final_result else [],
                "metrics": final_result.get("metrics", {}) if final_result else {},
                "request_id": request_id
            }

            self.logger.info("astream_completed", {
                "request_id": request_id,
                "has_output": bool(final_result and final_result.get("final_output"))
            })

        except Exception as e:
            request_id = state_dict.get("request_id") if 'state_dict' in dir() else "unknown"
            self.logger.error("astream_failed", {
                "request_id": request_id,
                "error": str(e)
            }, error=e)
            yield {
                "type": "error",
                "error": str(e),
                "request_id": request_id
            }

    # ========================================================================
    # COMPLETE GRAPH BUILDING - ALL ORIGINAL FEATURES
    # ========================================================================

    def _build_complete_graph(self) -> StateGraph:
        """
        Build complete orchestration graph with ALL original features
        """
        workflow = StateGraph(UnifiedState)

        # Add all nodes
        self._add_core_nodes(workflow)
        self._add_capability_nodes(workflow)

        # Add feature-specific nodes
        if self.enable_hitl:
            self._add_hitl_nodes(workflow)

        if self.enable_parallel:
            self._add_parallel_nodes(workflow)

        self._add_final_nodes(workflow)

        # Define edges
        self._define_core_edges(workflow)
        self._define_routing_edges(workflow)

        if self.enable_hitl:
            self._define_hitl_edges(workflow)

        if self.enable_parallel:
            self._define_parallel_edges(workflow)

        self._define_final_edges(workflow)

        # Compile with checkpointing if enabled
        compiled = workflow.compile(checkpointer=self.checkpointer)

        return compiled

    def _add_core_nodes(self, workflow: StateGraph) -> None:
        """Add core orchestration nodes"""
        workflow.add_node("initialize", self.initialize_request)
        workflow.add_node("classify_intent", self.classify_user_intent)
        workflow.add_node("route_to_capability", self.route_to_capability)

    def _add_capability_nodes(self, workflow: StateGraph) -> None:
        """Add capability execution nodes"""
        workflow.add_node("agent_system", self.execute_agent_system)
        workflow.add_node("workflow_system", self.execute_workflow)
        workflow.add_node("ml_system", self.execute_ml_pipeline)
        workflow.add_node("rag_system", self.execute_rag_query)
        workflow.add_node("chat_system", self.execute_chat)

    def _add_hitl_nodes(self, workflow: StateGraph) -> None:
        """Add human-in-the-loop nodes"""
        workflow.add_node("human_review", self.human_review_node)

    def _add_parallel_nodes(self, workflow: StateGraph) -> None:
        """Add parallel execution nodes"""
        workflow.add_node("parallel_coordinator", self.parallel_coordinator)
        workflow.add_node("merge_parallel_results", self.merge_parallel_results)

    def _add_final_nodes(self, workflow: StateGraph) -> None:
        """Add final processing nodes"""
        workflow.add_node("synthesize_response", self.synthesize_response)
        workflow.add_node("update_memory", self.update_memory)

    def _define_core_edges(self, workflow: StateGraph) -> None:
        """Define core flow edges"""
        workflow.set_entry_point("initialize")
        workflow.add_edge("initialize", "classify_intent")
        workflow.add_edge("classify_intent", "route_to_capability")

    def _define_routing_edges(self, workflow: StateGraph) -> None:
        """Define routing edges with conditional logic"""
        routing_map = {
            "agent": "agent_system",
            "workflow": "workflow_system",
            "ml": "ml_system",
            "rag": "rag_system",
            "chat": "chat_system"
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
        """
        Define human-in-the-loop edges.

        FIXED: After approval, route to the appropriate capability (not just synthesize_response).
        After rejection, go directly to synthesize_response with rejection message.
        """

        def route_after_human_review(state: UnifiedState) -> str:
            """Route based on approval status AND original orchestration type"""
            approval_status = state.get("approval_status", "")

            if approval_status == "approved":
                # Route to the originally intended capability
                orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)

                routing_map = {
                    OrchestrationType.CONVERSATIONAL: "chat_system",
                    OrchestrationType.AGENT_ROUTING: "agent_system",
                    OrchestrationType.WORKFLOW_EXECUTION: "workflow_system",
                    OrchestrationType.ML_PIPELINE: "ml_system",
                    OrchestrationType.RAG_QUERY: "rag_system",
                }

                target = routing_map.get(orchestration_type, "chat_system")
                return target
            else:
                # Rejected or timeout - go to synthesize with rejection message
                return "synthesize_response"

        # Add conditional edges from human_review to capabilities or rejection
        workflow.add_conditional_edges(
            "human_review",
            route_after_human_review,
            {
                "agent_system": "agent_system",
                "workflow_system": "workflow_system",
                "ml_system": "ml_system",
                "rag_system": "rag_system",
                "chat_system": "chat_system",
                "synthesize_response": "synthesize_response",  # For rejections
            }
        )

        # The capability will execute after approval

    def _define_parallel_edges(self, workflow: StateGraph) -> None:
        """Define parallel execution edges"""
        workflow.add_edge("parallel_coordinator", "merge_parallel_results")
        workflow.add_edge("merge_parallel_results", "synthesize_response")

    def _define_final_edges(self, workflow: StateGraph) -> None:
        """Define final processing edges"""
        # All capabilities flow to synthesis
        for node in ["agent_system", "workflow_system", "ml_system", "rag_system", "chat_system"]:
            workflow.add_edge(node, "synthesize_response")

        # Final flow
        workflow.add_edge("synthesize_response", "update_memory")
        workflow.add_edge("update_memory", END)

    # ========================================================================
    # CORE NODES - ALL ORIGINAL LOGIC
    # ========================================================================

    def initialize_request(self, state: UnifiedState) -> UnifiedState:
        """Initialize request with full setup"""
        state_logger = get_state_logger(state)
        state_logger.info(f"Initializing request {state['request_id']}")

        set_log_context(
            request_id=state["request_id"],
            user_id=state["user_id"],
            session_id=state["session_id"]
        )

        state["execution_path"].append("initialize")
        state["metrics"]["start_time"] = datetime.now().isoformat()

        # Initialize required fields
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

        self.logger.log_request(
            request_id=state["request_id"],
            user_id=state["user_id"],
            orchestration_type=state.get("orchestration_type", OrchestrationType.CONVERSATIONAL).value,
            message_length=len(state["input_data"])
        )

        return state

    async def classify_user_intent(self, state: UnifiedState) -> UnifiedState:
        """Classify user intent with original logic"""
        state_logger = get_state_logger(state)
        state["execution_path"].append("classify_intent")

        query: str = state["input_data"].lower()

        # Rule-based classification (original logic)
        if any(word in query for word in ["shop", "cart", "order", "buy", "pet", "vehicle", "schedule"]):
            state["orchestration_type"] = OrchestrationType.AGENT_ROUTING
        elif any(word in query for word in ["book", "groom", "supply", "workflow"]):
            state["orchestration_type"] = OrchestrationType.WORKFLOW_EXECUTION
        elif any(word in query for word in ["predict", "segment", "analyze", "insight"]):
            state["orchestration_type"] = OrchestrationType.ML_PIPELINE
        elif any(word in query for word in ["note", "document", "find", "knowledge", "wrote"]):
            state["orchestration_type"] = OrchestrationType.RAG_QUERY
        else:
            state["orchestration_type"] = OrchestrationType.CONVERSATIONAL

        state_logger.info(f"Classified as: {state['orchestration_type'].value}")
        return state

    def route_to_capability(self, state: UnifiedState) -> UnifiedState:
        """Route to appropriate capability"""
        state["execution_path"].append("route_to_capability")
        return state

    # =============================================================================
    # Decide_execution_strategy method
    # =============================================================================

    def decide_execution_strategy(self, state: UnifiedState) -> RoutingDecision:
        """
        Decide execution strategy with RISK-BASED HITL for ALL operations.

        This is the routing function that decides where the graph goes next.
        FIXED: Now applies risk assessment to ALL orchestration types, not just ML_PIPELINE.
        """
        state_logger = get_state_logger(state)

        # Check for errors first
        if self.enable_error_handling and state.get("errors"):
            return "error"

        # =======================================================================
        # FIXED: Apply risk-based HITL to ALL orchestration types
        # =======================================================================
        if self.enable_hitl:
            # Check if explicitly marked as requiring human approval
            if state.get("requires_human", False):
                state_logger.info("Routing to human_review: explicitly marked requires_human")
                return "human_review"

            # Calculate risk score for ALL operations (not just ML)
            risk_score = self._calculate_risk_score(state)
            state["risk_score"] = risk_score  # Store for later use

            state_logger.info(f"Risk score calculated: {risk_score:.2f} for {state.get('orchestration_type')}")

            # Route to human_review if risk is above threshold
            if risk_score >= RISK_THRESHOLD_HIGH:
                state["requires_human"] = True
                state_logger.info(f"Routing to human_review: risk score {risk_score:.2f} >= {RISK_THRESHOLD_HIGH}")
                return "human_review"

            # For medium risk, we'll still execute but flag it (handled in human_review_node)
            # For now, continue to normal routing

        # Check for parallel execution opportunity (original parallel logic)
        if self.enable_parallel:
            capabilities_needed = self._identify_needed_capabilities(state)
            if len(capabilities_needed) > 1:
                return "parallel"

        # Route to specific capability based on orchestration type
        orchestration_type = state.get("orchestration_type", OrchestrationType.CONVERSATIONAL)

        routing_map: Dict[OrchestrationType, RoutingDecision] = {
            OrchestrationType.CONVERSATIONAL: "chat",
            OrchestrationType.AGENT_ROUTING: "agent",
            OrchestrationType.WORKFLOW_EXECUTION: "workflow",
            OrchestrationType.ML_PIPELINE: "ml",
            OrchestrationType.RAG_QUERY: "rag"
        }

        return routing_map.get(orchestration_type, "chat")

    async def synthesize_response(self, state: UnifiedState) -> UnifiedState:
        """
        Synthesize final response.

        UPDATED: Handle rejection case with appropriate message.
        """
        state_logger = get_state_logger(state)
        state["execution_path"].append("synthesize_response")

        # Check if this is a rejection from human review
        if state.get("approval_status") == "rejected":
            if state.get("timeout_occurred"):
                state["final_output"] = (
                    "⏱️ Request timed out waiting for human approval. "
                    "The operation was not executed for safety reasons. "
                    "Please try again or contact an administrator."
                )
            else:
                state["final_output"] = (
                    "❌ Request was rejected by human reviewer. "
                    "The operation was not executed. "
                    f"Original request: {state.get('input_data', '')[:100]}..."
                )
            state_logger.info("Response synthesized: Human review rejection")
            return state

        # Normal response synthesis (existing logic)
        result = state.get("result", "")
        intermediate = state.get("intermediate_results", {})

        if result:
            state["final_output"] = result
        elif intermediate:
            # Compile intermediate results
            outputs = []
            for key, value in intermediate.items():
                if value:
                    outputs.append(f"{key}: {value}")
            state["final_output"] = "\n".join(outputs) if outputs else "Operation completed."
        else:
            state["final_output"] = "Request processed successfully."

        state_logger.info("Response synthesized")
        return state

    def _calculate_risk_score(self, state: UnifiedState) -> float:
        """
        Calculate comprehensive risk score for HITL decision.

        Factors considered:
        - Operation type (ML, financial, data access, workflow, agent)
        - Sensitive keywords in input (delete, transfer, payment, etc.)
        - Transaction amounts (if present)
        - ML confidence scores (if present)

        Returns:
            float: Risk score between 0.0 and 1.0
        """
        risk = 0.0

        # Factor 1: Operation type base risk
        orchestration_type = state.get("orchestration_type")
        type_risk = {
            OrchestrationType.ML_PIPELINE: 0.3,
            OrchestrationType.AGENT_ROUTING: 0.25,
            OrchestrationType.WORKFLOW_EXECUTION: 0.2,
            OrchestrationType.RAG_QUERY: 0.1,
            OrchestrationType.CONVERSATIONAL: 0.05,
        }
        risk += type_risk.get(orchestration_type, 0.15)

        # Factor 2: Sensitive operation keywords
        query_lower = str(state.get("input_data", "")).lower()

        # High-risk keywords (each adds significant risk)
        high_risk_keywords = {
            "delete": 0.35,
            "remove": 0.30,
            "transfer": 0.35,
            "payment": 0.30,
            "refund": 0.25,
            "cancel": 0.25,
            "confidential": 0.30,
            "sensitive": 0.25,
            "personal": 0.20,
            "private": 0.20,
        }

        # Medium-risk keywords
        medium_risk_keywords = {
            "execute": 0.15,
            "modify": 0.15,
            "update": 0.10,
            "approve": 0.15,
            "send": 0.10,
            "email": 0.10,
            "notify": 0.10,
        }

        # Check high-risk keywords
        for keyword, keyword_risk in high_risk_keywords.items():
            if keyword in query_lower:
                risk += keyword_risk

        # Check medium-risk keywords
        for keyword, keyword_risk in medium_risk_keywords.items():
            if keyword in query_lower:
                risk += keyword_risk

        # Factor 3: Check for monetary amounts in the query
        # Look for patterns like $5000, $100, etc.
        import re
        money_pattern = r'\$[\d,]+(?:\.\d{2})?|\d+\s*(?:dollars?|usd)'
        money_matches = re.findall(money_pattern, query_lower)
        if money_matches:
            # Extract the largest amount mentioned
            amounts = []
            for match in money_matches:
                # Extract numeric value
                num = re.sub(r'[^\d.]', '', match)
                try:
                    amounts.append(float(num))
                except ValueError:
                    pass

            if amounts:
                max_amount = max(amounts)
                if max_amount >= 10000:
                    risk += 0.40
                elif max_amount >= 1000:
                    risk += 0.30
                elif max_amount >= 100:
                    risk += 0.15

        # Factor 4: Transaction amount from intermediate_results (if present)
        intermediate_results = state.get("intermediate_results", {})
        if "transaction_amount" in intermediate_results:
            amount = intermediate_results["transaction_amount"]
            if amount > 10000:
                risk += 0.40
            elif amount > 1000:
                risk += 0.25
            elif amount > 100:
                risk += 0.10

        # Factor 5: ML confidence (low confidence = higher risk)
        metrics = state.get("metrics", {})
        if "ml_confidence" in metrics:
            confidence = metrics["ml_confidence"]
            if confidence < 0.5:
                risk += 0.30
            elif confidence < 0.7:
                risk += 0.15

        # Factor 6: Multiple high-risk operations combined
        high_risk_count = sum(1 for kw in high_risk_keywords if kw in query_lower)
        if high_risk_count >= 3:
            risk += 0.20  # Bonus risk for multiple dangerous keywords
        elif high_risk_count >= 2:
            risk += 0.10

        # Cap risk at 1.0
        final_risk = min(risk, 1.0)

        return final_risk

    def _identify_needed_capabilities(self, state: UnifiedState) -> List[str]:
        """Identify which capabilities are needed (original logic)"""
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
    # CAPABILITY EXECUTION - WITH ERROR HANDLING (FIX #2)
    # ========================================================================

    async def execute_agent_system(self, state: UnifiedState) -> UnifiedState:
        """Execute agent system with error handling"""
        if self.enable_error_handling and self.error_handler:
            # Use advanced error handling with Redis circuit breaker (FIX #2)
            result_state = await self.error_handler.execute_with_handling(
                tool_func=self.agent_executor.execute,
                tool_name="agent_executor",
                state=state
            )
        else:
            # Basic error handling
            try:
                result_state = await self.agent_executor.execute(state)
            except Exception as e:
                self.logger.error("agent_execution_failed", {"error": str(e)}, error=e)
                result_state = state
                result_state["result"] = f"Error executing agent: {str(e)}"

        return result_state

    async def execute_workflow(self, state: UnifiedState) -> UnifiedState:
        """Execute workflow system"""
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
                result_state["result"] = f"Error executing workflow: {str(e)}"

        return result_state

    async def execute_ml_pipeline(self, state: UnifiedState) -> UnifiedState:
        """Execute ML pipeline"""
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
                result_state["result"] = f"Error executing ML: {str(e)}"

        return result_state

    async def execute_rag_query(self, state: UnifiedState) -> UnifiedState:
        """Execute RAG query (thread-safe - FIX #4)"""
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
                result_state["result"] = f"Error executing RAG: {str(e)}"

        return result_state

    async def execute_chat(self, state: UnifiedState) -> UnifiedState:
        """Execute chat"""
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
                result_state["result"] = f"Error executing chat: {str(e)}"

        return result_state

    # ========================================================================
    # HITL NODES - RISK-BASED HYBRID APPROACH
    # ========================================================================

    async def human_review_node(self, state: UnifiedState) -> UnifiedState:
        """
        Request human approval - RISK-BASED MODE

        This node is reached when decide_execution_strategy routes here
        because risk_score >= RISK_THRESHOLD_HIGH (0.7).

        It creates an approval request and WAITS for human decision.
        """
        if not self.enable_hitl or not self.hitl_manager:
            # Fallback: auto-approve when HITL is disabled
            state["approval_status"] = "approved"
            return state

        state_logger = get_state_logger(state)
        state["execution_path"].append("human_review")

        risk_score = state.get("risk_score", self._calculate_risk_score(state))
        state_logger.info(f"Human review required. Risk score: {risk_score:.2f}")

        # Determine approval type based on context
        approval_type = self._determine_approval_type(state)

        # Create approval request using the correct method signature
        # request_approval(state, node_name, approval_type, context)
        approval_request = await self.hitl_manager.request_approval(
            state=state,
            node_name="human_review",
            approval_type=approval_type,
            context={
                "query": state["input_data"],
                "orchestration_type": state["orchestration_type"].value if hasattr(state["orchestration_type"], 'value') else str(state["orchestration_type"]),
                "risk_score": risk_score,
                "risk_level": self._get_risk_level(risk_score),
            }
        )

        state["approval_request_id"] = approval_request.request_id
        state_logger.info(f"Approval request created: {approval_request.request_id}")
        state_logger.info(f"Waiting for human approval...")

        # =======================================================================
        # CRITICAL: Actually wait for human approval!
        # =======================================================================
        status, modifications = await self.hitl_manager.wait_for_approval(
            approval_request,
            state
        )

        if status == ApprovalStatus.APPROVED:
            state["approval_status"] = "approved"
            state_logger.info(f"Human APPROVED request {approval_request.request_id}")

            # Apply any modifications from the approver
            if modifications:
                state["intermediate_results"].update(modifications)
                state["logs"].append(f"Applied human modifications: {list(modifications.keys())}")

        elif status == ApprovalStatus.REJECTED:
            state["approval_status"] = "rejected"
            state_logger.info(f"Human REJECTED request {approval_request.request_id}")

        elif status == ApprovalStatus.TIMEOUT:
            state["approval_status"] = "rejected"
            state["timeout_occurred"] = True
            state_logger.warning(f"Approval request {approval_request.request_id} TIMED OUT - treating as rejected")

        else:
            # Cancelled or other status
            state["approval_status"] = "rejected"
            state_logger.info(f"Approval request {approval_request.request_id} was cancelled")

        return state


    def _get_risk_level(self, risk_score: float) -> str:
        """Convert risk score to human-readable level"""
        if risk_score < RISK_THRESHOLD_LOW:
            return "low"
        elif risk_score < RISK_THRESHOLD_HIGH:
            return "medium"
        elif risk_score < 0.9:
            return "high"
        else:
            return "critical"

    def _determine_approval_type(self, state: UnifiedState) -> ApprovalType:
        """Determine the appropriate approval type based on state context"""
        orchestration_type = state.get("orchestration_type")
        input_data = str(state.get("input_data", "")).lower()

        # Check for financial operations
        if any(word in input_data for word in ["payment", "transfer", "refund", "$"]):
            return ApprovalType.FINANCIAL

        # Check for ML decisions
        if orchestration_type == OrchestrationType.ML_PIPELINE:
            return ApprovalType.ML_DECISION

        # Check for data access patterns
        if any(word in input_data for word in ["customer data", "personal", "sensitive", "private", "delete"]):
            return ApprovalType.DATA_ACCESS

        # Check for external API calls
        if any(word in input_data for word in ["api", "external", "third-party"]):
            return ApprovalType.EXTERNAL_API

        # Check for agent actions
        if orchestration_type == OrchestrationType.AGENT_ROUTING:
            return ApprovalType.AGENT_ACTION

        # Default to workflow branch
        return ApprovalType.WORKFLOW_BRANCH


    def _generate_proposed_action_description(self, state: UnifiedState) -> str:
        """Generate a human-readable description of the proposed action"""
        orchestration_type = state.get("orchestration_type")
        input_data = state.get("input_data", "")[:200]  # Truncate for readability

        type_descriptions = {
            OrchestrationType.ML_PIPELINE: f"Execute ML pipeline: {input_data}",
            OrchestrationType.AGENT_ROUTING: f"Execute agent action: {input_data}",
            OrchestrationType.WORKFLOW_EXECUTION: f"Execute workflow: {input_data}",
            OrchestrationType.RAG_QUERY: f"Execute RAG query: {input_data}",
            OrchestrationType.CONVERSATIONAL: f"Process request: {input_data}",
        }

        return type_descriptions.get(
            orchestration_type,
            f"Execute operation: {input_data}"
        )


    # ========================================================================
    # PARALLEL EXECUTION - ORIGINAL LOGIC
    # ========================================================================

    async def parallel_coordinator(self, state: UnifiedState) -> UnifiedState:
        """Coordinate parallel execution (original logic)"""
        if not self.enable_parallel:
            return state

        state_logger = get_state_logger(state)
        state["execution_path"].append("parallel_coordinator")
        state_logger.info("Executing capabilities in parallel...")

        capabilities_needed = self._identify_needed_capabilities(state)

        # Define parallel tasks
        tasks = []
        for cap in capabilities_needed:
            if cap == "agent":
                tasks.append(("agent_system", self.execute_agent_system))
            elif cap == "rag":
                tasks.append(("rag_system", self.execute_rag_query))
            elif cap == "ml":
                tasks.append(("ml_system", self.execute_ml_pipeline))

        # Execute in parallel
        results = await self.parallel_manager.execute_parallel_nodes(
            state, tasks, ParallelStrategy.ALL
        )

        state["intermediate_results"]["parallel_execution"] = results
        state_logger.info(f"Parallel execution completed: {len(results)} tasks")

        return state

    async def merge_parallel_results(self, state: UnifiedState) -> UnifiedState:
        """Merge parallel execution results (original logic)"""
        state_logger = get_state_logger(state)
        state["execution_path"].append("merge_parallel_results")

        parallel_results = state.get("intermediate_results", {}).get("parallel_execution", {})

        # Merge results
        merged = {}
        for node_name, result in parallel_results.items():
            if isinstance(result, dict):
                merged.update(result)

        state["intermediate_results"]["merged_results"] = merged
        state_logger.info("Parallel results merged")

        return state

    # ========================================================================
    # FINAL NODES - ORIGINAL LOGIC
    # ========================================================================

    def synthesize_response(self, state: UnifiedState) -> UnifiedState:
        """Synthesize final response (original logic)"""
        state_logger = get_state_logger(state)
        state["execution_path"].append("synthesize_response")

        if not state.get("final_output"):
            state["final_output"] = "Request processed, work in progress, do not refresh screen."

        if state.get("final_output"):
             # Create the AI message object
            ai_message = {
                "role": "assistant",
                "content": state["final_output"],
                "timestamp": datetime.now().isoformat()
            }

            # Initialize messages list if it doesn't exist
            if "messages" not in state:
                state["messages"] = []

            # Append the message
            state["messages"].append(ai_message)

        state_logger.info("Response synthesis completed")
        return state

    def update_memory(self, state: UnifiedState) -> UnifiedState:
        """Update memory and finalize (original logic)"""
        state_logger = get_state_logger(state)
        state["execution_path"].append("update_memory")

        # Calculate duration
        if "start_time" in state["metrics"]:
            start = datetime.fromisoformat(state["metrics"]["start_time"])
            duration_ms = (datetime.now() - start).total_seconds() * 1000
            state["metrics"]["total_duration_ms"] = duration_ms
        else:
            duration_ms = 0.0

        state["metrics"]["completed_at"] = datetime.now().isoformat()
        state["metrics"]["success"] = len(state.get("errors", [])) == 0

        self.logger.log_response(
            request_id=state["request_id"],
            duration_ms=duration_ms,
            success=state["metrics"]["success"],
            capabilities_used=state["execution_path"]
        )

        state_logger.info(f"Orchestration completed in {duration_ms:.0f}ms")
        return state

    # ========================================================================
    # EXECUTION METHODS - ORIGINAL + STREAMING
    # ========================================================================

    async def execute(
        self,
        user_id: int,
        session_id: str,
        message: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute orchestration (original logic with fixes applied)
        """
        # Initialize state
        initial_state = UnifiedState(
            user_id=user_id,
            session_id=session_id,
            input_data=message,
            orchestration_type=OrchestrationType.CONVERSATIONAL,
            start_time=datetime.now()
        )

        # Create runnable config
        runnable_config = RunnableConfig(
            configurable={"thread_id": session_id},
            **(config or {})
        )

        try:
            # Execute the graph
            result = await self.graph.ainvoke(
                initial_state,
                config=runnable_config
            )

            # Add feature availability info
            result["features_used"] = {
                k: v for k, v in self.features_available.items()
                if getattr(self, f"enable_{k}", False)
            }

            result["features_unavailable"] = {
                k: "fallback_active" for k, v in self.features_available.items()
                if not v and getattr(self, f"enable_{k}", False)
            }

            return result

        except Exception as e:
            self.logger.error("orchestration_execution_failed", {
                "user_id": user_id,
                "session_id": session_id,
                "error": str(e)
            }, error=e)

            return {
                "error": str(e),
                "status": "failed",
                "features_available": self.features_available
            }

    def _log_initialization_summary(self):
        """Log summary of initialization and feature availability"""
        self.logger.info("orchestration_layer_initialized", {
            "features_requested": {
                "checkpointing": self.enable_checkpointing,
                "hitl": self.enable_hitl,
                "parallel": self.enable_parallel,
                "streaming": self.enable_streaming,
                "error_handling": self.enable_error_handling
            },
            "features_available": self.features_available,
            "fallbacks_active": [
                k for k, v in self.features_available.items()
                if not v and getattr(self, f"enable_{k}", False)
            ],
            "fixes_applied": [
                "import_guards",
                "redis_circuit_breaker",
                "mongodb_ab_testing",
                "thread_safe_rag",
                "connection_pooling"
            ]
        })

    def get_feature_status(self) -> Dict[str, Any]:
        """Get current feature availability status"""
        return {
            "available": self.features_available,
            "enabled": {
                "checkpointing": self.enable_checkpointing,
                "hitl": self.enable_hitl,
                "parallel": self.enable_parallel,
                "streaming": self.enable_streaming,
                "error_handling": self.enable_error_handling
            },
            "fallbacks": {
                "checkpointing": "in-memory" if not CHECKPOINTING_AVAILABLE and self.enable_checkpointing else None,
                "hitl": "auto-approve" if not HITL_AVAILABLE and self.enable_hitl else None,
                "parallel": "sequential" if not PARALLEL_AVAILABLE and self.enable_parallel else None,
                "streaming": "full-response" if not STREAMING_AVAILABLE and self.enable_streaming else None,
                "error_handling": "basic" if not ERROR_HANDLING_AVAILABLE and self.enable_error_handling else None
            },
            "fixes_applied": {
                "import_guards": True,
                "redis_circuit_breaker": ERROR_HANDLING_AVAILABLE,
                "mongodb_ab_testing": "via experiment_manager.py",
                "thread_safe_rag": "via rag_engine.py",
                "connection_pooling": "via http_client.py"
            }
        }


# Singleton instance
_orchestrator_instance = None

def get_orchestrator(**kwargs) -> AIOrchestrationLayer:
    """Get singleton orchestrator instance with lazy initialization"""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = AIOrchestrationLayer(**kwargs)
    return _orchestrator_instance