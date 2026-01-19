# backend/ai-orchestration-layer/src/core/error_handling.py

"""
Tool Error Handling System with Redis-Backed Circuit Breaker - FIXED
Implements persistent circuit breaker state using Redis
Survives service restarts and enables distributed circuit breaking
"""

import asyncio
import traceback
import json
from typing import Any, Callable, Dict, List, Optional, Type, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
import time
import random
from functools import wraps

from langchain.tools.base import ToolException
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Redis imports with fallback
try:
    import redis.asyncio as aioredis
    from redis.asyncio import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("⚠️  Redis not available - circuit breaker will use in-memory storage")
    print("   Install: pip install redis")


class ErrorSeverity(Enum):
    """Severity levels for errors"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Categories of errors for better handling"""
    NETWORK = "network"
    AUTHENTICATION = "authentication"
    VALIDATION = "validation"
    RATE_LIMIT = "rate_limit"
    RESOURCE = "resource"
    BUSINESS_LOGIC = "business_logic"
    SYSTEM = "system"
    EXTERNAL_SERVICE = "external_service"


@dataclass
class ErrorContext:
    """Context information for error handling"""
    error_id: str
    timestamp: datetime
    tool_name: str
    input_data: Any
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    metadata: Dict[str, Any] = field(default_factory=dict)


class StructuredToolException(ToolException):
    """Enhanced ToolException with structured error information"""
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        severity: ErrorSeverity,
        error_code: Optional[str] = None,
        retry_able: bool = True,
        fallback_available: bool = False,
        user_message: Optional[str] = None,
        technical_details: Optional[Dict] = None,
        recovery_suggestions: Optional[List[str]] = None
    ):
        super().__init__(message)
        self.category = category
        self.severity = severity
        self.error_code = error_code or self._generate_error_code(category)
        self.retry_able = retry_able
        self.fallback_available = fallback_available
        self.user_message = user_message or self._generate_user_message(message, category)
        self.technical_details = technical_details or {}
        self.recovery_suggestions = recovery_suggestions or []
        self.timestamp = datetime.now()
    
    def _generate_error_code(self, category: ErrorCategory) -> str:
        """Generate standardized error code"""
        prefix_map = {
            ErrorCategory.NETWORK: "NET",
            ErrorCategory.AUTHENTICATION: "AUTH",
            ErrorCategory.VALIDATION: "VAL",
            ErrorCategory.RATE_LIMIT: "RATE",
            ErrorCategory.RESOURCE: "RES",
            ErrorCategory.BUSINESS_LOGIC: "BIZ",
            ErrorCategory.SYSTEM: "SYS",
            ErrorCategory.EXTERNAL_SERVICE: "EXT"
        }
        prefix = prefix_map.get(category, "ERR")
        return f"{prefix}_{int(time.time() * 1000) % 10000}"
    
    def _generate_user_message(self, message: str, category: ErrorCategory) -> str:
        """Generate user-friendly error message"""
        user_messages = {
            ErrorCategory.NETWORK: "We're having trouble connecting. Please check your internet connection and try again.",
            ErrorCategory.AUTHENTICATION: "There was an authentication issue. Please verify your credentials.",
            ErrorCategory.VALIDATION: "The provided information couldn't be processed. Please check your input.",
            ErrorCategory.RATE_LIMIT: "Too many requests. Please wait a moment before trying again.",
            ErrorCategory.RESOURCE: "The requested resource couldn't be found.",
            ErrorCategory.BUSINESS_LOGIC: "This operation couldn't be completed due to business rules.",
            ErrorCategory.SYSTEM: "A system error occurred. Our team has been notified.",
            ErrorCategory.EXTERNAL_SERVICE: "An external service is temporarily unavailable."
        }
        return user_messages.get(category, f"An error occurred: {message}")
    
    def to_dict(self) -> Dict:
        """Convert exception to dictionary"""
        return {
            "error_code": self.error_code,
            "message": str(self),
            "user_message": self.user_message,
            "category": self.category.value,
            "severity": self.severity.value,
            "retry_able": self.retry_able,
            "fallback_available": self.fallback_available,
            "timestamp": self.timestamp.isoformat(),
            "technical_details": self.technical_details,
            "recovery_suggestions": self.recovery_suggestions
        }


class RetryStrategy:
    """Retry strategies for failed operations"""
    
    @staticmethod
    def exponential_backoff(
        attempt: int,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter: bool = True
    ) -> float:
        """Calculate delay using exponential backoff"""
        delay = min(base_delay * (2 ** attempt), max_delay)
        if jitter:
            delay = delay * (0.5 + random.random())
        return delay
    
    @staticmethod
    def linear_backoff(attempt: int, delay: float = 1.0) -> float:
        """Calculate delay using linear backoff"""
        return delay * (attempt + 1)
    
    @staticmethod
    def fixed_delay(delay: float = 1.0) -> float:
        """Fixed delay between retries"""
        return delay


class RedisCircuitBreaker:
    """
    Redis-backed circuit breaker for distributed systems
    State persists across service restarts
    
    ISSUE #2 FIX: Persistent circuit breaker state using Redis
    """
    
    def __init__(
        self,
        name: str,
        redis_client: Optional['Redis'] = None,
        redis_url: str = "redis://redis:6379/0",
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_max_calls: int = 3
    ):
        """
        Initialize Redis-backed circuit breaker
        
        Args:
            name: Unique name for this circuit breaker
            redis_client: Optional existing Redis client
            redis_url: Redis connection URL
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds before attempting recovery
            half_open_max_calls: Max calls to try in half-open state
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        
        # Redis keys
        self.key_prefix = f"circuit_breaker:{name}"
        self.state_key = f"{self.key_prefix}:state"
        self.failure_count_key = f"{self.key_prefix}:failure_count"
        self.last_failure_key = f"{self.key_prefix}:last_failure"
        self.half_open_calls_key = f"{self.key_prefix}:half_open_calls"
        
        # Initialize Redis client
        self.redis_client = redis_client
        self.redis_url = redis_url
        self._redis_initialized = False
        
        # Fallback to in-memory if Redis unavailable
        self._memory_state = {
            "state": "closed",
            "failure_count": 0,
            "last_failure_time": None,
            "half_open_calls": 0
        }
        self.use_memory_fallback = not REDIS_AVAILABLE
    
    async def _ensure_redis_connection(self):
        """Ensure Redis connection is established"""
        if self.use_memory_fallback:
            return
        
        if not self._redis_initialized:
            if self.redis_client is None:
                try:
                    self.redis_client = await aioredis.from_url(
                        self.redis_url,
                        encoding="utf-8",
                        decode_responses=True
                    )
                    self._redis_initialized = True
                except Exception as e:
                    print(f"⚠️  Redis connection failed: {e}")
                    print("   Falling back to in-memory circuit breaker")
                    self.use_memory_fallback = True
    
    async def _get_state(self) -> str:
        """Get current circuit breaker state"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            return self._memory_state["state"]
        
        try:
            state = await self.redis_client.get(self.state_key)
            return state or "closed"
        except Exception as e:
            print(f"⚠️  Redis read failed: {e}, using fallback")
            return self._memory_state["state"]
    
    async def _set_state(self, state: str):
        """Set circuit breaker state"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            self._memory_state["state"] = state
            return
        
        try:
            await self.redis_client.set(self.state_key, state)
        except Exception as e:
            print(f"⚠️  Redis write failed: {e}, using fallback")
            self._memory_state["state"] = state
    
    async def _get_failure_count(self) -> int:
        """Get failure count"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            return self._memory_state["failure_count"]
        
        try:
            count = await self.redis_client.get(self.failure_count_key)
            return int(count) if count else 0
        except Exception as e:
            print(f"⚠️  Redis read failed: {e}, using fallback")
            return self._memory_state["failure_count"]
    
    async def _increment_failure_count(self) -> int:
        """Increment and return failure count"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            self._memory_state["failure_count"] += 1
            return self._memory_state["failure_count"]
        
        try:
            count = await self.redis_client.incr(self.failure_count_key)
            return count
        except Exception as e:
            print(f"⚠️  Redis write failed: {e}, using fallback")
            self._memory_state["failure_count"] += 1
            return self._memory_state["failure_count"]
    
    async def _reset_failure_count(self):
        """Reset failure count"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            self._memory_state["failure_count"] = 0
            return
        
        try:
            await self.redis_client.set(self.failure_count_key, 0)
        except Exception as e:
            print(f"⚠️  Redis write failed: {e}, using fallback")
            self._memory_state["failure_count"] = 0
    
    async def _set_last_failure_time(self):
        """Record last failure time"""
        await self._ensure_redis_connection()
        
        timestamp = datetime.now().isoformat()
        
        if self.use_memory_fallback:
            self._memory_state["last_failure_time"] = timestamp
            return
        
        try:
            await self.redis_client.set(self.last_failure_key, timestamp)
        except Exception as e:
            print(f"⚠️  Redis write failed: {e}, using fallback")
            self._memory_state["last_failure_time"] = timestamp
    
    async def _get_last_failure_time(self) -> Optional[datetime]:
        """Get last failure time"""
        await self._ensure_redis_connection()
        
        if self.use_memory_fallback:
            ts = self._memory_state["last_failure_time"]
            return datetime.fromisoformat(ts) if ts else None
        
        try:
            timestamp = await self.redis_client.get(self.last_failure_key)
            return datetime.fromisoformat(timestamp) if timestamp else None
        except Exception as e:
            print(f"⚠️  Redis read failed: {e}, using fallback")
            ts = self._memory_state["last_failure_time"]
            return datetime.fromisoformat(ts) if ts else None
    
    async def is_open(self) -> bool:
        """Check if circuit breaker is open"""
        state = await self._get_state()
        
        if state == "open":
            # Check if recovery timeout has passed
            last_failure = await self._get_last_failure_time()
            if last_failure:
                elapsed = (datetime.now() - last_failure).total_seconds()
                if elapsed >= self.recovery_timeout:
                    await self._set_state("half_open")
                    return False
            return True
        
        return False
    
    async def record_success(self):
        """Record a successful call"""
        state = await self._get_state()
        
        if state == "half_open":
            # Success in half-open state -> close circuit
            await self._set_state("closed")
            await self._reset_failure_count()
        elif state == "closed":
            # Reset failure count on success
            await self._reset_failure_count()
    
    async def record_failure(self):
        """Record a failed call"""
        state = await self._get_state()
        
        if state == "half_open":
            # Failure in half-open -> back to open
            await self._set_state("open")
            await self._set_last_failure_time()
        elif state == "closed":
            # Increment failure count
            count = await self._increment_failure_count()
            
            if count >= self.failure_threshold:
                # Open the circuit
                await self._set_state("open")
                await self._set_last_failure_time()
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status"""
        state = await self._get_state()
        failure_count = await self._get_failure_count()
        last_failure = await self._get_last_failure_time()
        
        return {
            "name": self.name,
            "state": state,
            "failure_count": failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": last_failure.isoformat() if last_failure else None,
            "recovery_timeout": self.recovery_timeout,
            "storage": "redis" if not self.use_memory_fallback else "memory"
        }
    
    async def reset(self):
        """Manually reset circuit breaker"""
        await self._set_state("closed")
        await self._reset_failure_count()
    
    async def close_redis_connection(self):
        """Close Redis connection"""
        if self.redis_client and not self.use_memory_fallback:
            try:
                await self.redis_client.close()
            except Exception as e:
                print(f"⚠️  Error closing Redis connection: {e}")


class ErrorHandler:
    """
    Complete error handling system with Redis-backed circuit breakers
    """
    
    def __init__(
        self,
        max_history: int = 1000,
        redis_url: str = "redis://redis:6379/0",
        redis_client: Optional['Redis'] = None
    ):
        """
        Initialize error handler with Redis support
        
        Args:
            max_history: Maximum number of errors to keep in history
            redis_url: Redis connection URL
            redis_client: Optional existing Redis client
        """
        self.max_history = max_history
        self.redis_url = redis_url
        self.redis_client = redis_client
        
        # Error tracking
        self.error_history: List[StructuredToolException] = []
        
        # Circuit breakers (name -> RedisCircuitBreaker)
        self.circuit_breakers: Dict[str, RedisCircuitBreaker] = {}
        
        # Retry strategies per category
        self.retry_strategies: Dict[ErrorCategory, Callable] = {
            ErrorCategory.NETWORK: lambda a: RetryStrategy.exponential_backoff(a, base_delay=1.0),
            ErrorCategory.RATE_LIMIT: lambda a: RetryStrategy.exponential_backoff(a, base_delay=5.0),
            ErrorCategory.EXTERNAL_SERVICE: lambda a: RetryStrategy.exponential_backoff(a, base_delay=2.0),
        }
        
        # Fallback handlers (tool_name -> fallback_func)
        self.fallback_handlers: Dict[str, Callable] = {}
    
    async def execute_with_handling(
        self,
        tool_func: Callable,
        tool_name: str,
        state: Any,
        max_retries: int = 3
    ) -> Any:
        """
        Execute tool with comprehensive error handling
        
        Args:
            tool_func: Tool function to execute
            tool_name: Name of the tool
            state: State to pass to tool
            max_retries: Maximum retry attempts
        
        Returns:
            Tool execution result
        """
        # Get or create circuit breaker for this tool
        circuit_breaker = await self._get_circuit_breaker(tool_name)
        
        # Check if circuit is open
        if await circuit_breaker.is_open():
            raise StructuredToolException(
                message=f"Circuit breaker open for {tool_name}",
                category=ErrorCategory.SYSTEM,
                severity=ErrorSeverity.HIGH,
                retry_able=False,
                fallback_available=tool_name in self.fallback_handlers
            )
        
        # Create error context
        context = ErrorContext(
            error_id=f"{tool_name}_{int(time.time() * 1000)}",
            timestamp=datetime.now(),
            tool_name=tool_name,
            input_data=state.get("input_data") if hasattr(state, "get") else str(state),
            user_id=state.get("user_id") if hasattr(state, "get") else None,
            session_id=state.get("session_id") if hasattr(state, "get") else None,
            max_retries=max_retries
        )
        
        # Try execution with retries
        for attempt in range(max_retries + 1):
            context.retry_count = attempt
            
            try:
                # Execute the tool
                result = await tool_func(state)
                
                # Record success in circuit breaker
                await circuit_breaker.record_success()
                
                return result
                
            except StructuredToolException as exc:
                # Handle structured exception
                await self._handle_structured_exception(exc, context, circuit_breaker, attempt)
                
                if attempt >= max_retries or not exc.retry_able:
                    # Try fallback if available
                    if exc.fallback_available and tool_name in self.fallback_handlers:
                        return await self._execute_fallback(tool_name, context)
                    raise
                
                # Calculate delay and retry
                delay = self._get_retry_delay(exc.category, attempt)
                await asyncio.sleep(delay)
                
            except Exception as e:
                # Convert to structured exception
                exc = StructuredToolException(
                    message=str(e),
                    category=ErrorCategory.SYSTEM,
                    severity=ErrorSeverity.MEDIUM,
                    retry_able=True,
                    original_error=e
                )
                
                await self._handle_structured_exception(exc, context, circuit_breaker, attempt)
                
                if attempt >= max_retries:
                    # Try fallback if available
                    if tool_name in self.fallback_handlers:
                        return await self._execute_fallback(tool_name, context)
                    raise exc
                
                # Retry with exponential backoff
                delay = RetryStrategy.exponential_backoff(attempt)
                await asyncio.sleep(delay)
    
    async def _get_circuit_breaker(self, tool_name: str) -> RedisCircuitBreaker:
        """Get or create circuit breaker for tool"""
        if tool_name not in self.circuit_breakers:
            self.circuit_breakers[tool_name] = RedisCircuitBreaker(
                name=tool_name,
                redis_client=self.redis_client,
                redis_url=self.redis_url,
                failure_threshold=5,
                recovery_timeout=60
            )
        return self.circuit_breakers[tool_name]
    
    async def _handle_structured_exception(
        self,
        exc: StructuredToolException,
        context: ErrorContext,
        circuit_breaker: RedisCircuitBreaker,
        attempt: int
    ):
        """Handle a structured exception"""
        # Record failure in circuit breaker
        await circuit_breaker.record_failure()
        
        # Add to history
        self.error_history.append(exc)
        if len(self.error_history) > self.max_history:
            self.error_history.pop(0)
        
        # Alert on critical errors
        if exc.severity == ErrorSeverity.CRITICAL:
            self._alert_critical_error(exc, context)
        
        # Update metrics
        self._update_error_metrics(exc, context, attempt)
    
    def _get_retry_delay(self, category: ErrorCategory, attempt: int) -> float:
        """Get retry delay for category"""
        strategy = self.retry_strategies.get(
            category,
            lambda a: RetryStrategy.exponential_backoff(a)
        )
        return strategy(attempt)
    
    async def _execute_fallback(self, tool_name: str, context: ErrorContext) -> Any:
        """Execute fallback handler if available"""
        fallback = self.fallback_handlers.get(tool_name)
        if fallback:
            return await fallback(context)
        return None
    
    def register_fallback(self, tool_name: str, fallback: Callable):
        """Register a fallback handler for a tool"""
        self.fallback_handlers[tool_name] = fallback
    
    async def get_circuit_breaker_status(self, tool_name: str) -> Dict[str, Any]:
        """Get circuit breaker status for a tool"""
        circuit_breaker = await self._get_circuit_breaker(tool_name)
        return await circuit_breaker.get_status()
    
    async def reset_circuit_breaker(self, tool_name: str):
        """Manually reset a circuit breaker"""
        circuit_breaker = await self._get_circuit_breaker(tool_name)
        await circuit_breaker.reset()
    
    def _alert_critical_error(self, exc: StructuredToolException, context: ErrorContext):
        """Alert on critical errors"""
        alert_data = {
            "error": exc.to_dict(),
            "context": {
                "error_id": context.error_id,
                "tool": context.tool_name,
                "user_id": context.user_id,
                "timestamp": context.timestamp.isoformat()
            }
        }
        print(f"🚨 CRITICAL ERROR ALERT: {json.dumps(alert_data, indent=2)}")
    
    def _update_error_metrics(
        self,
        exc: StructuredToolException,
        context: ErrorContext,
        attempt: int
    ):
        """Update error metrics for monitoring"""
        # TODO: Implement metrics collection (Prometheus, DataDog, etc.)
        pass
    
    def get_error_summary(self, hours: int = 24) -> Dict:
        """Get summary of recent errors"""
        cutoff = datetime.now() - timedelta(hours=hours)
        recent_errors = [
            e for e in self.error_history
            if e.timestamp > cutoff
        ]
        
        summary = {
            "total_errors": len(recent_errors),
            "by_category": {},
            "by_severity": {},
            "most_common_tools": {}
        }
        
        for error in recent_errors:
            cat = error.category.value
            summary["by_category"][cat] = summary["by_category"].get(cat, 0) + 1
            
            sev = error.severity.value
            summary["by_severity"][sev] = summary["by_severity"].get(sev, 0) + 1
        
        return summary
    
    async def cleanup(self):
        """Cleanup resources"""
        for circuit_breaker in self.circuit_breakers.values():
            await circuit_breaker.close_redis_connection()
