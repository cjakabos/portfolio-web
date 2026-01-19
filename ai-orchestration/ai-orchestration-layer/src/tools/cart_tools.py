# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/cart_tools.py
# CART OPERATIONS
# ============================================================================

from langchain_core.tools import tool
from typing import Dict, Any, Optional, List
import json
from .http_client import ServiceHTTPClients

try:
    from core.unified_logger import get_logger
    logger = get_logger()
except ImportError:
    import logging
    logger = logging.getLogger("cart_tools")


@tool
async def add_item_to_cart(username: str, item_id: int, quantity: int = 1) -> str:
    """
    Add an item to user's cart.
    Args:
        username: The username of the cart owner
        item_id: The ID of the item to add
        quantity: Number of items to add (default: 1)
    Returns: JSON string containing updated cart
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/addToCart", json={
            "username": username,
            "itemId": item_id,
            "quantity": quantity
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("add_to_cart_failed", {"username": username, "item_id": item_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def remove_item_from_cart(username: str, item_id: int, quantity: int = 1) -> str:
    """
    Remove an item from user's cart.
    Args:
        username: The username of the cart owner
        item_id: The ID of the item to remove
        quantity: Number of items to remove (default: 1)
    Returns: JSON string containing updated cart
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/removeFromCart", json={
            "username": username,
            "itemId": item_id,
            "quantity": quantity
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("remove_from_cart_failed", {"username": username, "item_id": item_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_cart(username: str) -> str:
    """
    Get current contents of user's cart.
    Args:
        username: The username of the cart owner
    Returns: JSON string containing cart items and total
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/getCart", json={"username": username})
        return json.dumps(response)
    except Exception as e:
        logger.error("get_cart_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def clear_cart(username: str) -> str:
    """
    Clear all items from user's cart.
    Args:
        username: The username of the cart owner
    Returns: JSON string containing status message
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/clearCart", json={"username": username})
        return json.dumps(response)
    except Exception as e:
        logger.error("clear_cart_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def update_cart_item_quantity(username: str, item_id: int, quantity: int) -> str:
    """
    Update the quantity of an item in the cart.
    Args:
        username: The username of the cart owner
        item_id: The ID of the item to update
        quantity: The new quantity for the item
    Returns: JSON string containing updated cart
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/updateQuantity", json={
            "username": username,
            "itemId": item_id,
            "quantity": quantity
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("update_cart_quantity_failed", {"username": username, "item_id": item_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_cart_total(username: str) -> str:
    """
    Get the total value of user's cart.
    Args:
        username: The username of the cart owner
    Returns: JSON string containing the cart total
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/getCart", json={"username": username})
        
        if isinstance(response, dict):
            total = response.get("total", 0)
            items_count = len(response.get("items", []))
            return json.dumps({
                "success": True,
                "username": username,
                "total": total,
                "items_count": items_count
            })
        return json.dumps({"success": False, "error": "Invalid response format"})
    except Exception as e:
        logger.error("get_cart_total_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# STANDALONE HELPERS (non-tool)
# ----------------------------------------------------------------------------

async def fetch_cart(username: str) -> Optional[Dict[str, Any]]:
    """Direct function to fetch cart (non-tool)"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        return await client.post("/cart/getCart", json={"username": username})
    except Exception as e:
        logger.error("fetch_cart_failed", {"username": username, "error": str(e)}, error=e)
        return None


async def fetch_cart_items(username: str) -> List[Dict[str, Any]]:
    """Direct function to fetch cart items only"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/cart/getCart", json={"username": username})
        if isinstance(response, dict):
            return response.get("items", [])
        return []
    except Exception as e:
        logger.error("fetch_cart_items_failed", {"username": username, "error": str(e)}, error=e)
        return []


def get_cart_tools():
    """Return all cart tools as a list"""
    return [
        get_cart,
        add_item_to_cart,
        remove_item_from_cart,
        clear_cart,
        update_cart_item_quantity,
        get_cart_total
    ]
