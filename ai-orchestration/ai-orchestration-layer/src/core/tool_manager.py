# backend/ai-orchestration-layer/src/core/tool_manager.py

"""
Tool Manager - Centralized tool registration and connection pooling
Eliminates duplicate tool registration and provides efficient HTTP connection pooling
"""

import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from functools import lru_cache
from langchain_core.tools import BaseTool

from core.config import get_config


class ConnectionPool:
    """
    HTTP Connection Pool Manager
    Provides efficient connection reuse across all HTTP operations
    """
    
    _instance: Optional['ConnectionPool'] = None
    _session: Optional[aiohttp.ClientSession] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @classmethod
    async def get_session(cls) -> aiohttp.ClientSession:
        """Get or create HTTP session with connection pooling"""
        if cls._session is None or cls._session.closed:
            config = get_config()
            
            # Create session with connection pooling
            connector = aiohttp.TCPConnector(
                limit=100,  # Total connection limit
                limit_per_host=30,  # Per-host connection limit
                ttl_dns_cache=300,  # DNS cache TTL
                force_close=False,
                enable_cleanup_closed=True
            )
            
            timeout = aiohttp.ClientTimeout(
                total=config.services.http_timeout,
                connect=5,
                sock_read=config.services.http_timeout
            )
            
            cls._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers={
                    'User-Agent': 'AI-Orchestration-Layer/1.0',
                    'Accept': 'application/json'
                }
            )
        
        return cls._session
    
    @classmethod
    async def close(cls):
        """Close the connection pool"""
        if cls._session and not cls._session.closed:
            await cls._session.close()
            cls._session = None
    
    @classmethod
    async def get(cls, url: str, **kwargs) -> aiohttp.ClientResponse:
        """GET request with connection pooling"""
        session = await cls.get_session()
        return await session.get(url, **kwargs)
    
    @classmethod
    async def post(cls, url: str, **kwargs) -> aiohttp.ClientResponse:
        """POST request with connection pooling"""
        session = await cls.get_session()
        return await session.post(url, **kwargs)
    
    @classmethod
    async def put(cls, url: str, **kwargs) -> aiohttp.ClientResponse:
        """PUT request with connection pooling"""
        session = await cls.get_session()
        return await session.put(url, **kwargs)
    
    @classmethod
    async def delete(cls, url: str, **kwargs) -> aiohttp.ClientResponse:
        """DELETE request with connection pooling"""
        session = await cls.get_session()
        return await session.delete(url, **kwargs)
    
    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Get connection pool statistics"""
        if cls._session and not cls._session.closed:
            connector = cls._session.connector
            return {
                "active_connections": len(connector._conns),
                "available_connections": sum(len(conns) for conns in connector._conns.values()),
                "session_closed": cls._session.closed
            }
        return {
            "active_connections": 0,
            "available_connections": 0,
            "session_closed": True
        }


class ToolRegistry:
    """
    Centralized Tool Registry
    Manages all tools with caching to prevent duplicate registration
    """
    
    _instance: Optional['ToolRegistry'] = None
    _tools_cache: Dict[str, List[BaseTool]] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._tools_cache = {}
        self._all_tools: Optional[List[BaseTool]] = None
        self._initialized = True
    
    @classmethod
    def get_instance(cls) -> 'ToolRegistry':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def register_tools(self, category: str, tools: List[BaseTool]) -> None:
        """
        Register tools for a specific category
        
        Args:
            category: Tool category (e.g., 'cloudapp', 'petstore', 'vehicle')
            tools: List of tools to register
        """
        self._tools_cache[category] = tools
        self._all_tools = None  # Invalidate all_tools cache
    
    @lru_cache(maxsize=10)
    def get_tools(self, category: str) -> List[BaseTool]:
        """
        Get tools for a specific category (cached)
        
        Args:
            category: Tool category
        
        Returns:
            List of tools for the category
        """
        if category not in self._tools_cache:
            # Lazy load tools
            self._load_tools(category)
        
        return self._tools_cache.get(category, [])
    
    def get_all_tools(self) -> List[BaseTool]:
        """Get all registered tools (cached)"""
        if self._all_tools is None:
            all_tools = []
            for tools in self._tools_cache.values():
                all_tools.extend(tools)
            self._all_tools = all_tools
        
        return self._all_tools
    
    def get_tools_by_categories(self, categories: List[str]) -> List[BaseTool]:
        """
        Get tools from multiple categories
        
        Args:
            categories: List of category names
        
        Returns:
            Combined list of tools
        """
        tools = []
        for category in categories:
            tools.extend(self.get_tools(category))
        return tools
    
    def _load_tools(self, category: str) -> None:
        """Lazy load tools for a category"""
        if category == "cloudapp":
            from tools.cloudapp_tools import get_cloudapp_tools
            self._tools_cache[category] = get_cloudapp_tools()
        elif category == "petstore":
            from tools.petstore_tools import get_petstore_tools
            self._tools_cache[category] = get_petstore_tools()
        elif category == "vehicle":
            from tools.vehicle_tools import get_vehicle_tools
            self._tools_cache[category] = get_vehicle_tools()
        else:
            self._tools_cache[category] = []
    
    def clear_cache(self) -> None:
        """Clear tool cache"""
        self.get_tools.cache_clear()
        self._all_tools = None
    
    def get_registry_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        return {
            "categories": list(self._tools_cache.keys()),
            "total_categories": len(self._tools_cache),
            "total_tools": sum(len(tools) for tools in self._tools_cache.values()),
            "tools_per_category": {
                category: len(tools) 
                for category, tools in self._tools_cache.items()
            }
        }


class ToolManager:
    """
    High-level Tool Manager
    Combines connection pooling and tool registry
    """
    
    def __init__(self):
        self.registry = ToolRegistry.get_instance()
        self.pool = ConnectionPool()
        self.config = get_config()
    
    def get_tools_for_agent(self, agent_type: str) -> List[BaseTool]:
        """
        Get appropriate tools for an agent type
        
        Args:
            agent_type: Type of agent ('shop', 'petstore', 'vehicle', 'all')
        
        Returns:
            List of tools for the agent
        """
        if agent_type == "shop":
            return self.registry.get_tools("cloudapp")
        elif agent_type == "petstore":
            return self.registry.get_tools("petstore")
        elif agent_type == "vehicle":
            return self.registry.get_tools("vehicle")
        elif agent_type == "all":
            return self.registry.get_all_tools()
        else:
            return []
    
    async def make_http_request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request with connection pooling and error handling
        
        Args:
            method: HTTP method ('GET', 'POST', 'PUT', 'DELETE')
            url: Request URL
            **kwargs: Additional request arguments
        
        Returns:
            Response data as dictionary
        """
        max_retries = self.config.services.max_retries
        retry_delay = self.config.services.retry_delay
        
        for attempt in range(max_retries):
            try:
                if method.upper() == "GET":
                    async with await self.pool.get(url, **kwargs) as response:
                        return await self._process_response(response)
                elif method.upper() == "POST":
                    async with await self.pool.post(url, **kwargs) as response:
                        return await self._process_response(response)
                elif method.upper() == "PUT":
                    async with await self.pool.put(url, **kwargs) as response:
                        return await self._process_response(response)
                elif method.upper() == "DELETE":
                    async with await self.pool.delete(url, **kwargs) as response:
                        return await self._process_response(response)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                    
            except aiohttp.ClientError as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(retry_delay * (self.config.services.retry_backoff ** attempt))
    
    async def _process_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """Process HTTP response"""
        if response.status >= 400:
            raise aiohttp.ClientResponseError(
                request_info=response.request_info,
                history=response.history,
                status=response.status,
                message=f"HTTP {response.status}"
            )
        
        try:
            return await response.json()
        except (ValueError, TypeError):
            text = await response.text()
            return {"response": text}
    
    async def close(self):
        """Close all connections"""
        await self.pool.close()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get tool manager statistics"""
        return {
            "tool_registry": self.registry.get_registry_stats(),
            "connection_pool": self.pool.get_stats()
        }


# Convenience functions
def get_tool_manager() -> ToolManager:
    """Get tool manager instance"""
    return ToolManager()


async def get_connection_pool() -> ConnectionPool:
    """Get connection pool instance"""
    return await ConnectionPool.get_session()
