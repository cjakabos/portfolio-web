# File: backend/ai-orchestration-layer/src/observability/metrics_collector.py
# ============================================================================

from typing import Dict, List, Any
from datetime import datetime, timedelta
from collections import defaultdict
import json

class MetricsCollector:
    """
    Collects and aggregates metrics for observability
    """
    
    def __init__(self):
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.orchestration_counts = defaultdict(int)
        self.capability_usage = defaultdict(int)
        self.latencies = []
        self.recent_executions = []
        self.max_recent = 100
    
    def record_request(self, orchestration_type: str, capabilities_used: List[str], 
                      duration_ms: int, success: bool):
        """Record a request execution"""
        self.requests_total += 1
        
        if success:
            self.requests_success += 1
        else:
            self.requests_failed += 1
        
        self.orchestration_counts[orchestration_type] += 1
        
        for capability in capabilities_used:
            self.capability_usage[capability] += 1
        
        self.latencies.append(duration_ms)
        if len(self.latencies) > 1000:
            self.latencies = self.latencies[-1000:]
        
        self.recent_executions.append({
            "timestamp": datetime.now().isoformat(),
            "orchestration_type": orchestration_type,
            "capabilities_used": capabilities_used,
            "duration_ms": duration_ms,
            "success": success
        })
        
        if len(self.recent_executions) > self.max_recent:
            self.recent_executions = self.recent_executions[-self.max_recent:]
    
    def record_error(self, request_id: str, error_type: str, duration_ms: int):
        """Record an error"""
        self.requests_total += 1
        self.requests_failed += 1
        
        self.recent_executions.append({
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "error_type": error_type,
            "duration_ms": duration_ms,
            "success": False
        })
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current metrics snapshot"""
        avg_latency = sum(self.latencies) / len(self.latencies) if self.latencies else 0
        success_rate = (self.requests_success / self.requests_total * 100) if self.requests_total > 0 else 0
        
        # Count active orchestrations (recent in last 5 minutes)
        five_min_ago = datetime.now() - timedelta(minutes=5)
        active_count = sum(1 for exec in self.recent_executions 
                          if datetime.fromisoformat(exec["timestamp"]) > five_min_ago)
        
        return {
            "totalRequests": self.requests_total,
            "successRate": round(success_rate, 1),
            "avgLatency": int(avg_latency),
            "activeOrchestrations": active_count,
            "orchestrationTypes": [
                {"name": k.replace("_", " ").title(), "value": v}
                for k, v in self.orchestration_counts.items()
            ],
            "capabilityUsage": [
                {"name": k.title(), "used": v, "available": 500}
                for k, v in self.capability_usage.items()
            ],
            "recentExecutions": self.recent_executions[-20:]
        }
    
    def get_history(self) -> Dict[str, Any]:
        """Get historical metrics"""
        # Generate time series data
        now = datetime.now()
        latency_data = []
        
        for i in range(6):
            time = (now - timedelta(minutes=5*i)).strftime("%H:%M")
            # Simulate some variation
            base_latency = sum(self.latencies[-10:]) / 10 if self.latencies else 1800
            latency_data.insert(0, {
                "time": time,
                "latency": int(base_latency + (i % 3 - 1) * 200)
            })
        
        return {
            "latencyData": latency_data,
            "requestsOverTime": [],
            "errorRate": []
        }