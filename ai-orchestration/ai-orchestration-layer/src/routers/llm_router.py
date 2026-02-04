# ============================================================================
# File: backend/ai-orchestration-layer/src/routers/llm_router.py
# LLM Router - Model Selection and Configuration API
# ============================================================================
# Provides REST endpoints for:
# - Listing available Ollama models
# - Getting/setting current model for chat and RAG
#
# UPDATED: Delegates all state management to LLMManager (single source of truth)
# ============================================================================

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Import LLMManager - the single source of truth for LLM configuration
from core.llm_manager import LLMManager, get_llm_manager

router = APIRouter(prefix="/llm", tags=["LLM"])
logger = logging.getLogger(__name__)


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class OllamaModelResponse(BaseModel):
    """Schema for an Ollama model"""
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None
    digest: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class OllamaModelsResponse(BaseModel):
    """Response for listing Ollama models"""
    models: List[OllamaModelResponse]
    total: int
    ollama_url: str
    connected: bool
    error: Optional[str] = None


class CurrentModelSettings(BaseModel):
    """Current model settings"""
    chat_model: str
    rag_model: str
    embedding_model: str
    ollama_url: str
    temperature: float
    max_tokens: int


class SetModelRequest(BaseModel):
    """Request to set model"""
    model: str
    target: str = "chat"  # "chat", "rag", "embedding", or "both" (chat+rag)


class SetModelResponse(BaseModel):
    """Response after setting model"""
    success: bool
    chat_model: str
    rag_model: str
    embedding_model: str
    message: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/models", response_model=OllamaModelsResponse)
async def list_ollama_models():
    """
    List all available models from Ollama.

    Fetches the model list from the Ollama API at /api/tags.
    Returns an error status if Ollama is not reachable.
    """
    manager = get_llm_manager()
    models, connected, error = await manager.fetch_available_models()

    return OllamaModelsResponse(
        models=[
            OllamaModelResponse(
                name=m.name,
                size=m.size,
                modified_at=m.modified_at,
                digest=m.digest,
                details=m.details
            )
            for m in models
        ],
        total=len(models),
        ollama_url=manager.base_url,
        connected=connected,
        error=error
    )


@router.get("/current", response_model=CurrentModelSettings)
async def get_current_models():
    """
    Get the currently configured models for chat and RAG.
    """
    manager = get_llm_manager()
    settings = manager.get_current_settings()

    return CurrentModelSettings(
        chat_model=settings["chat_model"],
        rag_model=settings["rag_model"],
        embedding_model=settings["embedding_model"],
        ollama_url=settings["base_url"],
        temperature=settings["temperature"],
        max_tokens=settings["max_tokens"]
    )


@router.post("/current", response_model=SetModelResponse)
async def set_current_model(request: SetModelRequest):
    """
    Set the model to use for chat, RAG, or embeddings.

    Args:
        model: The model name to use (as shown in 'ollama list')
        target: Which system to update - "chat", "rag", "embedding", or "both" (chat+rag)
    """
    manager = get_llm_manager()

    # Validate target
    valid_targets = ["chat", "rag", "embedding", "both"]
    if request.target not in valid_targets:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid target '{request.target}'. Must be one of: {valid_targets}"
        )

    # Validate that the model exists
    is_valid = await manager.validate_model(request.model)
    if not is_valid:
        # Try to get available models for error message
        models, connected, _ = await manager.fetch_available_models()

        if not connected:
            raise HTTPException(
                status_code=503,
                detail="Cannot connect to Ollama to validate model"
            )

        available = [m.name for m in models]
        raise HTTPException(
            status_code=400,
            detail=f"Model '{request.model}' not found. Available models: {available}"
        )

    # Update the model(s) via LLMManager
    if request.target in ["chat", "both"]:
        manager.set_chat_model(request.model)
        logger.info(f"Chat model updated to: {request.model}")

    if request.target in ["rag", "both"]:
        manager.set_rag_model(request.model)
        logger.info(f"RAG model updated to: {request.model}")

    if request.target == "embedding":
        manager.set_embedding_model(request.model)
        logger.info(f"Embedding model updated to: {request.model}")

    return SetModelResponse(
        success=True,
        chat_model=manager.chat_model,
        rag_model=manager.rag_model,
        embedding_model=manager.embedding_model,
        message=f"Model updated for {request.target}"
    )


@router.get("/health")
async def llm_health():
    """
    Check LLM/Ollama connectivity health.
    Returns detailed status including cache statistics.
    """
    manager = get_llm_manager()
    return await manager.health_check()


@router.post("/cache/clear")
async def clear_llm_cache():
    """
    Clear the LLM instance cache.
    Useful after changing models or for debugging.
    """
    manager = get_llm_manager()
    manager.clear_cache()

    return {
        "success": True,
        "message": "LLM cache cleared",
        "cache_stats": manager.get_cache_stats()
    }


@router.get("/cache/stats")
async def get_cache_stats():
    """
    Get LLM cache statistics.
    Shows number of cached LLM and embedding instances.
    """
    manager = get_llm_manager()
    return manager.get_cache_stats()