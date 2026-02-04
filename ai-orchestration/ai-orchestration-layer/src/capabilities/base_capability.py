# backend/ai-orchestration-layer/src/capabilities/base_capability.py

"""
Base Capability Class - Standardized interface for all capabilities
Provides consistent error handling, logging, and async support
"""

import traceback
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum

from core.llm_manager import LLMManager, LLMConfig
from core.state import UnifiedState


class CapabilityError(Exception):
    """Base exception for capability errors"""
    
    def __init__(
        self,
        message: str,
        capability_name: str,
        error_code: str,
        recoverable: bool = True,
        original_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.capability_name = capability_name
        self.error_code = error_code
        self.recoverable = recoverable
        self.original_error = original_error
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "capability": self.capability_name,
            "error_code": self.error_code,
            "recoverable": self.recoverable,
            "timestamp": self.timestamp.isoformat(),
            "original_error": str(self.original_error) if self.original_error else None
        }


class CapabilityStatus(Enum):
    """Status of capability execution"""
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILURE = "failure"
    FALLBACK = "fallback"


class BaseCapability(ABC):
    """
    Base class for all capabilities in the orchestration layer
    Provides standardized error handling, logging, and execution patterns
    """
    
    def __init__(self, capability_name: str, llm_config: Optional[LLMConfig] = None):
        """
        Initialize base capability
        
        Args:
            capability_name: Name of the capability
            llm_config: Optional LLM configuration
        """
        self.capability_name = capability_name
        self.llm_manager = LLMManager.get_instance()

        # Store config to use when fetching LLM dynamically
        self._llm_config = llm_config

        # Initialize metrics
        self.metrics = {
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "avg_duration_ms": 0.0,
            "last_execution": None
        }

    @property
    def llm(self):
        """
        Dynamically get the LLM instance.
        This ensures we always get the current model if it changes at runtime.
        """
        return self.llm_manager.get_llm(
            config=self._llm_config,
            cache_key=f"{self.capability_name}_llm"
        )

    @abstractmethod
    async def _execute_internal(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Internal execution logic - must be implemented by subclasses

        Args:
            state: Current unified state

        Returns:
            Dictionary with execution results
        """
        pass

    async def execute(self, state: UnifiedState) -> UnifiedState:
        """
        Execute capability with standardized error handling and logging

        Args:
            state: Current unified state

        Returns:
            Updated state with results
        """
        start_time = datetime.now()

        # Add capability to execution path
        state["execution_path"].append(self.capability_name)
        state["logs"].append(f"Starting {self.capability_name} execution...")

        try:
            # Execute internal logic
            result = await self._execute_internal(state)

            # Calculate duration
            duration_ms = (datetime.now() - start_time).total_seconds() * 1000

            # Update metrics
            self._update_metrics(True, duration_ms)

            # Store results in state
            state["intermediate_results"][self.capability_name] = result

            # Add metadata
            result_metadata = {
                "status": CapabilityStatus.SUCCESS.value,
                "duration_ms": duration_ms,
                "timestamp": datetime.now().isoformat()
            }

            state["logs"].append(
                f"{self.capability_name} completed successfully in {duration_ms:.0f}ms"
            )

            # Set final output if not already set
            if not state.get("final_output") and "result" in result:
                state["final_output"] = result["result"]

            return state

        except CapabilityError as e:
            # Handle known capability errors
            return await self._handle_capability_error(state, e, start_time)

        except Exception as e:
            # Handle unexpected errors
            capability_error = CapabilityError(
                message=f"Unexpected error in {self.capability_name}: {str(e)}",
                capability_name=self.capability_name,
                error_code=f"{self.capability_name.upper()}_UNEXPECTED_ERROR",
                recoverable=False,
                original_error=e
            )
            return await self._handle_capability_error(state, capability_error, start_time)

    async def _handle_capability_error(
        self,
        state: UnifiedState,
        error: CapabilityError,
        start_time: datetime
    ) -> UnifiedState:
        """
        Standardized error handling for all capabilities

        Args:
            state: Current state
            error: Capability error
            start_time: Execution start time

        Returns:
            Updated state with error information
        """
        duration_ms = (datetime.now() - start_time).total_seconds() * 1000

        # Update metrics
        self._update_metrics(False, duration_ms)

        # Log error
        state["logs"].append(f"❌ {self.capability_name} error: {error.message}")

        # Store error details
        if "errors" not in state:
            state["errors"] = []

        state["errors"].append(error.to_dict())

        # Try fallback if error is recoverable
        if error.recoverable:
            state["logs"].append(f"Attempting fallback for {self.capability_name}...")
            fallback_result = await self._execute_fallback(state)

            if fallback_result:
                state["intermediate_results"][self.capability_name] = {
                    "status": CapabilityStatus.FALLBACK.value,
                    "result": fallback_result,
                    "original_error": error.to_dict()
                }
                state["logs"].append(f"✓ Fallback successful for {self.capability_name}")
                return state

        # Store failure result
        state["intermediate_results"][self.capability_name] = {
            "status": CapabilityStatus.FAILURE.value,
            "error": error.to_dict(),
            "duration_ms": duration_ms
        }

        # Set error message in final output if nothing else set
        if not state.get("final_output"):
            state["final_output"] = f"I encountered an error: {error.message}"

        return state

    async def _execute_fallback(self, state: UnifiedState) -> Optional[Dict[str, Any]]:
        """
        Execute fallback logic when primary execution fails
        Override this in subclasses to provide specific fallback behavior

        Args:
            state: Current state

        Returns:
            Fallback result or None if no fallback available
        """
        return None

    def _update_metrics(self, success: bool, duration_ms: float):
        """Update capability metrics"""
        self.metrics["total_executions"] += 1

        if success:
            self.metrics["successful_executions"] += 1
        else:
            self.metrics["failed_executions"] += 1

        # Update average duration (running average)
        current_avg = self.metrics["avg_duration_ms"]
        total = self.metrics["total_executions"]
        self.metrics["avg_duration_ms"] = (
            (current_avg * (total - 1) + duration_ms) / total
        )

        self.metrics["last_execution"] = datetime.now().isoformat()

    def get_metrics(self) -> Dict[str, Any]:
        """Get capability metrics"""
        success_rate = 0.0
        if self.metrics["total_executions"] > 0:
            success_rate = (
                self.metrics["successful_executions"] /
                self.metrics["total_executions"] * 100
            )

        return {
            **self.metrics,
            "success_rate": success_rate,
            "capability_name": self.capability_name
        }

    def reset_metrics(self):
        """Reset capability metrics"""
        self.metrics = {
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "avg_duration_ms": 0.0,
            "last_execution": None
        }