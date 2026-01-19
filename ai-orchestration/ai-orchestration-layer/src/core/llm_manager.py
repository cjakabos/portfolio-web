# backend/ai-orchestration-layer/src/core/llm_manager.py

"""
Shared LLM Manager - Centralized LLM initialization and configuration
Eliminates duplication across all capabilities
"""

import os
from typing import Optional, Dict, Any
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.language_models import BaseChatModel
from functools import lru_cache


class LLMConfig:
    """Configuration for LLM instances"""
    
    def __init__(
        self,
        model: str = "llama3.2:3b",
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        streaming: bool = False
    ):
        self.model = model
        self.base_url = base_url or os.getenv("OLLAMA_URL", "http://ollama:11434")
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


class LLMManager:
    """
    Centralized LLM manager for the orchestration layer
    Provides singleton access to LLM instances with connection pooling
    """
    
    _instance: Optional['LLMManager'] = None
    _llm_cache: Dict[str, BaseChatModel] = {}
    _embeddings_cache: Dict[str, OllamaEmbeddings] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.default_config = LLMConfig()
        self._initialized = True
    
    @classmethod
    def get_instance(cls) -> 'LLMManager':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def get_llm(
        self,
        config: Optional[LLMConfig] = None,
        cache_key: Optional[str] = None
    ) -> BaseChatModel:
        """
        Get LLM instance with optional caching
        
        Args:
            config: LLM configuration, uses default if None
            cache_key: Cache key for reusing instances
        
        Returns:
            ChatOllama instance
        """
        if config is None:
            config = self.default_config
        
        # Use cache if key provided
        if cache_key and cache_key in self._llm_cache:
            return self._llm_cache[cache_key]
        
        # Create new LLM instance
        llm = ChatOllama(
            model=config.model,
            base_url=config.base_url,
            temperature=config.temperature,
            num_predict=config.max_tokens,
            streaming=config.streaming
        )
        
        # Cache if key provided
        if cache_key:
            self._llm_cache[cache_key] = llm
        
        return llm
    
    def get_embeddings(
        self,
        model: str = "llama3.2:3b",
        cache_key: Optional[str] = None
    ) -> OllamaEmbeddings:
        """
        Get embeddings model with optional caching
        
        Args:
            model: Model name
            cache_key: Cache key for reusing instances
        
        Returns:
            OllamaEmbeddings instance
        """
        # Use cache if key provided
        if cache_key and cache_key in self._embeddings_cache:
            return self._embeddings_cache[cache_key]
        
        # Create new embeddings instance
        embeddings = OllamaEmbeddings(
            model=model,
            base_url=self.default_config.base_url
        )
        
        # Cache if key provided
        if cache_key:
            self._embeddings_cache[cache_key] = embeddings
        
        return embeddings
    
    def get_streaming_llm(self, config: Optional[LLMConfig] = None) -> BaseChatModel:
        """Get LLM configured for streaming"""
        if config is None:
            config = LLMConfig(streaming=True)
        else:
            config.streaming = True
        
        return self.get_llm(config, cache_key="streaming_default")
    
    def clear_cache(self):
        """Clear all cached LLM instances"""
        self._llm_cache.clear()
        self._embeddings_cache.clear()
    
    def get_cache_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        return {
            "llm_instances": len(self._llm_cache),
            "embeddings_instances": len(self._embeddings_cache)
        }


# Convenience functions for easy import
def get_llm(config: Optional[LLMConfig] = None) -> BaseChatModel:
    """Get LLM instance from manager"""
    return LLMManager.get_instance().get_llm(config)


def get_embeddings(model: str = "llama3.2:3b") -> OllamaEmbeddings:
    """Get embeddings from manager"""
    return LLMManager.get_instance().get_embeddings(model)


def get_streaming_llm(config: Optional[LLMConfig] = None) -> BaseChatModel:
    """Get streaming LLM instance"""
    return LLMManager.get_instance().get_streaming_llm(config)
