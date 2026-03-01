# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/http_client.py
# HTTP CLIENT WITH CONNECTION POOLING
# ============================================================================

import asyncio
import json
from typing import Dict, Any, Optional
from contextvars import ContextVar, Token

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    import aiohttp

from core.config import get_config


# Request-scoped headers propagated from incoming FastAPI requests.
# ContextVar keeps values isolated per async task/request.
_request_context_headers: ContextVar[Dict[str, str]] = ContextVar(
    "request_context_headers",
    default={}
)


class HTTPClient:
    """
    Async HTTP Client with connection pooling and retry logic
    """

    def __init__(
        self,
        base_url: str = "",
        timeout: int = 10,
        max_retries: int = 3,
        max_connections: int = 100,
        max_keepalive_connections: int = 20,
        default_headers: Optional[Dict[str, str]] = None
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.max_connections = max_connections
        self.max_keepalive_connections = max_keepalive_connections
        self.default_headers = default_headers or {}
        self._client: Optional['httpx.AsyncClient'] = None
        self._session: Optional['aiohttp.ClientSession'] = None
        self._use_httpx = HTTPX_AVAILABLE
        self._client_lock = asyncio.Lock()

    @staticmethod
    def set_request_context_headers(headers: Optional[Dict[str, str]] = None) -> Token:
        """
        Set request-scoped headers for downstream service calls.
        Returns a token that must be reset in a finally block.
        """
        cleaned_headers: Dict[str, str] = {}
        for key, value in (headers or {}).items():
            if value:
                cleaned_headers[key] = value
        return _request_context_headers.set(cleaned_headers)

    @staticmethod
    def reset_request_context_headers(token: Token) -> None:
        """Reset request-scoped headers using token returned by set_request_context_headers()."""
        _request_context_headers.reset(token)

    @staticmethod
    def get_request_context_headers() -> Dict[str, str]:
        """Get current request-scoped headers."""
        return dict(_request_context_headers.get())

    async def _get_client(self) -> 'httpx.AsyncClient':
        """Get or create httpx client with connection pooling"""
        if self._client is None or self._client.is_closed:
            async with self._client_lock:
                if self._client is None or self._client.is_closed:
                    limits = httpx.Limits(
                        max_connections=self.max_connections,
                        max_keepalive_connections=self.max_keepalive_connections
                    )
                    self._client = httpx.AsyncClient(
                        base_url=self.base_url,
                        timeout=httpx.Timeout(self.timeout),
                        limits=limits,
                        http2=True
                    )
        return self._client

    async def _get_session(self) -> 'aiohttp.ClientSession':
        """Get or create aiohttp session (fallback)"""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=self.max_connections,
                limit_per_host=self.max_keepalive_connections
            )
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
        return self._session

    async def request(
        self,
        method: str,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Perform HTTP request with retry logic"""
        last_error = None
        merged_headers: Dict[str, str] = {}
        merged_headers.update(self.default_headers)
        merged_headers.update(self.get_request_context_headers())
        if headers:
            merged_headers.update(headers)
        request_headers = merged_headers or None

        for attempt in range(self.max_retries):
            try:
                if self._use_httpx:
                    client = await self._get_client()
                    response = await client.request(
                        method=method,
                        url=url,
                        params=params,
                        data=data,
                        json=json_data,
                        headers=request_headers
                    )
                    response.raise_for_status()
                    try:
                        return response.json()
                    except (ValueError, TypeError):
                        return {"text": response.text, "status_code": response.status_code}
                else:
                    session = await self._get_session()
                    full_url = f"{self.base_url}{url}" if self.base_url and not url.startswith("http") else url
                    async with session.request(
                        method=method,
                        url=full_url,
                        params=params,
                        data=data,
                        json=json_data,
                        headers=request_headers
                    ) as response:
                        response.raise_for_status()
                        try:
                            return await response.json()
                        except (ValueError, Exception):
                            text = await response.text()
                            return {"text": text, "status": response.status}

            except Exception as e:
                last_error = e
                if attempt >= self.max_retries - 1:
                    break
                delay = min(2 ** attempt, 10)
                await asyncio.sleep(delay)

        raise Exception(f"HTTP request failed after {self.max_retries} attempts: {last_error}")

    async def get(self, url: str, params: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        return await self.request("GET", url, params=params, **kwargs)

    async def post(self, url: str, json: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        return await self.request("POST", url, json_data=json, **kwargs)

    async def put(self, url: str, json: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        return await self.request("PUT", url, json_data=json, **kwargs)

    async def delete(self, url: str, **kwargs) -> Any:
        return await self.request("DELETE", url, **kwargs)

    async def patch(self, url: str, json: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        return await self.request("PATCH", url, json_data=json, **kwargs)

    async def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics"""
        if not self._use_httpx or not self._client:
            return {"available": False}
        return {
            "available": True,
            "client_closed": self._client.is_closed,
            "max_connections": self.max_connections,
            "max_keepalive_connections": self.max_keepalive_connections,
            "http2_enabled": True
        }

    async def probe(self, url: str, timeout_seconds: float = 2.0) -> bool:
        """
        Lightweight connectivity probe used by health dashboards.
        Does not use retries so it stays fast and reflects current reachability.
        """
        merged_headers: Dict[str, str] = {}
        merged_headers.update(self.default_headers)
        merged_headers.update(self.get_request_context_headers())
        request_headers = merged_headers or None

        try:
            if self._use_httpx:
                client = await self._get_client()
                response = await client.request(
                    method="GET",
                    url=url,
                    headers=request_headers,
                    timeout=httpx.Timeout(timeout_seconds),
                )
                return 200 <= response.status_code < 300

            session = await self._get_session()
            full_url = f"{self.base_url}{url}" if self.base_url and not url.startswith("http") else url
            async with session.request(
                method="GET",
                url=full_url,
                headers=request_headers,
                timeout=aiohttp.ClientTimeout(total=timeout_seconds),
            ) as response:
                return 200 <= response.status < 300
        except Exception:
            return False

    async def aclose(self):
        """Close clients"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
        if self._session and not self._session.closed:
            await self._session.close()


class ServiceHTTPClients:
    """
    Factory for creating HTTP clients for different services
    Each service gets a dedicated client with connection pooling
    """
    _clients: Dict[str, HTTPClient] = {}

    @classmethod
    def get_cloudapp_client(cls) -> HTTPClient:
        if "cloudapp" not in cls._clients:
            config = get_config()
            default_headers: Dict[str, str] = {}
            if config.services.internal_service_token:
                default_headers["X-Internal-Auth"] = config.services.internal_service_token
            cls._clients["cloudapp"] = HTTPClient(
                base_url=config.services.cloudapp_url,
                timeout=config.services.http_timeout,
                default_headers=default_headers
            )
        return cls._clients["cloudapp"]

    @classmethod
    def get_petstore_client(cls) -> HTTPClient:
        if "petstore" not in cls._clients:
            config = get_config()
            default_headers: Dict[str, str] = {}
            if config.services.internal_service_token:
                default_headers["X-Internal-Auth"] = config.services.internal_service_token
            cls._clients["petstore"] = HTTPClient(
                base_url=config.services.petstore_url,
                timeout=config.services.http_timeout,
                default_headers=default_headers
            )
        return cls._clients["petstore"]

    @classmethod
    def get_vehicles_client(cls) -> HTTPClient:
        if "vehicles" not in cls._clients:
            config = get_config()
            default_headers: Dict[str, str] = {}
            if config.services.internal_service_token:
                default_headers["X-Internal-Auth"] = config.services.internal_service_token
            cls._clients["vehicles"] = HTTPClient(
                base_url=config.services.vehicles_url,
                timeout=config.services.http_timeout,
                default_headers=default_headers
            )
        return cls._clients["vehicles"]

    @classmethod
    def get_ml_client(cls) -> HTTPClient:
        if "ml" not in cls._clients:
            config = get_config()
            default_headers: Dict[str, str] = {}
            if config.services.internal_service_token:
                default_headers["X-Internal-Auth"] = config.services.internal_service_token
            cls._clients["ml"] = HTTPClient(
                base_url=config.services.ml_url,
                timeout=config.services.http_timeout,
                default_headers=default_headers
            )
        return cls._clients["ml"]

    @classmethod
    def get_proxy_client(cls) -> HTTPClient:
        if "proxy" not in cls._clients:
            config = get_config()
            cls._clients["proxy"] = HTTPClient(
                timeout=config.services.http_timeout
            )
        return cls._clients["proxy"]

    @classmethod
    async def close_all_clients(cls):
        """Close all shared clients"""
        for client in cls._clients.values():
            await client.aclose()
        cls._clients.clear()
