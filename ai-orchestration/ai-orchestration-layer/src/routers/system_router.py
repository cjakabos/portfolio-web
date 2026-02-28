# ============================================================================
# File: backend/ai-orchestration-layer/src/routers/system_router.py
# System Router - Circuit Breakers, Connection Stats, Feature Status
# ============================================================================
# 
# Add this router to main.py with:
#   from routers.system_router import router as system_router
#   app.include_router(system_router)
# ============================================================================

import asyncio

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from auth import require_admin_user

router = APIRouter(tags=["System"])


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class CircuitBreakerStatus(BaseModel):
    name: str
    state: str  # "closed", "open", "half_open"
    failure_count: int
    failure_threshold: int
    last_failure_time: Optional[str]
    recovery_timeout: int
    storage: str  # "redis" or "memory"


class CircuitBreakerListResponse(BaseModel):
    circuit_breakers: List[CircuitBreakerStatus]
    count: int
    storage_backend: str


class ConnectionStats(BaseModel):
    service: str
    available: bool
    client_closed: bool
    max_connections: int
    max_keepalive_connections: int
    http2_enabled: bool


class ConnectionStatsResponse(BaseModel):
    services: List[ConnectionStats]
    total_services: int


class FeatureStatusResponse(BaseModel):
    available: Dict[str, bool]
    enabled: Dict[str, bool]
    fallbacks: Dict[str, Optional[str]]
    fixes_applied: Dict[str, Any]

class RecentError(BaseModel):
    """Schema for a single error entry"""
    id: str
    code: str
    message: str
    category: str
    severity: str
    timestamp: str
    retryCount: int
    resolved: bool


class RecentErrorsResponse(BaseModel):
    """Response for recent errors endpoint"""
    errors: List[RecentError]
    total: int



# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================

# These will be injected from main.py's global instances
_orchestrator = None
_error_handler = None


def set_orchestrator(orchestrator):
    """Set orchestrator instance (called from main.py lifespan)"""
    global _orchestrator
    _orchestrator = orchestrator


def set_error_handler(error_handler):
    """Set error handler instance (called from main.py lifespan)"""
    global _error_handler
    _error_handler = error_handler


def get_orchestrator():
    if _orchestrator is None:
        raise HTTPException(status_code=503, detail="Orchestrator not initialized")
    return _orchestrator


def get_error_handler():
    if _error_handler is None:
        raise HTTPException(status_code=503, detail="Error handler not initialized")
    return _error_handler


# ============================================================================
# FEATURE STATUS ENDPOINTS
# ============================================================================

@router.get("/feature-status", response_model=FeatureStatusResponse)
async def get_feature_status(admin: str = Depends(require_admin_user)):
    """
    Get status of all system features (admin-only).

    Returns feature availability, enabled status, and active fallbacks
    """
    orchestrator = get_orchestrator()
    return orchestrator.get_feature_status()


# ============================================================================
# CIRCUIT BREAKER ENDPOINTS
# ============================================================================

@router.get("/circuit-breakers", response_model=CircuitBreakerListResponse)
async def list_circuit_breakers(admin: str = Depends(require_admin_user)):
    """
    List all circuit breakers and their current status (admin-only).

    Returns status for all registered circuit breakers including:
    - Current state (closed/open/half_open)
    - Failure count and threshold
    - Last failure time
    - Storage backend (redis/memory)
    """
    orchestrator = get_orchestrator()
    
    # Check if error handling is available
    if not orchestrator.enable_error_handling or not orchestrator.error_handler:
        return CircuitBreakerListResponse(
            circuit_breakers=[],
            count=0,
            storage_backend="unavailable"
        )
    
    error_handler = orchestrator.error_handler
    circuit_breakers = []
    
    # Get status for all registered circuit breakers
    for name, cb in error_handler.circuit_breakers.items():
        try:
            status = await cb.get_status()
            circuit_breakers.append(CircuitBreakerStatus(**status))
        except Exception as e:
            # Include circuit breaker with error status
            circuit_breakers.append(CircuitBreakerStatus(
                name=name,
                state="unknown",
                failure_count=0,
                failure_threshold=cb.failure_threshold,
                last_failure_time=None,
                recovery_timeout=cb.recovery_timeout,
                storage="error"
            ))
    
    # Determine storage backend
    storage_backend = "memory"
    if circuit_breakers and not circuit_breakers[0].storage == "memory":
        storage_backend = "redis"
    
    return CircuitBreakerListResponse(
        circuit_breakers=circuit_breakers,
        count=len(circuit_breakers),
        storage_backend=storage_backend
    )


@router.get("/circuit-breakers/{name}")
async def get_circuit_breaker(name: str, admin: str = Depends(require_admin_user)):
    """
    Get status of a specific circuit breaker
    
    Args:
        name: Circuit breaker name (e.g., "agent_executor", "rag_engine")
    
    Returns:
        Circuit breaker status details
    """
    orchestrator = get_orchestrator()
    
    if not orchestrator.enable_error_handling or not orchestrator.error_handler:
        raise HTTPException(
            status_code=503, 
            detail="Error handling not available"
        )
    
    error_handler = orchestrator.error_handler
    
    try:
        status = await error_handler.get_circuit_breaker_status(name)
        return CircuitBreakerStatus(**status)
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Circuit breaker '{name}' not found: {str(e)}"
        )


@router.post("/circuit-breakers/{name}/reset")
async def reset_circuit_breaker(name: str, admin: str = Depends(require_admin_user)):
    """
    Reset a circuit breaker to closed state
    
    Use this to manually recover from an open circuit after fixing
    the underlying issue.
    
    Args:
        name: Circuit breaker name to reset
    
    Returns:
        Updated circuit breaker status
    """
    orchestrator = get_orchestrator()
    
    if not orchestrator.enable_error_handling or not orchestrator.error_handler:
        raise HTTPException(
            status_code=503,
            detail="Error handling not available"
        )
    
    error_handler = orchestrator.error_handler
    
    try:
        await error_handler.reset_circuit_breaker(name)
        status = await error_handler.get_circuit_breaker_status(name)
        return {
            "message": f"Circuit breaker '{name}' reset successfully",
            "status": CircuitBreakerStatus(**status)
        }
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Failed to reset circuit breaker '{name}': {str(e)}"
        )


# ============================================================================
# CONNECTION STATS ENDPOINTS
# ============================================================================

@router.get("/connection-stats", response_model=ConnectionStatsResponse)
async def get_connection_stats(admin: str = Depends(require_admin_user)):
    """
    Get HTTP connection pool statistics for all services
    
    Returns connection pool status for each configured service including:
    - Whether the client is available
    - Max connections and keepalive settings
    - HTTP/2 support status
    """
    # Import here to avoid circular imports
    try:
        from tools.http_client import ServiceHTTPClients
    except ImportError:
        return ConnectionStatsResponse(
            services=[],
            total_services=0
        )
    
    service_names = ["cloudapp", "petstore", "vehicles", "ml"]

    probe_paths = {
        "cloudapp": ["/actuator/health", "/health"],
        "petstore": ["/actuator/health", "/health"],
        "vehicles": ["/actuator/health", "/health"],
        "ml": ["/health", "/actuator/health"],
    }

    async def collect_service_stats(service_name: str) -> ConnectionStats:
        try:
            getter_method = getattr(ServiceHTTPClients, f"get_{service_name}_client", None)
            if not getter_method:
                return ConnectionStats(
                    service=service_name,
                    available=False,
                    client_closed=True,
                    max_connections=0,
                    max_keepalive_connections=0,
                    http2_enabled=False
                )

            client = getter_method()

            # Silent probe so the first dashboard load reflects real connectivity
            # instead of "no client has made a request yet".
            probe_ok = False
            for path in probe_paths.get(service_name, []):
                if await client.probe(path, timeout_seconds=2.0):
                    probe_ok = True
                    break

            stats = await client.get_connection_stats()
            return ConnectionStats(
                service=service_name,
                available=probe_ok,
                client_closed=stats.get("client_closed", True),
                max_connections=stats.get("max_connections", 0),
                max_keepalive_connections=stats.get("max_keepalive_connections", 0),
                http2_enabled=stats.get("http2_enabled", False)
            )
        except Exception:
            return ConnectionStats(
                service=service_name,
                available=False,
                client_closed=True,
                max_connections=0,
                max_keepalive_connections=0,
                http2_enabled=False
            )

    services = await asyncio.gather(*(collect_service_stats(service_name) for service_name in service_names))

    return ConnectionStatsResponse(
        services=services,
        total_services=len(services)
    )


# ============================================================================
# ERROR SUMMARY ENDPOINT
# ============================================================================

@router.get("/errors/summary")
async def get_error_summary(hours: int = 24, admin: str = Depends(require_admin_user)):
    """
    Get summary of errors in the last N hours
    
    Args:
        hours: Number of hours to look back (default: 24)
    
    Returns:
        Error summary with counts by category and severity
    """
    orchestrator = get_orchestrator()
    
    if not orchestrator.enable_error_handling or not orchestrator.error_handler:
        return {
            "total_errors": 0,
            "by_category": {},
            "by_severity": {},
            "hours_analyzed": hours,
            "error_handling_available": False
        }
    
    summary = orchestrator.error_handler.get_error_summary(hours=hours)
    summary["hours_analyzed"] = hours
    summary["error_handling_available"] = True
    
    return summary

@router.get("/errors/recent", response_model=RecentErrorsResponse)
async def get_recent_errors(
    limit: int = 50,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    admin: str = Depends(require_admin_user),
):
    """
    Get recent error entries with optional filtering.
    
    Args:
        limit: Maximum number of errors to return (default: 50, max: 200)
        category: Filter by error category (network, rate_limit, validation, etc.)
        severity: Filter by severity level (low, medium, high, critical)
    
    Returns:
        List of recent errors with metadata
    """
    orchestrator = get_orchestrator()
    
    # Cap limit to prevent memory issues
    limit = min(limit, 200)
    
    if not orchestrator.enable_error_handling or not orchestrator.error_handler:
        return RecentErrorsResponse(
            errors=[],
            total=0
        )
    
    error_handler = orchestrator.error_handler
    
    # Get errors from history
    errors = []
    error_count = 0
    
    # Iterate through error history (most recent first)
    for idx, exc in enumerate(reversed(error_handler.error_history)):
        if error_count >= limit:
            break
        
        # Apply filters
        if category and exc.category.value.lower() != category.lower():
            continue
        if severity and exc.severity.value.lower() != severity.lower():
            continue
        
        # Convert exception to RecentError format
        error_entry = RecentError(
            id=f"err_{idx}_{exc.timestamp.strftime('%Y%m%d%H%M%S')}",
            code=exc.error_code or f"ERR_{exc.category.value.upper()}",
            message=str(exc) if len(str(exc)) <= 500 else str(exc)[:500] + "...",
            category=exc.category.value,
            severity=exc.severity.value,
            timestamp=exc.timestamp.isoformat() + "Z",
            retryCount=exc.technical_details.get("retry_count", 0) if exc.technical_details else 0,
            resolved=not exc.retry_able  # If not retry-able, consider it resolved
        )
        errors.append(error_entry)
        error_count += 1
    
    return RecentErrorsResponse(
        errors=errors,
        total=len(error_handler.error_history)
    )
