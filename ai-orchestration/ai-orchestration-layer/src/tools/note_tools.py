# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/note_tools.py
# NOTE OPERATIONS
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
    logger = logging.getLogger("note_tools")


@tool
async def create_note(username: str, title: str, description: str) -> str:
    """
    Create a new note for a user.
    Args:
        username: The username of the note owner
        title: Title of the note
        description: Content/description of the note
    Returns: JSON string containing the created note
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.post("/note", json={
            "username": username,
            "title": title,
            "description": description
        })
        return json.dumps({"success": True, "note": response})
    except Exception as e:
        logger.error("create_note_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def delete_note(note_id: int) -> str:
    """
    Delete a note by ID.
    Args:
        note_id: The ID of the note to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        await client.delete(f"/note/{note_id}")
        return json.dumps({"success": True, "message": f"Note {note_id} deleted"})
    except Exception as e:
        logger.error("delete_note_failed", {"note_id": note_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def search_user_notes(username: str, search_term: str) -> str:
    """
    Search user's notes for a term.
    Args:
        username: The username to search notes for
        search_term: The term to search for in note titles and descriptions
    Returns: JSON string containing matching notes
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/note/user/{username}")

        if not isinstance(response, list):
            return json.dumps({"success": False, "error": "Invalid response format"})

        search_term_lower = search_term.lower()
        matches = [
            note for note in response
            if search_term_lower in note.get("title", "").lower()
            or search_term_lower in note.get("description", "").lower()
        ]

        return json.dumps({
            "success": True,
            "count": len(matches),
            "notes": matches
        })
    except Exception as e:
        logger.error("search_notes_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_user_notes(username: str) -> str:
    """
    Get all notes for a user.
    Args:
        username: The username to get notes for
    Returns: JSON string containing all user notes
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/note/user/{username}")
        
        if isinstance(response, list):
            return json.dumps({
                "success": True,
                "count": len(response),
                "notes": response
            })
        return json.dumps(response)
    except Exception as e:
        logger.error("get_user_notes_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_note_by_id(note_id: int) -> str:
    """
    Get a specific note by ID.
    Args:
        note_id: The ID of the note to retrieve
    Returns: JSON string containing the note details
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/note/{note_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_note_by_id_failed", {"note_id": note_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def update_note(note_id: int, title: str, description: str) -> str:
    """
    Update an existing note.
    Args:
        note_id: The ID of the note to update
        title: New title for the note
        description: New content/description for the note
    Returns: JSON string containing the updated note
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.put(f"/note/{note_id}", json={
            "title": title,
            "description": description
        })
        return json.dumps({"success": True, "note": response})
    except Exception as e:
        logger.error("update_note_failed", {"note_id": note_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_notes_count(username: str) -> str:
    """
    Get the count of notes for a user.
    Args:
        username: The username to count notes for
    Returns: JSON string containing the note count
    """
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/note/user/{username}")
        
        count = len(response) if isinstance(response, list) else 0
        return json.dumps({
            "success": True,
            "username": username,
            "count": count
        })
    except Exception as e:
        logger.error("get_notes_count_failed", {"username": username, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ----------------------------------------------------------------------------
# STANDALONE HELPERS (non-tool)
# ----------------------------------------------------------------------------

async def fetch_user_notes(username: str) -> List[Dict[str, Any]]:
    """Direct function to fetch user notes"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        response = await client.get(f"/note/user/{username}")
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_user_notes_failed", {"username": username, "error": str(e)}, error=e)
        return []


async def fetch_note(note_id: int) -> Optional[Dict[str, Any]]:
    """Direct function to fetch a single note"""
    try:
        client = ServiceHTTPClients.get_cloudapp_client()
        return await client.get(f"/note/{note_id}")
    except Exception as e:
        logger.error("fetch_note_failed", {"note_id": note_id, "error": str(e)}, error=e)
        return None


def get_note_tools():
    """Return all note tools as a list"""
    return [
        create_note,
        delete_note,
        search_user_notes,
        get_user_notes,
        get_note_by_id,
        update_note,
        get_notes_count
    ]
