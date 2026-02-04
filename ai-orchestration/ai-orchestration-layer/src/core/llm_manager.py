# backend/ai-orchestration-layer/src/core/llm_manager.py
# =============================================================================
# Shared LLM Manager - Centralized LLM initialization and configuration
# UPDATED: Removed duplicate LLMConfig, imports from config.py
# UPDATED: Added dynamic model selection for chat and RAG
# UPDATED: Fixed cache invalidation on model change
# =============================================================================

import os
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

import httpx
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.language_models import BaseChatModel

# Import configuration from config.py - single source of truth
from core.config import LLMConfiguration, RAGConfiguration

logger = logging.getLogger(__name__)


@dataclass
class OllamaModel:
    """Represents an available Ollama model"""
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None
    digest: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class LLMManager:
    """
    Centralized LLM manager for the orchestration layer.
    Provides singleton access to LLM instances with connection pooling.

    UPDATED: Now supports dynamic model selection for chat and RAG separately.

    IMPORTANT: When model changes, cache is cleared so new instances use the new model.
    """

    _instance: Optional['LLMManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        # Instance-level caches (not class-level to avoid issues)
        self._llm_cache: Dict[str, BaseChatModel] = {}
        self._embeddings_cache: Dict[str, OllamaEmbeddings] = {}

        # Model version counter - incremented on any model change
        # Used to invalidate cached LLM references held elsewhere
        self._model_version: int = 0

        # Load default configuration from config.py (reads from env vars)
        self._llm_config = LLMConfiguration.from_env()
        self._rag_config = RAGConfiguration.from_env()

        # Track current models (can be changed at runtime)
        self._current_chat_model: str = self._llm_config.model
        self._current_rag_model: str = self._llm_config.model
        self._current_embedding_model: str = self._rag_config.embedding_model

        self._initialized = True

        logger.info(f"LLMManager initialized with chat_model={self._current_chat_model}, "
                   f"rag_model={self._current_rag_model}, "
                   f"embedding_model={self._current_embedding_model}")

    @classmethod
    def get_instance(cls) -> 'LLMManager':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def auto_detect_models(self) -> None:
        """
        Auto-detect and set valid models from available Ollama models.
        Called to ensure we have valid models configured.
        """
        models, connected, _ = await self.fetch_available_models()

        if not connected or not models:
            logger.warning("Cannot auto-detect models: Ollama not connected or no models available")
            return

        model_names = [m.name for m in models]

        # Separate embedding models from chat models
        embedding_models = [m for m in model_names if 'embed' in m.lower()]
        chat_models = [m for m in model_names if 'embed' not in m.lower()]

        # Auto-set chat model if current one doesn't exist
        if chat_models:
            current_chat_exists = any(
                self._current_chat_model == m or self._current_chat_model.split(":")[0] == m.split(":")[0]
                for m in model_names
            )
            if not current_chat_exists or 'embed' in self._current_chat_model.lower():
                new_chat_model = chat_models[0]
                logger.info(f"Auto-detected chat model: {new_chat_model} (was: {self._current_chat_model})")
                self._current_chat_model = new_chat_model
                self._llm_cache.clear()

        # Auto-set RAG model if current one doesn't exist
        if chat_models:
            current_rag_exists = any(
                self._current_rag_model == m or self._current_rag_model.split(":")[0] == m.split(":")[0]
                for m in model_names
            )
            if not current_rag_exists or 'embed' in self._current_rag_model.lower():
                new_rag_model = chat_models[0]
                logger.info(f"Auto-detected RAG model: {new_rag_model} (was: {self._current_rag_model})")
                self._current_rag_model = new_rag_model
                self._llm_cache.clear()

        # Auto-set embedding model if current one doesn't exist
        if embedding_models:
            current_embed_exists = any(
                self._current_embedding_model == m or self._current_embedding_model.split(":")[0] == m.split(":")[0]
                for m in model_names
            )
            if not current_embed_exists:
                new_embed_model = embedding_models[0]
                logger.info(f"Auto-detected embedding model: {new_embed_model} (was: {self._current_embedding_model})")
                self._current_embedding_model = new_embed_model
                self._embeddings_cache.clear()

    # =========================================================================
    # Model Selection (NEW)
    # =========================================================================

    @property
    def chat_model(self) -> str:
        """Get current chat model name"""
        return self._current_chat_model

    @property
    def rag_model(self) -> str:
        """Get current RAG model name"""
        return self._current_rag_model

    @property
    def embedding_model(self) -> str:
        """Get current embedding model name"""
        return self._current_embedding_model

    @property
    def base_url(self) -> str:
        """Get Ollama base URL"""
        return self._llm_config.base_url

    @property
    def model_version(self) -> int:
        """
        Get model version counter.
        Incremented whenever chat or RAG model changes.
        Use this to detect if your cached LLM reference is stale.
        """
        return self._model_version

    def set_chat_model(self, model: str) -> None:
        """
        Set the model to use for chat/streaming.
        Clears ALL LLM cache to force recreation with new model.
        """
        old_model = self._current_chat_model
        self._current_chat_model = model

        if model != old_model:
            self._model_version += 1  # Increment version on change
            cache_keys = list(self._llm_cache.keys())
            logger.info(f">>> MODEL CHANGE: '{old_model}' -> '{model}' (version now: {self._model_version})")
            logger.info(f">>> CLEARING CACHE: {len(cache_keys)} entries: {cache_keys}")
            # Clear ALL LLM cache to ensure new model is used
            self._llm_cache.clear()
            logger.info(f">>> CACHE CLEARED - next get_llm() will create new instance with '{model}'")
        else:
            logger.info(f"Chat model unchanged: '{model}'")

    def set_rag_model(self, model: str) -> None:
        """
        Set the model to use for RAG queries.
        Clears ALL LLM cache to force recreation with new model.
        """
        old_model = self._current_rag_model
        self._current_rag_model = model

        if model != old_model:
            self._model_version += 1  # Increment version on change
            logger.info(f">>> RAG MODEL CHANGE: '{old_model}' -> '{model}' (version now: {self._model_version})")
            # Clear ALL LLM cache to ensure new model is used
            self._llm_cache.clear()
        else:
            logger.info(f"RAG model unchanged: '{model}'")

    def set_embedding_model(self, model: str) -> None:
        """
        Set the embedding model.
        Clears the embeddings cache to force recreation.
        """
        old_model = self._current_embedding_model
        self._current_embedding_model = model

        if model != old_model:
            logger.info(f"Embedding model changed from '{old_model}' to '{model}' - clearing embeddings cache")
            self._embeddings_cache.clear()
        else:
            logger.info(f"Embedding model set to '{model}' (unchanged)")

    async def fetch_available_models(self) -> tuple[List[OllamaModel], bool, Optional[str]]:
        """
        Fetch available models from Ollama API.

        Returns:
            Tuple of (models_list, is_connected, error_message)
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self._llm_config.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()

                models = []
                for model_data in data.get("models", []):
                    models.append(OllamaModel(
                        name=model_data.get("name", ""),
                        size=model_data.get("size"),
                        modified_at=model_data.get("modified_at"),
                        digest=model_data.get("digest"),
                        details=model_data.get("details")
                    ))

                return models, True, None

        except httpx.ConnectError:
            logger.warning(f"Cannot connect to Ollama at {self._llm_config.base_url}")
            return [], False, "connection_failed"
        except httpx.TimeoutException:
            logger.warning(f"Timeout connecting to Ollama at {self._llm_config.base_url}")
            return [], False, "timeout"
        except Exception as e:
            logger.error(f"Error fetching Ollama models: {e}")
            return [], False, str(e)

    async def validate_model(self, model: str) -> bool:
        """Check if a model is available in Ollama"""
        models, connected, _ = await self.fetch_available_models()
        if not connected:
            return False

        model_names = [m.name for m in models]
        model_base = model.split(":")[0]

        return any(
            model == m or model_base == m.split(":")[0]
            for m in model_names
        )

    # =========================================================================
    # LLM Instance Management
    # =========================================================================

    def get_llm(
        self,
        model: Optional[str] = None,
        cache_key: Optional[str] = None,
        streaming: bool = False,
        config: Optional[Any] = None,  # Backwards compatibility with LLMConfig
        **kwargs
    ) -> BaseChatModel:
        """
        Get LLM instance with optional caching.

        Args:
            model: Model name, uses current chat model if None
            cache_key: Cache key for reusing instances
            streaming: Whether to enable streaming
            config: DEPRECATED - LLMConfig instance for backwards compatibility
            **kwargs: Additional arguments passed to ChatOllama

        Returns:
            ChatOllama instance
        """
        # Handle backwards compatibility with LLMConfig
        if config is not None:
            # Extract values from old-style config object
            if hasattr(config, 'model'):
                model = model or config.model
            if hasattr(config, 'streaming'):
                streaming = config.streaming
            if hasattr(config, 'temperature'):
                kwargs.setdefault('temperature', config.temperature)
            if hasattr(config, 'max_tokens'):
                kwargs.setdefault('max_tokens', config.max_tokens)

        if model is None:
            model = self._current_chat_model

        # Handle "not-added" default - need to find an actual model
        if model == "not-added" or not model:
            logger.warning(f"Model is '{model}' - attempting to find available chat model")
            detected_model = self._find_available_chat_model()
            if detected_model:
                logger.info(f"Auto-selected chat model: {detected_model}")
                model = detected_model
                self._current_chat_model = detected_model
                # Also update RAG model if it's not-added (they share chat models)
                if self._current_rag_model == "not-added" or not self._current_rag_model:
                    self._current_rag_model = detected_model
                    logger.info(f"Also auto-selected RAG model: {detected_model}")
            else:
                raise ValueError(
                    "No chat model configured and no chat models available in Ollama. "
                    "Please install a chat model using: ollama pull <model-name>"
                )

        # CRITICAL: Include model name in cache key to prevent ANY possibility of returning wrong model
        # This ensures cache hits are ONLY for exact model matches
        effective_cache_key = f"{cache_key}:{model}:{streaming}" if cache_key else None

        logger.info(f"get_llm called: requested_model='{model}', cache_key='{cache_key}', effective_key='{effective_cache_key}'")

        if effective_cache_key and effective_cache_key in self._llm_cache:
            cached_llm = self._llm_cache[effective_cache_key]
            # Double-check the model just to be safe
            cached_model_name = getattr(cached_llm, 'model', None)
            logger.info(f"Cache HIT: key='{effective_cache_key}', cached_model='{cached_model_name}'")
            if cached_model_name == model:
                return cached_llm
            else:
                # This should never happen with model in key, but just in case
                logger.error(f"Cache CORRUPTION: key='{effective_cache_key}', expected='{model}', got='{cached_model_name}' - DELETING")
                del self._llm_cache[effective_cache_key]

        # Create new LLM instance - THIS IS THE ACTUAL MODEL THAT WILL BE USED
        logger.info(f">>> CREATING NEW LLM: model='{model}', streaming={streaming}, effective_key='{effective_cache_key}'")

        llm = ChatOllama(
            model=model,
            base_url=self._llm_config.base_url,
            temperature=kwargs.get('temperature', self._llm_config.temperature),
            num_predict=kwargs.get('max_tokens', self._llm_config.max_tokens),
            streaming=streaming,
            **{k: v for k, v in kwargs.items() if k not in ['temperature', 'max_tokens']}
        )

        # Verify the model was set correctly
        actual_model = getattr(llm, 'model', 'UNKNOWN')
        logger.info(f">>> LLM CREATED: requested='{model}', actual='{actual_model}'")

        # Cache using the effective key (includes model name)
        if effective_cache_key:
            self._llm_cache[effective_cache_key] = llm
            logger.info(f">>> LLM CACHED: key='{effective_cache_key}', model='{actual_model}'")

        return llm

    def get_chat_llm(self, cache_key: Optional[str] = "chat_default", force_new: bool = False) -> BaseChatModel:
        """
        Get LLM configured for chat using current chat model.

        IMPORTANT: If your code stores the returned LLM instance, model changes won't take effect!
        For code that should respect model changes, use get_fresh_chat_llm() instead.

        Args:
            cache_key: Cache key (set to None to disable caching)
            force_new: If True, always create new instance regardless of cache
        """
        # Handle "not-added" for chat model
        if self._current_chat_model == "not-added" or not self._current_chat_model:
            detected = self._find_available_chat_model()
            if detected:
                self._current_chat_model = detected
                # Also update RAG model if not set
                if self._current_rag_model == "not-added" or not self._current_rag_model:
                    self._current_rag_model = detected
                logger.info(f"Auto-selected chat model: {detected}")

        logger.info(f"get_chat_llm: model='{self._current_chat_model}', force_new={force_new}")

        if force_new:
            # Bypass cache entirely
            return self.get_llm(
                model=self._current_chat_model,
                cache_key=None,  # No caching
                streaming=False
            )

        return self.get_llm(
            model=self._current_chat_model,
            cache_key=cache_key,
            streaming=False
        )

    def get_fresh_chat_llm(self) -> BaseChatModel:
        """
        Get a FRESH LLM instance for chat - NEVER cached.

        Use this in orchestration/streaming code that should respect model changes.
        This ensures every call gets an LLM with the currently selected model.
        """
        logger.info(f"get_fresh_chat_llm: creating fresh instance with model='{self._current_chat_model}'")
        return self.get_chat_llm(cache_key=None, force_new=True)

    def get_fresh_streaming_llm(self) -> BaseChatModel:
        """
        Get a FRESH streaming LLM instance - NEVER cached.

        Use this in orchestration/streaming code that should respect model changes.
        """
        logger.info(f"get_fresh_streaming_llm: creating fresh instance with model='{self._current_chat_model}'")
        return self.get_llm(
            model=self._current_chat_model,
            cache_key=None,  # No caching
            streaming=True
        )

    def get_rag_llm(self, cache_key: Optional[str] = "rag_default") -> BaseChatModel:
        """Get LLM configured for RAG using current RAG model"""
        # Handle "not-added" for RAG model
        if self._current_rag_model == "not-added" or not self._current_rag_model:
            detected = self._find_available_chat_model()
            if detected:
                self._current_rag_model = detected
                logger.info(f"Auto-selected RAG model: {detected}")

        return self.get_llm(
            model=self._current_rag_model,
            cache_key=cache_key,
            streaming=False
        )

    def get_streaming_llm(self, cache_key: Optional[str] = "streaming_default") -> BaseChatModel:
        """Get LLM configured for streaming using current chat model"""
        # Handle "not-added" for chat model (streaming uses chat model)
        if self._current_chat_model == "not-added" or not self._current_chat_model:
            detected = self._find_available_chat_model()
            if detected:
                self._current_chat_model = detected
                logger.info(f"Auto-selected chat model for streaming: {detected}")

        return self.get_llm(
            model=self._current_chat_model,
            cache_key=cache_key,
            streaming=True
        )

    def _find_available_chat_model(self) -> Optional[str]:
        """
        Synchronously find an available chat model from Ollama.
        Returns None if no chat models available.
        Filters out embedding models (those with 'embed' in name).
        """
        import httpx
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                # Filter out embedding models - keep only chat/LLM models
                chat_models = [
                    m.get("name", "") for m in models
                    if m.get("name") and "embed" not in m.get("name", "").lower()
                ]
                if chat_models:
                    logger.info(f"Available chat models: {chat_models}")
                    return chat_models[0]
                else:
                    logger.warning("No chat models found (only embedding models available)")
        except Exception as e:
            logger.warning(f"Failed to fetch models from Ollama: {e}")
        return None

    def get_embeddings(
        self,
        model: Optional[str] = None,
        cache_key: Optional[str] = "default_embeddings"
    ) -> OllamaEmbeddings:
        """
        Get embeddings model with optional caching.

        Args:
            model: Model name, uses current embedding model if None
            cache_key: Cache key for reusing instances

        Returns:
            OllamaEmbeddings instance
        """
        if model is None:
            model = self._current_embedding_model

        # Handle "not-added" default - need to find an actual embedding model
        if model == "not-added" or not model:
            logger.warning(f"Embedding model is '{model}' - attempting to find available embedding model")
            detected_model = self._find_available_embedding_model()
            if detected_model:
                logger.info(f"Auto-selected embedding model: {detected_model}")
                model = detected_model
                self._current_embedding_model = detected_model
            else:
                raise ValueError(
                    "No embedding model configured and no embedding models available in Ollama. "
                    "Please install an embedding model using: ollama pull <embedding-model>"
                )

        # Use cache if key provided
        if cache_key and cache_key in self._embeddings_cache:
            return self._embeddings_cache[cache_key]

        # Create new embeddings instance
        embeddings = OllamaEmbeddings(
            model=model,
            base_url=self._llm_config.base_url
        )

        # Cache if key provided
        if cache_key:
            self._embeddings_cache[cache_key] = embeddings

        return embeddings

    def _find_available_embedding_model(self) -> Optional[str]:
        """
        Synchronously find an available embedding model from Ollama.
        Returns None if no embedding models available.
        """
        import httpx
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                # Filter for embedding models (those WITH 'embed' in name)
                embedding_models = [
                    m.get("name", "") for m in models
                    if m.get("name") and "embed" in m.get("name", "").lower()
                ]
                if embedding_models:
                    logger.info(f"Available embedding models: {embedding_models}")
                    return embedding_models[0]
                else:
                    logger.warning("No embedding models found")
        except Exception as e:
            logger.warning(f"Failed to fetch models from Ollama: {e}")
        return None

    # =========================================================================
    # Cache Management
    # =========================================================================

    def clear_cache(self) -> None:
        """Clear all cached LLM and embeddings instances"""
        self._llm_cache.clear()
        self._embeddings_cache.clear()
        logger.info("LLM cache cleared")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "llm_instances": len(self._llm_cache),
            "embeddings_instances": len(self._embeddings_cache),
            "llm_cache_keys": list(self._llm_cache.keys()),
            "embeddings_cache_keys": list(self._embeddings_cache.keys())
        }

    # =========================================================================
    # Status & Configuration
    # =========================================================================

    def get_current_settings(self) -> Dict[str, Any]:
        """
        Get current model settings.
        Triggers auto-detection if models are "not-added".
        """
        # Auto-detect chat model if needed
        if self._current_chat_model == "not-added" or not self._current_chat_model:
            detected = self._find_available_chat_model()
            if detected:
                self._current_chat_model = detected
                logger.info(f"Auto-detected chat model for settings: {detected}")
                # Also set RAG model if not-added
                if self._current_rag_model == "not-added" or not self._current_rag_model:
                    self._current_rag_model = detected

        # Auto-detect embedding model if needed
        if self._current_embedding_model == "not-added" or not self._current_embedding_model:
            detected = self._find_available_embedding_model()
            if detected:
                self._current_embedding_model = detected
                logger.info(f"Auto-detected embedding model for settings: {detected}")

        return {
            "chat_model": self._current_chat_model,
            "rag_model": self._current_rag_model,
            "embedding_model": self._current_embedding_model,
            "base_url": self._llm_config.base_url,
            "temperature": self._llm_config.temperature,
            "max_tokens": self._llm_config.max_tokens,
            "model_version": self._model_version,
        }

    async def health_check(self) -> Dict[str, Any]:
        """Check Ollama connectivity and return status"""
        models, connected, error = await self.fetch_available_models()

        return {
            "status": "healthy" if connected else "unhealthy",
            "ollama_url": self._llm_config.base_url,
            "connected": connected,
            "models_available": len(models),
            "error": error,
            "current_chat_model": self._current_chat_model,
            "current_rag_model": self._current_rag_model,
            "current_embedding_model": self._current_embedding_model,
            "cache_stats": self.get_cache_stats()
        }


# =============================================================================
# Convenience functions for backwards compatibility
# =============================================================================
# These functions maintain the old API so existing code continues to work.
# New code should use get_llm_manager() and call methods directly.
# =============================================================================

def get_llm_manager() -> LLMManager:
    """Get the singleton LLMManager instance"""
    return LLMManager.get_instance()


def get_llm(config: Optional[Any] = None) -> BaseChatModel:
    """
    Get an LLM instance (backwards compatible).

    Note: The 'config' parameter is ignored in the new implementation.
    Uses the current chat model. For custom models, use:
        get_llm_manager().get_llm(model="your-model")
    """
    return get_llm_manager().get_chat_llm()


def get_streaming_llm(config: Optional[Any] = None) -> BaseChatModel:
    """
    Get a streaming LLM instance (backwards compatible).

    Note: The 'config' parameter is ignored in the new implementation.
    Uses the current chat model with streaming enabled.
    """
    return get_llm_manager().get_streaming_llm()


def get_embeddings(model: Optional[str] = None) -> OllamaEmbeddings:
    """
    Get embeddings model (backwards compatible).

    Args:
        model: Optional model name. If None, uses current embedding model.
    """
    return get_llm_manager().get_embeddings(model=model)


# Aliases for backwards compatibility
def get_default_llm() -> BaseChatModel:
    """Alias for get_llm() - backwards compatibility"""
    return get_llm()


def get_default_embeddings() -> OllamaEmbeddings:
    """Alias for get_embeddings() - backwards compatibility"""
    return get_embeddings()


# =============================================================================
# DEPRECATED: LLMConfig class alias for backwards compatibility
# =============================================================================
# Some modules (e.g., base_capability.py) import LLMConfig.
# This provides a minimal compatible interface.
# New code should NOT use this - use get_llm_manager().get_llm() instead.
# =============================================================================

class LLMConfig:
    """
    DEPRECATED: Use get_llm_manager().get_llm(model=..., **kwargs) instead.

    This class exists only for backwards compatibility with code that imports:
        from core.llm_manager import LLMConfig
    """

    def __init__(
        self,
        model: str = "",  # No default - must be specified or auto-detected
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        streaming: bool = False
    ):
        import warnings
        warnings.warn(
            "LLMConfig is deprecated. Use get_llm_manager().get_llm(model=...) instead.",
            DeprecationWarning,
            stacklevel=2
        )
        self.model = model
        self.base_url = base_url or os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.streaming = streaming

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "base_url": self.base_url,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "streaming": self.streaming
        }