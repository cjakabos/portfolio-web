# backend/ai-orchestration-layer/src/core/parallel_executor.py

"""
Parallel Execution System for AI Orchestration
Implements concurrent node execution patterns from LangGraph course
"""

import asyncio
from typing import Any, Dict, List, Optional, Set, Tuple, Callable
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from langgraph.graph import StateGraph, END
from langgraph.types import Send
from langchain_core.runnables import RunnableConfig

from core.state import UnifiedState, OrchestrationType


class ParallelStrategy(Enum):
    """Strategies for parallel execution"""
    ALL = "all"  # Execute all nodes in parallel
    RACE = "race"  # Return when first completes (race condition)
    THRESHOLD = "threshold"  # Return when N nodes complete
    TIMEOUT = "timeout"  # Execute with timeout, return what completes
    ADAPTIVE = "adaptive"  # Dynamically adjust based on load


@dataclass
class ParallelTask:
    """Represents a task that can be executed in parallel"""
    task_id: str
    node_name: str
    function: Callable
    dependencies: List[str] = field(default_factory=list)
    priority: int = 0
    timeout: Optional[float] = None
    can_fail: bool = False
    retry_count: int = 0
    result: Optional[Any] = None
    error: Optional[Exception] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def duration(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None


class ParallelExecutionManager:
    """
    Manages parallel execution of orchestration nodes
    Implements patterns from LangGraph course for concurrent processing
    """
    
    def __init__(self, max_workers: int = 10):
        """
        Initialize parallel execution manager
        
        Args:
            max_workers: Maximum number of parallel workers
        """
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.running_tasks: Dict[str, ParallelTask] = {}
        self.completed_tasks: List[ParallelTask] = []
        self.task_dependencies: Dict[str, Set[str]] = {}
        
        # Performance metrics
        self.metrics = {
            "total_parallel_executions": 0,
            "average_parallel_speedup": 0,
            "max_concurrent_tasks": 0,
            "task_failures": 0
        }
    
    async def execute_parallel_nodes(
        self,
        state: UnifiedState,
        nodes: List[Tuple[str, Callable]],
        strategy: ParallelStrategy = ParallelStrategy.ALL,
        timeout: Optional[float] = None,
        threshold: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute multiple nodes in parallel
        
        Args:
            state: Current orchestration state
            nodes: List of (node_name, function) tuples to execute
            strategy: Execution strategy
            timeout: Overall timeout for parallel execution
            threshold: Number of nodes that must complete (for THRESHOLD strategy)
        
        Returns:
            Dictionary of node results
        """
        start_time = time.time()
        tasks = []
        results = {}
        
        # Create tasks
        for node_name, func in nodes:
            task = ParallelTask(
                task_id=f"{state['request_id']}_{node_name}",
                node_name=node_name,
                function=func,
                timeout=timeout
            )
            tasks.append(task)
            self.running_tasks[task.task_id] = task
        
        # Log parallel execution start
        state["logs"].append(f"Starting parallel execution of {len(tasks)} nodes: {[t.node_name for t in tasks]}")
        
        # Execute based on strategy
        if strategy == ParallelStrategy.ALL:
            results = await self._execute_all(state, tasks)
            
        elif strategy == ParallelStrategy.RACE:
            results = await self._execute_race(state, tasks)
            
        elif strategy == ParallelStrategy.THRESHOLD:
            if not threshold:
                threshold = len(tasks) // 2 + 1  # Default to majority
            results = await self._execute_threshold(state, tasks, threshold)
            
        elif strategy == ParallelStrategy.TIMEOUT:
            results = await self._execute_with_timeout(state, tasks, timeout or 30)
            
        elif strategy == ParallelStrategy.ADAPTIVE:
            results = await self._execute_adaptive(state, tasks)
        
        # Calculate performance metrics
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Estimate sequential time (sum of individual task durations)
        sequential_time = sum(task.duration or 0 for task in tasks)
        speedup = sequential_time / execution_time if execution_time > 0 else 1
        
        # Update metrics
        self.metrics["total_parallel_executions"] += 1
        self.metrics["average_parallel_speedup"] = (
            (self.metrics["average_parallel_speedup"] * (self.metrics["total_parallel_executions"] - 1) + speedup)
            / self.metrics["total_parallel_executions"]
        )
        self.metrics["max_concurrent_tasks"] = max(self.metrics["max_concurrent_tasks"], len(tasks))
        
        # Log results
        state["logs"].append(
            f"Parallel execution completed: {len(results)}/{len(tasks)} nodes, "
            f"Time: {execution_time:.2f}s, Speedup: {speedup:.2f}x"
        )
        
        # Update state metrics
        state["metrics"]["parallel_execution_time"] = execution_time
        state["metrics"]["parallel_speedup"] = speedup
        state["metrics"]["parallel_nodes_completed"] = len(results)
        
        return results
    
    async def _execute_all(self, state: UnifiedState, tasks: List[ParallelTask]) -> Dict[str, Any]:
        """Execute all tasks in parallel and wait for all to complete"""
        results = {}
        
        # Create async tasks
        async_tasks = []
        for task in tasks:
            async_tasks.append(self._execute_single_task(state, task))
        
        # Wait for all to complete
        completed = await asyncio.gather(*async_tasks, return_exceptions=True)
        
        # Process results
        for task, result in zip(tasks, completed):
            if isinstance(result, Exception):
                task.error = result
                self.metrics["task_failures"] += 1
                if not task.can_fail:
                    raise result
            else:
                task.result = result
                results[task.node_name] = result
            
            self.completed_tasks.append(task)
            del self.running_tasks[task.task_id]
        
        return results
    
    async def _execute_race(self, state: UnifiedState, tasks: List[ParallelTask]) -> Dict[str, Any]:
        """Execute tasks and return when first completes successfully"""
        async_tasks = []
        for task in tasks:
            async_tasks.append(self._execute_single_task(state, task))
        
        # Use asyncio.as_completed to get results as they finish
        for coro in asyncio.as_completed(async_tasks):
            try:
                result = await coro
                # Return first successful result
                for task in tasks:
                    if task.result is not None:
                        return {task.node_name: task.result}
            except Exception as e:
                continue  # Try next task
        
        raise Exception("All tasks failed in race execution")
    
    async def _execute_threshold(
        self, 
        state: UnifiedState, 
        tasks: List[ParallelTask], 
        threshold: int
    ) -> Dict[str, Any]:
        """Execute tasks and return when threshold number complete"""
        results = {}
        completed_count = 0
        
        async_tasks = []
        for task in tasks:
            async_tasks.append(self._execute_single_task(state, task))
        
        # Process as they complete
        for coro in asyncio.as_completed(async_tasks):
            try:
                result = await coro
                for task in tasks:
                    if task.result is not None and task.node_name not in results:
                        results[task.node_name] = task.result
                        completed_count += 1
                        
                        if completed_count >= threshold:
                            # Cancel remaining tasks
                            for remaining in async_tasks:
                                if not remaining.done():
                                    remaining.cancel()
                            return results
            except Exception:
                continue
        
        return results
    
    async def _execute_with_timeout(
        self,
        state: UnifiedState,
        tasks: List[ParallelTask],
        timeout: float
    ) -> Dict[str, Any]:
        """Execute tasks with timeout, return whatever completes"""
        results = {}
        
        async_tasks = []
        for task in tasks:
            task.timeout = timeout
            async_tasks.append(self._execute_single_task(state, task))
        
        # Wait with timeout
        done, pending = await asyncio.wait(
            async_tasks,
            timeout=timeout,
            return_when=asyncio.ALL_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
        
        # Process completed tasks
        for task_future in done:
            try:
                result = await task_future
                for task in tasks:
                    if task.result is not None:
                        results[task.node_name] = task.result
            except Exception:
                continue
        
        return results
    
    async def _execute_adaptive(self, state: UnifiedState, tasks: List[ParallelTask]) -> Dict[str, Any]:
        """
        Adaptively execute tasks based on system load and task characteristics
        Uses dynamic batching and priority scheduling
        """
        results = {}
        
        # Sort tasks by priority
        tasks.sort(key=lambda x: x.priority, reverse=True)
        
        # Determine optimal batch size based on current load
        system_load = self._get_system_load()
        batch_size = self._calculate_optimal_batch_size(system_load, len(tasks))
        
        # Execute in batches
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            batch_results = await self._execute_all(state, batch)
            results.update(batch_results)
            
            # Adaptive adjustment between batches
            if self._should_adjust_batch_size(batch):
                batch_size = self._recalculate_batch_size(batch_size, batch)
        
        return results
    
    async def _execute_single_task(self, state: UnifiedState, task: ParallelTask) -> Any:
        """Execute a single task with error handling and retry logic"""
        task.start_time = datetime.now()
        
        try:
            # Execute the task function
            if asyncio.iscoroutinefunction(task.function):
                if task.timeout:
                    result = await asyncio.wait_for(
                        task.function(state),
                        timeout=task.timeout
                    )
                else:
                    result = await task.function(state)
            else:
                # Run sync function in executor
                loop = asyncio.get_event_loop()
                if task.timeout:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(self.executor, task.function, state),
                        timeout=task.timeout
                    )
                else:
                    result = await loop.run_in_executor(self.executor, task.function, state)
            
            task.result = result
            task.end_time = datetime.now()
            return result
            
        except asyncio.TimeoutError:
            task.error = Exception(f"Task {task.node_name} timed out after {task.timeout}s")
            task.end_time = datetime.now()
            
            if task.retry_count < 3 and task.can_fail:
                task.retry_count += 1
                return await self._execute_single_task(state, task)
            
            if not task.can_fail:
                raise task.error
            return None
            
        except Exception as e:
            task.error = e
            task.end_time = datetime.now()
            
            if task.retry_count < 3 and task.can_fail:
                task.retry_count += 1
                await asyncio.sleep(2 ** task.retry_count)  # Exponential backoff
                return await self._execute_single_task(state, task)
            
            if not task.can_fail:
                raise
            return None
    
    def _get_system_load(self) -> float:
        """Get current system load (0-1)"""
        # Simplified load calculation
        active_tasks = len(self.running_tasks)
        return min(active_tasks / self.max_workers, 1.0)
    
    def _calculate_optimal_batch_size(self, load: float, total_tasks: int) -> int:
        """Calculate optimal batch size based on load"""
        # Higher load = smaller batches
        if load > 0.8:
            return max(1, self.max_workers // 4)
        elif load > 0.5:
            return max(2, self.max_workers // 2)
        else:
            return min(total_tasks, self.max_workers)
    
    def _should_adjust_batch_size(self, batch: List[ParallelTask]) -> bool:
        """Determine if batch size should be adjusted"""
        # Check failure rate
        failures = sum(1 for task in batch if task.error is not None)
        failure_rate = failures / len(batch) if batch else 0
        return failure_rate > 0.3
    
    def _recalculate_batch_size(self, current_size: int, batch: List[ParallelTask]) -> int:
        """Recalculate batch size based on performance"""
        avg_duration = sum(t.duration or 0 for t in batch) / len(batch)
        
        if avg_duration > 10:  # Long-running tasks
            return max(1, current_size // 2)
        elif avg_duration < 1:  # Quick tasks
            return min(self.max_workers, current_size * 2)
        return current_size
    
    def create_parallel_branch(
        self,
        nodes: List[str],
        join_strategy: str = "all"
    ) -> Callable:
        """
        Create a parallel branch function for LangGraph
        
        Args:
            nodes: List of node names to execute in parallel
            join_strategy: How to join results ("all", "any", "majority")
        
        Returns:
            Function that can be used as a node in LangGraph
        """
        async def parallel_branch(state: UnifiedState) -> List[Send]:
            """Execute parallel branch and send results to next nodes"""
            sends = []
            
            for node in nodes:
                # Create Send object for each parallel node
                sends.append(Send(node, state))
            
            return sends
        
        return parallel_branch


class ParallelOrchestrationPatterns:
    """
    Common parallel orchestration patterns based on LangGraph course
    """
    
    @staticmethod
    def map_reduce_pattern(
        mapper_func: Callable,
        reducer_func: Callable,
        data_chunks: List[Any]
    ) -> Callable:
        """
        Implement map-reduce pattern for data processing
        
        Args:
            mapper_func: Function to apply to each chunk
            reducer_func: Function to combine results
            data_chunks: Data split into chunks
        """
        async def map_reduce(state: UnifiedState) -> UnifiedState:
            manager = ParallelExecutionManager()
            
            # Map phase - process chunks in parallel
            map_tasks = []
            for i, chunk in enumerate(data_chunks):
                async def process_chunk(s, chunk_data=chunk):
                    return mapper_func(chunk_data)
                
                map_tasks.append((f"map_{i}", process_chunk))
            
            map_results = await manager.execute_parallel_nodes(
                state, map_tasks, ParallelStrategy.ALL
            )
            
            # Reduce phase - combine results
            reduced_result = reducer_func(list(map_results.values()))
            
            state["intermediate_results"]["map_reduce_result"] = reduced_result
            return state
        
        return map_reduce
    
    @staticmethod
    def scatter_gather_pattern(
        scatter_nodes: List[str],
        gather_func: Callable
    ) -> Callable:
        """
        Scatter work to multiple nodes, then gather results
        
        Args:
            scatter_nodes: Nodes to scatter work to
            gather_func: Function to gather and combine results
        """
        async def scatter_gather(state: UnifiedState) -> UnifiedState:
            manager = ParallelExecutionManager()
            
            # Scatter phase
            scatter_tasks = []
            for node in scatter_nodes:
                # Each node processes the full state independently
                scatter_tasks.append((node, lambda s: s))
            
            results = await manager.execute_parallel_nodes(
                state, scatter_tasks, ParallelStrategy.ALL
            )
            
            # Gather phase
            gathered = gather_func(results)
            state["intermediate_results"]["gathered_results"] = gathered
            
            return state
        
        return scatter_gather
    
    @staticmethod
    def fork_join_pattern(
        fork_condition: Callable,
        branches: Dict[str, List[Callable]],
        join_func: Callable
    ) -> Callable:
        """
        Fork execution based on condition, execute branches in parallel, then join
        
        Args:
            fork_condition: Function to determine which branches to execute
            branches: Dictionary of branch_name -> list of functions
            join_func: Function to join branch results
        """
        async def fork_join(state: UnifiedState) -> UnifiedState:
            manager = ParallelExecutionManager()
            
            # Determine which branches to execute
            active_branches = fork_condition(state)
            
            # Execute branches in parallel
            branch_tasks = []
            for branch_name in active_branches:
                if branch_name in branches:
                    # Create composite function for branch
                    async def execute_branch(s, funcs=branches[branch_name]):
                        result = s
                        for func in funcs:
                            result = await func(result) if asyncio.iscoroutinefunction(func) else func(result)
                        return result
                    
                    branch_tasks.append((branch_name, execute_branch))
            
            # Execute all branches in parallel
            branch_results = await manager.execute_parallel_nodes(
                state, branch_tasks, ParallelStrategy.ALL
            )
            
            # Join results
            joined_state = join_func(state, branch_results)
            
            return joined_state
        
        return fork_join
    
    @staticmethod
    def pipeline_with_parallelism(
        stages: List[List[Callable]]
    ) -> Callable:
        """
        Execute pipeline where each stage can have parallel tasks
        
        Args:
            stages: List of stages, each stage is a list of parallel tasks
        """
        async def pipeline(state: UnifiedState) -> UnifiedState:
            manager = ParallelExecutionManager()
            
            for stage_idx, stage_tasks in enumerate(stages):
                # Execute all tasks in this stage in parallel
                parallel_tasks = [
                    (f"stage_{stage_idx}_task_{i}", task)
                    for i, task in enumerate(stage_tasks)
                ]
                
                results = await manager.execute_parallel_nodes(
                    state, parallel_tasks, ParallelStrategy.ALL
                )
                
                # Update state with stage results
                state["intermediate_results"][f"stage_{stage_idx}"] = results
                
                # Pass state to next stage
                state["execution_path"].append(f"stage_{stage_idx}_completed")
            
            return state
        
        return pipeline