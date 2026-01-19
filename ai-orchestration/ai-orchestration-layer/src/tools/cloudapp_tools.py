# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/cloudapp_tools.py
# CORE CLOUDAPP TOOLS (Items, Users, Orders)
# ============================================================================

from langchain_core.tools import tool
from typing import Dict, Any, List, Optional
import json
from .http_client import ServiceHTTPClients

try:
    from core.unified_logger import get_logger
    logger = get_logger()
except ImportError:
    import logging
    logger = logging.getLogger("cloudapp_tools")

# ----------------------------------------------------------------------------
# ITEM OPERATIONS
# ----------------------------------------------------------------------------

@tool
async def get_items() -> str:
    """
    Get all available items from the catalog.
    Returns: JSON string containing list of items
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/item")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_items_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_item_by_id(item_id: int) -> str:
    """
    Get details for a specific item.
    Args:
        item_id: The ID of the item to retrieve
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/item/{item_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_item_by_id_failed", {"item_id": item_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def search_items_by_name(name: str) -> str:
    """
    Search items by name.
    Args:
        name: The name or partial name to search for
    Returns: JSON string containing matching items
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/item")
        
        if not isinstance(response, list):
            items = response.get("items", []) if isinstance(response, dict) else []
        else:
            items = response
        
        # Filter items by name (case-insensitive)
        name_lower = name.lower()
        matches = [
            item for item in items
            if name_lower in item.get("name", "").lower()
        ]
        
        return json.dumps({
            "success": True,
            "search_term": name,
            "count": len(matches),
            "items": matches
        })
    except Exception as e:
        logger.error("search_items_by_name_failed", {"name": name, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# USER OPERATIONS
# ----------------------------------------------------------------------------

@tool
async def get_user_by_username(username: str) -> str:
    """Get user details by username"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/user/{username}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_user_by_username_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_user_by_id(user_id: int) -> str:
    """Get user details by ID"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/user/id/{user_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_user_by_id_failed", {"user_id": user_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_user(username: str, password: str) -> str:
    """
    Create a new user account.
    Args:
        username: The username for the new account
        password: The password for the new account
    Returns: JSON string containing the created user details
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/user", json={
            "username": username,
            "password": password
        })
        return json.dumps({"success": True, "user": response})
    except Exception as e:
        logger.error("create_user_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# ORDER OPERATIONS
# ----------------------------------------------------------------------------

@tool
async def get_order_history(username: str) -> str:
    """Get order history for a user"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/order/history/{username}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_order_history_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def submit_order(username: str) -> str:
    """Submit current cart as a new order"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post(f"/order/submit/{username}")
        return json.dumps(response)
    except Exception as e:
        logger.error("submit_order_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_order_by_id(order_id: int) -> str:
    """
    Get a specific order by ID.
    Args:
        order_id: The order ID to retrieve
    Returns: JSON string containing order details
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/order/{order_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_order_by_id_failed", {"order_id": order_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


# ----------------------------------------------------------------------------
# ROOM OPERATIONS
# ----------------------------------------------------------------------------

@tool
async def create_room(name: str, username: str) -> str:
    """
    Create a new room.
    Args:
        name: Name of the room
        username: Username of the creator
    Returns: JSON string containing the created room
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/room", json={
            "name": name,
            "createdBy": username
        })
        return json.dumps({"success": True, "room": response})
    except Exception as e:
        logger.error("create_room_failed", {"name": name, "username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_room_by_code(code: str) -> str:
    """
    Get a room by its code.
    Args:
        code: The room code
    Returns: JSON string containing room details
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/{code}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_room_by_code_failed", {"code": code, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_user_rooms(username: str) -> str:
    """
    Get all rooms created by a user.
    Args:
        username: The username to get rooms for
    Returns: JSON string containing list of rooms
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/user/{username}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_user_rooms_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def delete_room(room_id: int) -> str:
    """
    Delete a room by ID.
    Args:
        room_id: The room ID to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        await client.delete(f"/room/{room_id}")
        return json.dumps({"success": True, "message": f"Room {room_id} deleted"})
    except Exception as e:
        logger.error("delete_room_failed", {"room_id": room_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# STANDALONE DIRECT FUNCTIONS
# ----------------------------------------------------------------------------

async def fetch_items() -> List[Dict[str, Any]]:
    """Direct function to fetch items"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/item")
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_items_failed", {"error": str(e)}, error=e)
        return []


async def fetch_user(username: str) -> Optional[Dict[str, Any]]:
    """Direct function to fetch user"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/user/{username}")
        return response
    except Exception as e:
        logger.error("fetch_user_failed", {"username": username, "error": str(e)}, error=e)
        return None


def get_cloudapp_tools():
    """Return all cloudapp tools as a list"""
    return [
        get_items,
        get_item_by_id,
        search_items_by_name,
        get_user_by_username,
        get_user_by_id,
        create_user,
        get_order_history,
        submit_order,
        get_order_by_id,
        create_room,
        get_room_by_code,
        get_user_rooms,
        delete_room
    ]
