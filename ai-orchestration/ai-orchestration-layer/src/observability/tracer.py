# ============================================================================
# File: backend/ai-orchestration-layer/src/observability/tracer.py
# ============================================================================

from typing import Dict, Any, Optional
from datetime import datetime
import uuid

class RequestTracer:
    """
    Traces requests through the orchestration layer
    """
    
    def __init__(self):
        self.traces = {}
    
    def start_trace(self, request_id: str) -> str:
        """Start a new trace"""
        trace_id = str(uuid.uuid4())
        
        self.traces[trace_id] = {
            "trace_id": trace_id,
            "request_id": request_id,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
            "duration_ms": None,
            "spans": [],
            "success": None,
            "error": None
        }
        
        return trace_id
    
    def add_span(self, trace_id: str, span_name: str, data: Dict[str, Any]):
        """Add a span to the trace"""
        if trace_id in self.traces:
            self.traces[trace_id]["spans"].append({
                "name": span_name,
                "timestamp": datetime.now().isoformat(),
                "data": data
            })
    
    def end_trace(self, trace_id: str, success: bool, error: Optional[str] = None):
        """End a trace"""
        if trace_id in self.traces:
            trace = self.traces[trace_id]
            end_time = datetime.now()
            start_time = datetime.fromisoformat(trace["start_time"])
            duration = (end_time - start_time).total_seconds() * 1000
            
            trace["end_time"] = end_time.isoformat()
            trace["duration_ms"] = duration
            trace["success"] = success
            trace["error"] = error
    
    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Get trace details"""
        return self.traces.get(trace_id)