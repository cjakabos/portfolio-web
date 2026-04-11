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
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Body, Request, Depends
from core.app_state import AIControlPlaneState, get_ai_control_plane_state
from services.downstream_headers import extract_downstream_headers
from services.tool_catalog import (
    OllamaStatusResponse,
    ToolDiscoveryResponse,
    ToolInfo,
    ToolInvocationRequest,
    ToolInvocationResponse,
    get_tool_category,
    tool_to_info,
)
from tools.http_client import HTTPClient

# Configure Router
router = APIRouter(prefix="/tools", tags=["Tools"])
logger = logging.getLogger(__name__)

def _require_tool_manager(state: AIControlPlaneState):
    if state.tool_manager is None:
        raise HTTPException(status_code=503, detail="Tool manager not initialized")
    return state.tool_manager


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("", response_model=ToolDiscoveryResponse)
async def discover_tools(state: AIControlPlaneState = Depends(get_ai_control_plane_state)):
    """
    Discover all available tools in the orchestration layer.
    
    Returns a list of all registered tools with their metadata,
    parameters, and categorization.
    """
    tool_manager = _require_tool_manager(state)
    
    try:
        all_tools = tool_manager.get_all_tools()
        tools_info = [tool_to_info(tool) for tool in all_tools]
        
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


@router.get("/ollama-status", response_model=OllamaStatusResponse)
async def get_ollama_status():
    """
    Check Ollama connectivity and available models.
    Used by the frontend to show clear error messages when Ollama is offline.
    """
    from core.llm_manager import LLMManager

    try:
        llm_manager = LLMManager.get_instance()
        models, connected, error_msg = await llm_manager.fetch_available_models()

        if not connected:
            return OllamaStatusResponse(
                connected=False,
                error=error_msg or "connection_failed",
                models=[]
            )

        model_names = [m.name for m in models]
        chat_models = [m for m in model_names if "embed" not in m.lower()]

        if not chat_models:
            return OllamaStatusResponse(
                connected=True,
                error="no_models",
                models=model_names
            )

        return OllamaStatusResponse(
            connected=True,
            error=None,
            models=model_names
        )

    except Exception as e:
        logger.error(f"Failed to check Ollama status: {e}")
        return OllamaStatusResponse(
            connected=False,
            error="connection_failed",
            models=[]
        )


@router.get("/category/{category}", response_model=ToolDiscoveryResponse)
async def get_tools_by_category(
    category: str,
    state: AIControlPlaneState = Depends(get_ai_control_plane_state),
):
    """
    Get tools filtered by category.
    
    Args:
        category: Tool category (cloudapp, petstore, vehicles, ml, proxy, utility)
    
    Returns:
        List of tools in the specified category
    """
    tool_manager = _require_tool_manager(state)
    
    try:
        all_tools = tool_manager.get_all_tools()
        tools_info = [tool_to_info(tool) for tool in all_tools]
        
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
async def get_tool_info(
    tool_name: str,
    state: AIControlPlaneState = Depends(get_ai_control_plane_state),
):
    """
    Get detailed information about a specific tool.
    
    Args:
        tool_name: Name of the tool
    
    Returns:
        Tool information including parameters and examples
    """
    tool_manager = _require_tool_manager(state)
    
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
    
    return tool_to_info(tool)


@router.post("/{tool_name}/invoke", response_model=ToolInvocationResponse)
async def invoke_tool(
    tool_name: str,
    request: Request,
    body: ToolInvocationRequest = Body(...),
    state: AIControlPlaneState = Depends(get_ai_control_plane_state),
):
    """
    Invoke a tool with the provided parameters.
    
    Args:
        tool_name: Name of the tool to invoke
        request: Tool invocation request with parameters
    
    Returns:
        Tool invocation result
    """
    tool_manager = _require_tool_manager(state)
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
    
    header_ctx_token = HTTPClient.set_request_context_headers(extract_downstream_headers(request))

    try:
        logger.info(f"Invoking tool '{tool_name}' with params: {body.parameters}")
        
        # Invoke the tool (handle both sync and async tools)
        if hasattr(tool, 'ainvoke'):
            # Async tool
            result = await tool.ainvoke(body.parameters)
        elif hasattr(tool, 'invoke'):
            # Sync tool wrapped
            result = tool.invoke(body.parameters)
        elif hasattr(tool, '_arun'):
            # LangChain async run
            result = await tool._arun(**body.parameters)
        elif hasattr(tool, '_run'):
            # LangChain sync run
            result = tool._run(**body.parameters)
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
    finally:
        HTTPClient.reset_request_context_headers(header_ctx_token)


@router.get("/stats/summary")
async def get_tools_stats(state: AIControlPlaneState = Depends(get_ai_control_plane_state)):
    """
    Get statistics about available tools.
    
    Returns:
        Tool count by category and overall statistics
    """
    tool_manager = _require_tool_manager(state)
    
    try:
        counts = tool_manager.get_tool_count()
        all_tools = tool_manager.get_all_tools()
        
        # Build category stats
        category_stats = {}
        for tool in all_tools:
            cat = get_tool_category(tool)
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
async def tools_health_check(state: AIControlPlaneState = Depends(get_ai_control_plane_state)):
    """
    Check health of the tools system.
    """
    try:
        tool_manager = _require_tool_manager(state)
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
