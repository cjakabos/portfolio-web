"""
Metrics Router - Real-time Observability and Metrics Collection
Replaces mock metrics data with actual metrics collection and aggregation.

Provides:
- Request metrics (count, latency, success rate)
- Orchestration type distribution
- Capability usage tracking
- Recent execution history
- Real-time metrics streaming
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from collections import deque
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["Observability"])


# =============================================================================
# Pydantic Models
# =============================================================================

class LatencyPercentiles(BaseModel):
    p50: float
    p95: float
    p99: float


class OrchestrationTypeMetric(BaseModel):
    name: str
    value: int


class CapabilityUsageMetric(BaseModel):
    name: str
    used: int


class ExecutionRecord(BaseModel):
    timestamp: str
    orchestration_type: str
    capabilities_used: List[str]
    duration_ms: int
    success: bool
    request_id: Optional[str] = None
    user_id: Optional[int] = None


class Metrics(BaseModel):
    totalRequests: int
    successRate: float
    avgLatency: float
    activeOrchestrations: int
    latency: LatencyPercentiles
    orchestrationTypes: List[OrchestrationTypeMetric]
    capabilityUsage: List[CapabilityUsageMetric]
    recentExecutions: List[ExecutionRecord]


class TimeSeriesDataPoint(BaseModel):
    timestamp: str
    value: float


class DetailedMetrics(BaseModel):
    time_range: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    latency_percentiles: LatencyPercentiles
    requests_per_minute: float
    error_rate: float
    orchestration_distribution: Dict[str, int]
    capability_distribution: Dict[str, int]
    time_series: Dict[str, List[TimeSeriesDataPoint]]


# =============================================================================
# Metrics Collector
# =============================================================================

class MetricsCollector:
    """Collects and aggregates real-time metrics."""
    
    def __init__(self, max_history: int = 10000):
        self.max_history = max_history
        self._executions: deque = deque(maxlen=max_history)
        self._lock = asyncio.Lock()
        
        # Counters
        self._total_requests = 0
        self._successful_requests = 0
        self._failed_requests = 0
        
        # Orchestration type counts
        self._orchestration_counts: Dict[str, int] = {
            "workflow": 0,
            "agent_routing": 0,
            "rag_query": 0,
            "ml_pipeline": 0,
            "conversational": 0
        }
        
        # Capability usage counts
        self._capability_counts: Dict[str, int] = {
            "LLM Gen": 0,
            "Vector DB": 0,
            "Code Exec": 0,
            "Web Search": 0,
            "RAG": 0,
            "Tool Invocation": 0,
            "ML Pipeline": 0,
            "Agent Execution": 0,
            "Workflow Execution": 0,
            "Chat Manager": 0
        }
        
        # Active orchestrations
        self._active_orchestrations: Dict[str, datetime] = {}
        
        # Latency tracking
        self._latencies: deque = deque(maxlen=1000)
        
        # Redis client for persistence (optional)
        self._redis_client = None
    
    async def initialize(self):
        """Initialize Redis connection if available."""
        try:
            import redis.asyncio as redis
            self._redis_client = redis.Redis(host='redis', port=6379, db=3)
            await self._redis_client.ping()
            
            # Load persisted metrics
            await self._load_from_redis()
            logger.info("Metrics collector using Redis persistence")
        except Exception as e:
            logger.warning(f"Redis unavailable for metrics, using in-memory: {e}")
    
    async def _load_from_redis(self):
        """Load metrics from Redis."""
        if not self._redis_client:
            return
        
        try:
            # Load counters
            total = await self._redis_client.get("metrics:total_requests")
            if total:
                self._total_requests = int(total)
            
            successful = await self._redis_client.get("metrics:successful_requests")
            if successful:
                self._successful_requests = int(successful)
        except Exception as e:
            logger.error(f"Failed to load metrics from Redis: {e}")
    
    async def _save_to_redis(self):
        """Persist metrics to Redis."""
        if not self._redis_client:
            return
        
        try:
            await self._redis_client.set("metrics:total_requests", self._total_requests)
            await self._redis_client.set("metrics:successful_requests", self._successful_requests)
        except Exception as e:
            logger.error(f"Failed to save metrics to Redis: {e}")
    
    async def record_execution(
        self,
        orchestration_type: str,
        capabilities_used: List[str],
        duration_ms: int,
        success: bool,
        request_id: Optional[str] = None,
        user_id: Optional[int] = None
    ):
        """Record an orchestration execution."""
        async with self._lock:
            now = datetime.utcnow()
            
            execution = {
                "timestamp": now.isoformat() + "Z",
                "orchestration_type": orchestration_type,
                "capabilities_used": capabilities_used,
                "duration_ms": duration_ms,
                "success": success,
                "request_id": request_id,
                "user_id": user_id
            }
            
            self._executions.append(execution)
            self._total_requests += 1
            
            if success:
                self._successful_requests += 1
            else:
                self._failed_requests += 1
            
            # Update orchestration counts
            if orchestration_type in self._orchestration_counts:
                self._orchestration_counts[orchestration_type] += 1
            else:
                self._orchestration_counts[orchestration_type] = 1
            
            # Update capability counts
            for cap in capabilities_used:
                if cap in self._capability_counts:
                    self._capability_counts[cap] += 1
                else:
                    self._capability_counts[cap] = 1
            
            # Track latency
            self._latencies.append(duration_ms)
            
            # Persist periodically
            if self._total_requests % 100 == 0:
                await self._save_to_redis()
    
    def start_orchestration(self, orchestration_id: str):
        """Mark an orchestration as active."""
        self._active_orchestrations[orchestration_id] = datetime.utcnow()
    
    def end_orchestration(self, orchestration_id: str):
        """Mark an orchestration as complete."""
        self._active_orchestrations.pop(orchestration_id, None)
    
    def _calculate_percentiles(self, data: List[float]) -> LatencyPercentiles:
        """Calculate latency percentiles."""
        if not data:
            return LatencyPercentiles(p50=0, p95=0, p99=0)
        
        sorted_data = sorted(data)
        n = len(sorted_data)
        
        p50_idx = int(n * 0.50)
        p95_idx = int(n * 0.95)
        p99_idx = int(n * 0.99)
        
        return LatencyPercentiles(
            p50=sorted_data[min(p50_idx, n - 1)],
            p95=sorted_data[min(p95_idx, n - 1)],
            p99=sorted_data[min(p99_idx, n - 1)]
        )
    
    def get_metrics(self) -> Metrics:
        """Get current aggregated metrics."""
        # Clean up stale active orchestrations (older than 5 minutes)
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        self._active_orchestrations = {
            k: v for k, v in self._active_orchestrations.items()
            if v > cutoff
        }
        
        # Calculate success rate
        success_rate = (
            (self._successful_requests / self._total_requests * 100)
            if self._total_requests > 0 else 100.0
        )
        
        # Calculate average latency
        latencies = list(self._latencies)
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        
        # Get recent executions
        recent = list(self._executions)[-100:]
        recent.reverse()  # Newest first
        
        return Metrics(
            totalRequests=self._total_requests,
            successRate=round(success_rate, 1),
            avgLatency=round(avg_latency, 0),
            activeOrchestrations=len(self._active_orchestrations),
            latency=self._calculate_percentiles(latencies),
            orchestrationTypes=[
                OrchestrationTypeMetric(name=k, value=v)
                for k, v in self._orchestration_counts.items()
                if v > 0
            ],
            capabilityUsage=[
                CapabilityUsageMetric(name=k, used=v)
                for k, v in sorted(self._capability_counts.items(), key=lambda x: x[1], reverse=True)
                if v > 0
            ][:8],
            recentExecutions=[ExecutionRecord(**e) for e in recent[:20]]
        )
    
    def get_detailed_metrics(self, hours: int = 24) -> DetailedMetrics:
        """Get detailed metrics for a time range."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        # Filter executions within time range
        filtered = [
            e for e in self._executions
            if datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None) > cutoff
        ]
        
        if not filtered:
            return DetailedMetrics(
                time_range=f"{hours}h",
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                avg_latency_ms=0,
                latency_percentiles=LatencyPercentiles(p50=0, p95=0, p99=0),
                requests_per_minute=0,
                error_rate=0,
                orchestration_distribution={},
                capability_distribution={},
                time_series={}
            )
        
        # Calculate metrics
        total = len(filtered)
        successful = sum(1 for e in filtered if e["success"])
        failed = total - successful
        
        latencies = [e["duration_ms"] for e in filtered]
        avg_latency = sum(latencies) / len(latencies)
        
        # Distributions
        orch_dist = {}
        cap_dist = {}
        for e in filtered:
            orch_type = e["orchestration_type"]
            orch_dist[orch_type] = orch_dist.get(orch_type, 0) + 1
            
            for cap in e["capabilities_used"]:
                cap_dist[cap] = cap_dist.get(cap, 0) + 1
        
        # Time series (hourly buckets)
        time_series = {"requests": [], "latency": [], "errors": []}
        
        # Group by hour
        hourly_data = {}
        for e in filtered:
            ts = datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
            hour_key = ts.strftime("%Y-%m-%dT%H:00:00Z")
            
            if hour_key not in hourly_data:
                hourly_data[hour_key] = {"count": 0, "latency_sum": 0, "errors": 0}
            
            hourly_data[hour_key]["count"] += 1
            hourly_data[hour_key]["latency_sum"] += e["duration_ms"]
            if not e["success"]:
                hourly_data[hour_key]["errors"] += 1
        
        for hour_key in sorted(hourly_data.keys()):
            data = hourly_data[hour_key]
            time_series["requests"].append(TimeSeriesDataPoint(
                timestamp=hour_key,
                value=data["count"]
            ))
            time_series["latency"].append(TimeSeriesDataPoint(
                timestamp=hour_key,
                value=data["latency_sum"] / data["count"] if data["count"] > 0 else 0
            ))
            time_series["errors"].append(TimeSeriesDataPoint(
                timestamp=hour_key,
                value=data["errors"]
            ))
        
        return DetailedMetrics(
            time_range=f"{hours}h",
            total_requests=total,
            successful_requests=successful,
            failed_requests=failed,
            avg_latency_ms=round(avg_latency, 2),
            latency_percentiles=self._calculate_percentiles(latencies),
            requests_per_minute=total / (hours * 60) if hours > 0 else 0,
            error_rate=round(failed / total * 100, 2) if total > 0 else 0,
            orchestration_distribution=orch_dist,
            capability_distribution=cap_dist,
            time_series=time_series
        )


# Global collector instance
collector = MetricsCollector()


# =============================================================================
# Startup - Initialize collector (NO simulate_traffic)
# =============================================================================

@router.on_event("startup")
async def startup_event():
    """Initialize metrics collector."""
    await collector.initialize()
    logger.info("Metrics collector initialized - recording real traffic only")


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("", response_model=Metrics)
async def get_metrics():
    """
    Get current aggregated metrics.
    
    Returns real-time metrics including:
    - Total requests and success rate
    - Average latency and percentiles
    - Orchestration type distribution
    - Capability usage counts
    - Recent executions
    """
    return collector.get_metrics()


@router.get("/detailed", response_model=DetailedMetrics)
async def get_detailed_metrics(
    hours: int = Query(default=24, ge=1, le=168, description="Hours of history to include")
):
    """
    Get detailed metrics with time series data.
    
    Args:
        hours: Number of hours to include (1-168)
    
    Returns:
        Detailed metrics including time series data
    """
    return collector.get_detailed_metrics(hours)


@router.get("/health")
async def health_check():
    """Check metrics system health."""
    metrics = collector.get_metrics()
    
    return {
        "status": "healthy",
        "service": "metrics",
        "total_requests_tracked": metrics.totalRequests,
        "active_orchestrations": metrics.activeOrchestrations,
        "persistence": "redis" if collector._redis_client else "memory"
    }


@router.post("/reset")
async def reset_metrics():
    """Reset all metrics (admin endpoint)."""
    global collector
    collector = MetricsCollector()
    await collector.initialize()
    
    return {
        "status": "reset",
        "message": "All metrics have been reset"
    }
