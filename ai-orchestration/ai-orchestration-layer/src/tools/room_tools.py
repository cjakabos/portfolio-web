# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/room_tools.py
# ROOM BOOKING OPERATIONS
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
    logger = logging.getLogger("room_tools")


@tool
async def get_room_bookings(date: str) -> str:
    """
    Get room bookings for a specific date.
    Args:
        date: Date in YYYY-MM-DD format
    Returns: JSON string containing bookings for the date
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/bookings/{date}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_room_bookings_failed", {"date": date, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_room_booking(room_id: int, username: str, date: str, start_time: str, end_time: str, title: str = "") -> str:
    """
    Create a new room booking.
    Args:
        room_id: The ID of the room to book
        username: The username making the booking
        date: Date of the booking in YYYY-MM-DD format
        start_time: Start time in HH:MM format
        end_time: End time in HH:MM format
        title: Optional title/purpose for the booking
    Returns: JSON string containing the created booking
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/room/bookings", json={
            "roomId": room_id,
            "username": username,
            "date": date,
            "startTime": start_time,
            "endTime": end_time,
            "title": title
        })
        return json.dumps({"success": True, "booking": response})
    except Exception as e:
        logger.error("create_room_booking_failed", {
            "room_id": room_id, 
            "username": username, 
            "date": date,
            "error": str(e)
        }, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def cancel_room_booking(booking_id: int) -> str:
    """
    Cancel an existing room booking.
    Args:
        booking_id: The ID of the booking to cancel
    Returns: JSON string with cancellation status
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        await client.delete(f"/room/bookings/{booking_id}")
        return json.dumps({"success": True, "message": f"Booking {booking_id} cancelled"})
    except Exception as e:
        logger.error("cancel_room_booking_failed", {"booking_id": booking_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_user_bookings(username: str) -> str:
    """
    Get all room bookings for a user.
    Args:
        username: The username to get bookings for
    Returns: JSON string containing the user's bookings
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/bookings/user/{username}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_user_bookings_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_available_rooms(date: str, start_time: str, end_time: str) -> str:
    """
    Get rooms available for a specific time slot.
    Args:
        date: Date in YYYY-MM-DD format
        start_time: Start time in HH:MM format
        end_time: End time in HH:MM format
    Returns: JSON string containing available rooms
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/room/available", params={
            "date": date,
            "startTime": start_time,
            "endTime": end_time
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("get_available_rooms_failed", {
            "date": date, 
            "start_time": start_time, 
            "end_time": end_time,
            "error": str(e)
        }, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_all_rooms() -> str:
    """
    Get all rooms in the system.
    Returns: JSON string containing all rooms
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/room")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_all_rooms_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_room_details(room_id: int) -> str:
    """
    Get details for a specific room.
    Args:
        room_id: The ID of the room
    Returns: JSON string containing room details
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/{room_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_room_details_failed", {"room_id": room_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def update_room_booking(booking_id: int, start_time: str = None, end_time: str = None, title: str = None) -> str:
    """
    Update an existing room booking.
    Args:
        booking_id: The ID of the booking to update
        start_time: New start time in HH:MM format (optional)
        end_time: New end time in HH:MM format (optional)
        title: New title/purpose (optional)
    Returns: JSON string containing the updated booking
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        update_data = {}
        if start_time:
            update_data["startTime"] = start_time
        if end_time:
            update_data["endTime"] = end_time
        if title is not None:
            update_data["title"] = title
            
        response = await client.put(f"/room/bookings/{booking_id}", json=update_data)
        return json.dumps({"success": True, "booking": response})
    except Exception as e:
        logger.error("update_room_booking_failed", {"booking_id": booking_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# STANDALONE HELPERS (non-tool)
# ----------------------------------------------------------------------------

async def fetch_room_bookings(date: str) -> List[Dict[str, Any]]:
    """Direct function to fetch room bookings for a date"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/room/bookings/{date}")
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_room_bookings_failed", {"date": date, "error": str(e)}, error=e)
        return []


async def fetch_rooms() -> List[Dict[str, Any]]:
    """Direct function to fetch all rooms"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get("/room")
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_rooms_failed", {"error": str(e)}, error=e)
        return []


def get_room_tools():
    """Return all room tools as a list"""
    return [
        get_room_bookings,
        create_room_booking,
        cancel_room_booking,
        get_user_bookings,
        get_available_rooms,
        get_all_rooms,
        get_room_details,
        update_room_booking
    ]
