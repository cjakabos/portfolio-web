# backend/ai-orchestration-layer/src/core/streaming_manager.py

"""
Streaming Token Management System for AI Orchestration
Implements real-time token streaming patterns from LangGraph course
"""

import asyncio
import json
from typing import AsyncIterator, Any, Dict, List, Optional, Callable, Union
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import time

from langchain_core.messages import BaseMessage, AIMessageChunk
from langchain_core.outputs import LLMResult, Generation
from langchain_core.callbacks import AsyncCallbackHandler
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langgraph.graph import StateGraph
from langchain_ollama import ChatOllama

from core.state import UnifiedState


class StreamEventType(Enum):
    """Types of streaming events"""
    TOKEN = "token"
    CHUNK = "chunk"
    FUNCTION_CALL = "function_call"
    TOOL_START = "tool_start"
    TOOL_END = "tool_end"
    NODE_START = "node_start"
    NODE_END = "node_end"
    ERROR = "error"
    METADATA = "metadata"
    HEARTBEAT = "heartbeat"
    COMPLETE = "complete"


@dataclass
class StreamEvent:
    """Represents a streaming event"""
    event_id: str
    event_type: StreamEventType
    timestamp: datetime
    data: Any
    metadata: Dict[str, Any] = field(default_factory=dict)
    node_name: Optional[str] = None
    chunk_index: Optional[int] = None
    total_chunks: Optional[int] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "metadata": self.metadata,
            "node_name": self.node_name,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks
        }


class TokenStreamHandler(AsyncCallbackHandler):
    """
    Custom callback handler for streaming LLM tokens
    Implements the streaming pattern from LangGraph course
    """
    
    def __init__(self, queue: asyncio.Queue):
        """Initialize with an async queue for streaming"""
        self.queue = queue
        self.token_count = 0
        self.start_time = None
        self.current_response = ""
        self.metadata = {}
    
    async def on_llm_start(
        self, 
        serialized: Dict[str, Any], 
        prompts: List[str], 
        **kwargs
    ) -> None:
        """Called when LLM starts generating"""
        self.start_time = time.time()
        self.token_count = 0
        self.current_response = ""
        
        event = StreamEvent(
            event_id=f"llm_start_{int(time.time()*1000)}",
            event_type=StreamEventType.NODE_START,
            timestamp=datetime.now(),
            data={"status": "starting", "model": serialized.get("name", "unknown")},
            metadata={"prompts_count": len(prompts)}
        )
        await self.queue.put(event.to_dict())
    
    async def on_llm_new_token(self, token: str, **kwargs) -> None:
        """Called for each new token generated"""
        self.token_count += 1
        self.current_response += token
        
        event = StreamEvent(
            event_id=f"token_{self.token_count}",
            event_type=StreamEventType.TOKEN,
            timestamp=datetime.now(),
            data=token,
            chunk_index=self.token_count,
            metadata={
                "token_count": self.token_count,
                "elapsed_time": time.time() - self.start_time if self.start_time else 0
            }
        )
        await self.queue.put(event.to_dict())
    
    async def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Called when LLM finishes generating"""
        total_time = time.time() - self.start_time if self.start_time else 0
        
        event = StreamEvent(
            event_id=f"llm_end_{int(time.time()*1000)}",
            event_type=StreamEventType.NODE_END,
            timestamp=datetime.now(),
            data={"status": "completed", "response": self.current_response},
            metadata={
                "total_tokens": self.token_count,
                "total_time": total_time,
                "tokens_per_second": self.token_count / total_time if total_time > 0 else 0
            }
        )
        await self.queue.put(event.to_dict())
    
    async def on_llm_error(self, error: Exception, **kwargs) -> None:
        """Called when LLM encounters an error"""
        event = StreamEvent(
            event_id=f"error_{int(time.time()*1000)}",
            event_type=StreamEventType.ERROR,
            timestamp=datetime.now(),
            data={"error": str(error), "type": type(error).__name__},
            metadata={"partial_response": self.current_response}
        )
        await self.queue.put(event.to_dict())


class StreamingOrchestrationManager:
    """
    Manages streaming for the entire orchestration pipeline
    Implements streaming patterns from LangGraph course
    """
    
    def __init__(self):
        """Initialize streaming manager"""
        self.active_streams: Dict[str, asyncio.Queue] = {}
        self.stream_handlers: Dict[str, TokenStreamHandler] = {}
        self.stream_metadata: Dict[str, Dict] = {}
        
        # Performance tracking
        self.metrics = {
            "total_tokens_streamed": 0,
            "average_tokens_per_second": 0,
            "active_streams": 0,
            "total_streams_created": 0
        }
    
    async def create_stream(self, stream_id: str) -> asyncio.Queue:
        """Create a new stream for a request"""
        queue = asyncio.Queue()
        handler = TokenStreamHandler(queue)
        
        self.active_streams[stream_id] = queue
        self.stream_handlers[stream_id] = handler
        self.stream_metadata[stream_id] = {
            "created_at": datetime.now(),
            "tokens_sent": 0,
            "events_sent": 0
        }
        
        self.metrics["active_streams"] += 1
        self.metrics["total_streams_created"] += 1
        
        # Send initial event
        event = StreamEvent(
            event_id=f"stream_init_{stream_id}",
            event_type=StreamEventType.METADATA,
            timestamp=datetime.now(),
            data={"stream_id": stream_id, "status": "initialized"},
            metadata={"version": "1.0"}
        )
        await queue.put(event.to_dict())
        
        return queue
    
    async def stream_llm_response(
        self,
        stream_id: str,
        llm: ChatOllama,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Stream LLM response token by token
        
        Args:
            stream_id: Unique stream identifier
            llm: Language model instance
            prompt: User prompt
            system_prompt: Optional system prompt
        
        Returns:
            Complete response text
        """
        if stream_id not in self.active_streams:
            raise ValueError(f"Stream {stream_id} not found")
        
        handler = self.stream_handlers[stream_id]
        
        # Configure streaming
        llm.streaming = True
        llm.callbacks = [handler]
        
        # Prepare messages
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # Generate with streaming
        response = await llm.ainvoke(messages)
        
        # Update metrics
        self.metrics["total_tokens_streamed"] += handler.token_count
        self.stream_metadata[stream_id]["tokens_sent"] += handler.token_count
        
        return response.content if hasattr(response, 'content') else str(response)
    
    async def stream_orchestration_updates(
        self,
        stream_id: str,
        state: UnifiedState,
        graph: StateGraph
    ) -> AsyncIterator[Dict]:
        """
        Stream orchestration execution updates using astream_events
        Implements the pattern from LangGraph course
        """
        if stream_id not in self.active_streams:
            await self.create_stream(stream_id)
        
        queue = self.active_streams[stream_id]
        
        # Stream graph execution events
        async for event in graph.astream_events(state, version="v2"):
            processed_event = await self._process_graph_event(event, stream_id)
            if processed_event:
                await queue.put(processed_event.to_dict())
                yield processed_event.to_dict()
    
    async def _process_graph_event(
        self, 
        event: Dict, 
        stream_id: str
    ) -> Optional[StreamEvent]:
        """Process and transform graph events for streaming"""
        event_type = event.get("event")
        
        if event_type == "on_chain_start":
            # Node execution starting
            return StreamEvent(
                event_id=f"node_start_{int(time.time()*1000)}",
                event_type=StreamEventType.NODE_START,
                timestamp=datetime.now(),
                data={
                    "node": event.get("name", "unknown"),
                    "status": "starting"
                },
                node_name=event.get("name"),
                metadata=event.get("data", {})
            )
        
        elif event_type == "on_chain_end":
            # Node execution completed
            return StreamEvent(
                event_id=f"node_end_{int(time.time()*1000)}",
                event_type=StreamEventType.NODE_END,
                timestamp=datetime.now(),
                data={
                    "node": event.get("name", "unknown"),
                    "status": "completed",
                    "output": event.get("data", {}).get("output")
                },
                node_name=event.get("name"),
                metadata=event.get("data", {})
            )
        
        elif event_type == "on_llm_stream":
            # LLM token stream
            chunk = event.get("data", {}).get("chunk", "")
            if isinstance(chunk, AIMessageChunk):
                chunk = chunk.content
            
            self.stream_metadata[stream_id]["tokens_sent"] += 1
            
            return StreamEvent(
                event_id=f"llm_token_{int(time.time()*1000)}",
                event_type=StreamEventType.TOKEN,
                timestamp=datetime.now(),
                data=chunk,
                chunk_index=self.stream_metadata[stream_id]["tokens_sent"],
                metadata={
                    "model": event.get("metadata", {}).get("model_name"),
                    "run_id": event.get("run_id")
                }
            )
        
        elif event_type == "on_tool_start":
            # Tool execution starting
            return StreamEvent(
                event_id=f"tool_start_{int(time.time()*1000)}",
                event_type=StreamEventType.TOOL_START,
                timestamp=datetime.now(),
                data={
                    "tool": event.get("name", "unknown"),
                    "input": event.get("data", {}).get("input")
                },
                metadata=event.get("metadata", {})
            )
        
        elif event_type == "on_tool_end":
            # Tool execution completed
            return StreamEvent(
                event_id=f"tool_end_{int(time.time()*1000)}",
                event_type=StreamEventType.TOOL_END,
                timestamp=datetime.now(),
                data={
                    "tool": event.get("name", "unknown"),
                    "output": event.get("data", {}).get("output")
                },
                metadata=event.get("metadata", {})
            )
        
        elif event_type == "on_chain_error":
            # Error occurred
            return StreamEvent(
                event_id=f"error_{int(time.time()*1000)}",
                event_type=StreamEventType.ERROR,
                timestamp=datetime.now(),
                data={
                    "error": str(event.get("data", {}).get("error", "Unknown error")),
                    "node": event.get("name")
                },
                metadata=event.get("metadata", {})
            )
        
        return None
    
    async def stream_with_heartbeat(
        self,
        stream_id: str,
        heartbeat_interval: float = 30.0
    ) -> AsyncIterator[Dict]:
        """
        Stream with periodic heartbeat to keep connection alive
        Important for long-running orchestrations
        """
        if stream_id not in self.active_streams:
            raise ValueError(f"Stream {stream_id} not found")
        
        queue = self.active_streams[stream_id]
        last_heartbeat = time.time()
        
        while True:
            try:
                # Check for new events with timeout
                event = await asyncio.wait_for(
                    queue.get(),
                    timeout=heartbeat_interval
                )
                
                yield event
                self.stream_metadata[stream_id]["events_sent"] += 1
                
                # Check if stream is complete
                if event.get("event_type") == StreamEventType.COMPLETE.value:
                    break
                
            except asyncio.TimeoutError:
                # Send heartbeat
                current_time = time.time()
                if current_time - last_heartbeat >= heartbeat_interval:
                    heartbeat = StreamEvent(
                        event_id=f"heartbeat_{int(current_time*1000)}",
                        event_type=StreamEventType.HEARTBEAT,
                        timestamp=datetime.now(),
                        data={"status": "alive"},
                        metadata={
                            "stream_id": stream_id,
                            "events_sent": self.stream_metadata[stream_id]["events_sent"]
                        }
                    )
                    yield heartbeat.to_dict()
                    last_heartbeat = current_time
    
    async def close_stream(self, stream_id: str):
        """Close and cleanup a stream"""
        if stream_id not in self.active_streams:
            return
        
        # Send completion event
        queue = self.active_streams[stream_id]
        complete_event = StreamEvent(
            event_id=f"complete_{stream_id}",
            event_type=StreamEventType.COMPLETE,
            timestamp=datetime.now(),
            data={"status": "stream_complete"},
            metadata={
                "total_events": self.stream_metadata[stream_id]["events_sent"],
                "total_tokens": self.stream_metadata[stream_id]["tokens_sent"],
                "duration": (datetime.now() - self.stream_metadata[stream_id]["created_at"]).total_seconds()
            }
        )
        await queue.put(complete_event.to_dict())
        
        # Cleanup
        del self.active_streams[stream_id]
        del self.stream_handlers[stream_id]
        del self.stream_metadata[stream_id]
        
        self.metrics["active_streams"] -= 1
    
    def get_stream_metrics(self) -> Dict:
        """Get streaming metrics"""
        return {
            **self.metrics,
            "streams": {
                stream_id: {
                    "created_at": meta["created_at"].isoformat(),
                    "tokens_sent": meta["tokens_sent"],
                    "events_sent": meta["events_sent"]
                }
                for stream_id, meta in self.stream_metadata.items()
            }
        }


class ChunkedResponseBuilder:
    """
    Builds responses from streamed chunks
    Handles partial JSON, markdown, and code blocks
    """
    
    def __init__(self):
        self.buffer = ""
        self.chunks = []
        self.in_code_block = False
        self.in_json = False
        self.brace_count = 0
    
    def add_chunk(self, chunk: str) -> Optional[str]:
        """
        Add a chunk and return complete segments if available
        
        Returns:
            Complete segment if available, None otherwise
        """
        self.buffer += chunk
        self.chunks.append(chunk)
        
        # Check for complete JSON objects
        if self._is_json_start(chunk):
            self.in_json = True
            self.brace_count = chunk.count('{') - chunk.count('}')
        elif self.in_json:
            self.brace_count += chunk.count('{') - chunk.count('}')
            if self.brace_count == 0:
                # Complete JSON object
                complete = self.buffer
                self.buffer = ""
                self.in_json = False
                return complete
        
        # Check for code blocks
        if "```" in chunk:
            self.in_code_block = not self.in_code_block
        
        # Return chunks for display (but not parsing) if not in structured format
        if not self.in_json and not self.in_code_block:
            display = self.buffer
            self.buffer = ""
            return display
        
        return None
    
    def _is_json_start(self, chunk: str) -> bool:
        """Check if chunk starts a JSON object"""
        stripped = chunk.strip()
        return stripped.startswith('{') or stripped.startswith('[')
    
    def get_complete_response(self) -> str:
        """Get the complete response from all chunks"""
        return ''.join(self.chunks)
    
    def reset(self):
        """Reset the builder for a new response"""
        self.buffer = ""
        self.chunks = []
        self.in_code_block = False
        self.in_json = False
        self.brace_count = 0


class StreamAggregator:
    """
    Aggregates multiple streams for parallel streaming
    Useful when multiple LLMs or nodes are generating simultaneously
    """
    
    def __init__(self):
        self.streams: Dict[str, AsyncIterator] = {}
        self.buffers: Dict[str, List] = {}
        self.completed: Set[str] = set()
    
    async def add_stream(self, name: str, stream: AsyncIterator):
        """Add a stream to aggregate"""
        self.streams[name] = stream
        self.buffers[name] = []
    
    async def get_next_event(self) -> Optional[tuple[str, Any]]:
        """
        Get next event from any stream
        
        Returns:
            tuple of (stream_name, event) or None if all complete
        """
        if not self.streams:
            return None
        
        # Create tasks for all active streams
        tasks = []
        for name, stream in self.streams.items():
            if name not in self.completed:
                task = asyncio.create_task(self._get_from_stream(name, stream))
                tasks.append(task)
        
        if not tasks:
            return None
        
        # Wait for first to complete
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
        
        # Process completed task
        for task in done:
            result = await task
            if result:
                return result
        
        return None
    
    async def _get_from_stream(self, name: str, stream: AsyncIterator) -> Optional[tuple[str, Any]]:
        """Get next item from a specific stream"""
        try:
            event = await stream.__anext__()
            return (name, event)
        except StopAsyncIteration:
            self.completed.add(name)
            return None
    
    def is_complete(self) -> bool:
        """Check if all streams are complete"""
        return len(self.completed) == len(self.streams)