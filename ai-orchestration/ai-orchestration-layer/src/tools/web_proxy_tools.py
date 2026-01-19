# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/web_proxy_tools.py
# EXTERNAL WEB PROXY
# ============================================================================

from langchain_core.tools import tool
from typing import Dict, Any, Optional
import json
from .http_client import ServiceHTTPClients

try:
    from core.unified_logger import get_logger
    logger = get_logger()
except ImportError:
    import logging
    logger = logging.getLogger("web_proxy_tools")


@tool
async def proxy_request(url: str, method: str = "GET") -> str:
    """
    Proxy an external API call through the backend.
    Args:
        url: External URL to call
        method: HTTP method (GET, POST, etc.)
    Returns: JSON string containing the response
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.request(method, url)
        return json.dumps(response)
    except Exception as e:
        logger.error("proxy_request_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def proxy_get(url: str, params: Dict[str, Any] = None) -> str:
    """
    Proxy a GET request to an external API.
    Args:
        url: External URL to call
        params: Optional query parameters
    Returns: JSON string containing the response
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.get(url, params=params)
        return json.dumps(response)
    except Exception as e:
        logger.error("proxy_get_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def proxy_post(url: str, body: Dict[str, Any] = None) -> str:
    """
    Proxy a POST request to an external API.
    Args:
        url: External URL to call
        body: Request body as dictionary
    Returns: JSON string containing the response
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.post(url, json=body)
        return json.dumps(response)
    except Exception as e:
        logger.error("proxy_post_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def proxy_put(url: str, body: Dict[str, Any] = None) -> str:
    """
    Proxy a PUT request to an external API.
    Args:
        url: External URL to call
        body: Request body as dictionary
    Returns: JSON string containing the response
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.put(url, json=body)
        return json.dumps(response)
    except Exception as e:
        logger.error("proxy_put_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def proxy_delete(url: str) -> str:
    """
    Proxy a DELETE request to an external API.
    Args:
        url: External URL to call
    Returns: JSON string containing the response
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.delete(url)
        return json.dumps(response)
    except Exception as e:
        logger.error("proxy_delete_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def fetch_external_json(url: str) -> str:
    """
    Fetch JSON data from an external URL.
    Args:
        url: External URL that returns JSON
    Returns: JSON string containing the response data
    """
    try:
        client = ServiceHTTPClients.get_proxy_client()
        response = await client.get(url)
        return json.dumps({"success": True, "data": response})
    except Exception as e:
        logger.error("fetch_external_json_failed", {"url": url, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# HELPER FUNCTIONS (non-tool)
# ============================================================================

async def make_external_request(
    url: str, 
    method: str = "GET", 
    body: Dict[str, Any] = None,
    params: Dict[str, Any] = None
) -> Optional[Dict[str, Any]]:
    """Direct function to make external requests"""
    try:
        client = ServiceHTTPClients.get_proxy_client()
        if method.upper() == "GET":
            return await client.get(url, params=params)
        elif method.upper() == "POST":
            return await client.post(url, json=body)
        elif method.upper() == "PUT":
            return await client.put(url, json=body)
        elif method.upper() == "DELETE":
            return await client.delete(url)
        else:
            return await client.request(method, url, json_data=body, params=params)
    except Exception as e:
        logger.error("make_external_request_failed", {"url": url, "method": method, "error": str(e)}, error=e)
        return None


def get_web_proxy_tools():
    """Return all web proxy tools as a list"""
    return [
        proxy_request,
        proxy_get,
        proxy_post,
        proxy_put,
        proxy_delete,
        fetch_external_json
    ]
