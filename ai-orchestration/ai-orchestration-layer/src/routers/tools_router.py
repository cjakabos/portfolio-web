# ============================================================================
# File: backend/ai-orchestration-layer/src/routers/tools_router.py
# TOOLS DISCOVERY AND INVOCATION API
# ============================================================================
# Provides REST endpoints for discovering available AI tools and invoking them.
# Integrates with ToolManager to expose LangChain tools via HTTP.
# ============================================================================

import logging
import time
import json
import inspect
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field

# Configure Router
router = APIRouter(prefix="/tools", tags=["Tools"])
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ToolParameter(BaseModel):
    """Schema for a tool parameter"""
    name: str
    type: str
    description: str
    required: bool
    default: Optional[Any] = None


class ToolInfo(BaseModel):
    """Schema for tool information"""
    name: str
    description: str
    category: str
    parameters: List[ToolParameter]
    examples: Optional[List[str]] = []


class ToolDiscoveryResponse(BaseModel):
    """Response for tool discovery endpoints"""
    tools: List[ToolInfo]
    total: int
    categories: List[str]


class ToolInvocationRequest(BaseModel):
    """Request body for tool invocation"""
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ToolInvocationResponse(BaseModel):
    """Response for tool invocation"""
    tool: str
    success: bool
    result: Any
    latency_ms: int
    error: Optional[str] = None


# ============================================================================
# DEPENDENCY INJECTION
# ============================================================================

_tool_manager = None


def set_tool_manager(tool_manager):
    """Set tool manager instance (called from main.py lifespan)"""
    global _tool_manager
    _tool_manager = tool_manager


def get_tool_manager():
    """Get tool manager or raise 503 if not initialized"""
    if _tool_manager is None:
        raise HTTPException(status_code=503, detail="Tool manager not initialized")
    return _tool_manager


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _get_tool_category(tool) -> str:
    """
    Determine the category of a tool based on its name or attributes.
    Maps tools to their service categories.
    """
    tool_name = tool.name.lower()
    
    # Check for explicit category attribute
    if hasattr(tool, 'category'):
        return tool.category
    
    # Categorize by naming patterns
    if any(kw in tool_name for kw in ['user', 'item', 'cart', 'order', 'note', 'room']):
        return 'cloudapp'
    elif any(kw in tool_name for kw in ['pet', 'employee', 'schedule', 'customer']):
        return 'petstore'
    elif any(kw in tool_name for kw in ['vehicle', 'car', 'make', 'model']):
        return 'vehicles'
    elif any(kw in tool_name for kw in ['segment', 'predict', 'ml', 'diagnostic']):
        return 'ml'
    elif any(kw in tool_name for kw in ['proxy', 'http', 'request']):
        return 'proxy'
    else:
        return 'utility'


def _extract_parameters_from_tool(tool) -> List[ToolParameter]:
    """
    Extract parameter schema from a LangChain tool.
    Handles both Pydantic schema and function signature inspection.
    """
    parameters = []
    
    try:
        # Method 1: Try to get from args_schema (Pydantic model)
        if hasattr(tool, 'args_schema') and tool.args_schema is not None:
            schema = tool.args_schema
            if hasattr(schema, 'model_fields'):
                # Pydantic v2
                for field_name, field_info in schema.model_fields.items():
                    param_type = 'string'  # Default
                    if hasattr(field_info, 'annotation'):
                        annotation = field_info.annotation
                        if annotation == int:
                            param_type = 'integer'
                        elif annotation == float:
                            param_type = 'number'
                        elif annotation == bool:
                            param_type = 'boolean'
                        elif annotation == list or (hasattr(annotation, '__origin__') and annotation.__origin__ == list):
                            param_type = 'array'
                        elif annotation == dict or (hasattr(annotation, '__origin__') and annotation.__origin__ == dict):
                            param_type = 'object'
                    
                    parameters.append(ToolParameter(
                        name=field_name,
                        type=param_type,
                        description=field_info.description or f"Parameter: {field_name}",
                        required=field_info.is_required() if hasattr(field_info, 'is_required') else True,
                        default=field_info.default if field_info.default is not None else None
                    ))
                return parameters
            elif hasattr(schema, '__fields__'):
                # Pydantic v1
                for field_name, field in schema.__fields__.items():
                    param_type = 'string'
                    if field.outer_type_ == int:
                        param_type = 'integer'
                    elif field.outer_type_ == float:
                        param_type = 'number'
                    elif field.outer_type_ == bool:
                        param_type = 'boolean'
                    
                    parameters.append(ToolParameter(
                        name=field_name,
                        type=param_type,
                        description=field.field_info.description or f"Parameter: {field_name}",
                        required=field.required,
                        default=field.default if field.default is not None else None
                    ))
                return parameters
        
        # Method 2: Inspect function signature
        func = tool.func if hasattr(tool, 'func') else (tool._run if hasattr(tool, '_run') else None)
        if func is not None:
            sig = inspect.signature(func)
            for param_name, param in sig.parameters.items():
                if param_name in ['self', 'cls', 'run_manager', 'kwargs', 'args']:
                    continue
                
                param_type = 'string'
                if param.annotation != inspect.Parameter.empty:
                    if param.annotation == int:
                        param_type = 'integer'
                    elif param.annotation == float:
                        param_type = 'number'
                    elif param.annotation == bool:
                        param_type = 'boolean'
                    elif param.annotation == list:
                        param_type = 'array'
                    elif param.annotation == dict:
                        param_type = 'object'
                
                default_value = None if param.default == inspect.Parameter.empty else param.default
                required = param.default == inspect.Parameter.empty
                
                parameters.append(ToolParameter(
                    name=param_name,
                    type=param_type,
                    description=f"Parameter: {param_name}",
                    required=required,
                    default=default_value
                ))
            return parameters
        
        # Method 3: Parse from description string (fallback)
        description = tool.description or ""
        # Simple heuristic: look for parameter patterns in description
        # This is a fallback and may not always work
        
    except Exception as e:
        logger.warning(f"Failed to extract parameters for tool {tool.name}: {e}")
    
    return parameters


def _generate_examples(tool) -> List[str]:
    """Generate usage examples for a tool based on its parameters"""
    examples = []
    tool_name = tool.name
    
    # Generate a basic example
    example = f"{tool_name}("
    params = _extract_parameters_from_tool(tool)
    param_strs = []
    for param in params[:3]:  # Limit to first 3 params for brevity
        if param.type == 'string':
            param_strs.append(f'{param.name}="example"')
        elif param.type == 'integer':
            param_strs.append(f'{param.name}=1')
        elif param.type == 'number':
            param_strs.append(f'{param.name}=1.0')
        elif param.type == 'boolean':
            param_strs.append(f'{param.name}=True')
    example += ", ".join(param_strs) + ")"
    examples.append(example)
    
    return examples


def _tool_to_info(tool) -> ToolInfo:
    """Convert a LangChain tool to ToolInfo schema"""
    return ToolInfo(
        name=tool.name,
        description=tool.description or f"Tool: {tool.name}",
        category=_get_tool_category(tool),
        parameters=_extract_parameters_from_tool(tool),
        examples=_generate_examples(tool)
    )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=ToolDiscoveryResponse)
async def discover_tools():
    """
    Discover all available tools in the orchestration layer.
    
    Returns a list of all registered tools with their metadata,
    parameters, and categorization.
    """
    tool_manager = get_tool_manager()
    
    try:
        all_tools = tool_manager.get_all_tools()
        tools_info = [_tool_to_info(tool) for tool in all_tools]
        
        # Extract unique categories
        categories = list(set(tool.category for tool in tools_info))
        categories.sort()
        
        logger.info(f"Discovered {len(tools_info)} tools in {len(categories)} categories")
        
        return ToolDiscoveryResponse(
            tools=tools_info,
            total=len(tools_info),
            categories=categories
        )
    except Exception as e:
        logger.error(f"Failed to discover tools: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to discover tools: {str(e)}")


@router.get("/category/{category}", response_model=ToolDiscoveryResponse)
async def get_tools_by_category(category: str):
    """
    Get tools filtered by category.
    
    Args:
        category: Tool category (cloudapp, petstore, vehicles, ml, proxy, utility)
    
    Returns:
        List of tools in the specified category
    """
    tool_manager = get_tool_manager()
    
    try:
        all_tools = tool_manager.get_all_tools()
        tools_info = [_tool_to_info(tool) for tool in all_tools]
        
        # Filter by category (case-insensitive)
        category_lower = category.lower()
        filtered_tools = [t for t in tools_info if t.category.lower() == category_lower]
        
        if not filtered_tools:
            # Check if category exists
            all_categories = list(set(tool.category for tool in tools_info))
            if category_lower not in [c.lower() for c in all_categories]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Category '{category}' not found. Available: {all_categories}"
                )
        
        return ToolDiscoveryResponse(
            tools=filtered_tools,
            total=len(filtered_tools),
            categories=[category]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tools by category: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get tools: {str(e)}")


@router.get("/{tool_name}", response_model=ToolInfo)
async def get_tool_info(tool_name: str):
    """
    Get detailed information about a specific tool.
    
    Args:
        tool_name: Name of the tool
    
    Returns:
        Tool information including parameters and examples
    """
    tool_manager = get_tool_manager()
    
    tool = tool_manager.get_tool_by_name(tool_name)
    if not tool:
        # Try case-insensitive search
        all_tools = tool_manager.get_all_tools()
        for t in all_tools:
            if t.name.lower() == tool_name.lower():
                tool = t
                break
    
    if not tool:
        available_tools = [t.name for t in tool_manager.get_all_tools()]
        raise HTTPException(
            status_code=404,
            detail=f"Tool '{tool_name}' not found. Available tools: {available_tools[:10]}..."
        )
    
    return _tool_to_info(tool)


@router.post("/{tool_name}/invoke", response_model=ToolInvocationResponse)
async def invoke_tool(tool_name: str, request: ToolInvocationRequest = Body(...)):
    """
    Invoke a tool with the provided parameters.
    
    Args:
        tool_name: Name of the tool to invoke
        request: Tool invocation request with parameters
    
    Returns:
        Tool invocation result
    """
    tool_manager = get_tool_manager()
    start_time = time.time()
    
    # Find the tool
    tool = tool_manager.get_tool_by_name(tool_name)
    if not tool:
        # Try case-insensitive search
        all_tools = tool_manager.get_all_tools()
        for t in all_tools:
            if t.name.lower() == tool_name.lower():
                tool = t
                break
    
    if not tool:
        raise HTTPException(
            status_code=404,
            detail=f"Tool '{tool_name}' not found"
        )
    
    try:
        logger.info(f"Invoking tool '{tool_name}' with params: {request.parameters}")
        
        # Invoke the tool (handle both sync and async tools)
        if hasattr(tool, 'ainvoke'):
            # Async tool
            result = await tool.ainvoke(request.parameters)
        elif hasattr(tool, 'invoke'):
            # Sync tool wrapped
            result = tool.invoke(request.parameters)
        elif hasattr(tool, '_arun'):
            # LangChain async run
            result = await tool._arun(**request.parameters)
        elif hasattr(tool, '_run'):
            # LangChain sync run
            result = tool._run(**request.parameters)
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Tool '{tool_name}' does not have a callable method"
            )
        
        # Parse result if it's a JSON string
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                pass  # Keep as string
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        logger.info(f"Tool '{tool_name}' completed in {latency_ms}ms")
        
        return ToolInvocationResponse(
            tool=tool_name,
            success=True,
            result=result,
            latency_ms=latency_ms,
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(f"Tool '{tool_name}' invocation failed: {e}", exc_info=True)
        
        return ToolInvocationResponse(
            tool=tool_name,
            success=False,
            result=None,
            latency_ms=latency_ms,
            error=str(e)
        )


@router.get("/stats/summary")
async def get_tools_stats():
    """
    Get statistics about available tools.
    
    Returns:
        Tool count by category and overall statistics
    """
    tool_manager = get_tool_manager()
    
    try:
        counts = tool_manager.get_tool_count()
        all_tools = tool_manager.get_all_tools()
        
        # Build category stats
        category_stats = {}
        for tool in all_tools:
            cat = _get_tool_category(tool)
            if cat not in category_stats:
                category_stats[cat] = {"count": 0, "tools": []}
            category_stats[cat]["count"] += 1
            category_stats[cat]["tools"].append(tool.name)
        
        return {
            "total_tools": counts.get("total", len(all_tools)),
            "by_service": {
                "cloudapp": counts.get("cloudapp", 0),
                "petstore": counts.get("petstore", 0),
                "vehicles": counts.get("vehicles", 0),
                "ml": counts.get("ml", 0),
                "proxy": counts.get("proxy", 0)
            },
            "by_category": category_stats,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        logger.error(f"Failed to get tool stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get tool stats: {str(e)}")


@router.get("/health")
async def tools_health_check():
    """
    Check health of the tools system.
    """
    try:
        tool_manager = get_tool_manager()
        tool_count = len(tool_manager.get_all_tools())
        
        return {
            "status": "healthy",
            "service": "tools",
            "total_tools": tool_count,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "tools",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
