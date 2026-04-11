import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException
from pydantic import BaseModel


logger = logging.getLogger(__name__)


class OrchestrationRequest(BaseModel):
    message: str
    user_id: str
    session_id: str
    context: Optional[Dict[str, Any]] = None
    orchestration_type: Optional[str] = "conversational"


def resolve_effective_user_id(
    requested_user_id: Optional[Any],
    authenticated_user: str,
) -> str:
    """
    Bind end-user requests to the authenticated identity.

    Internal service calls may act on behalf of another user, but public
    callers cannot override their identity via request payloads.
    """
    requested = str(requested_user_id).strip() if requested_user_id is not None else ""
    if authenticated_user.startswith("internal:"):
        if not requested:
            raise HTTPException(status_code=400, detail="user_id is required for internal requests")
        return requested

    if requested and requested != authenticated_user:
        logger.warning(
            "Ignoring client-supplied user_id %s for authenticated user %s",
            requested,
            authenticated_user,
        )

    return authenticated_user


def derive_capabilities_from_path(execution_path: list) -> list:
    """Derive high-level capabilities from LangGraph execution-path nodes."""
    capability_map = {
        "rag": ["RAG", "Vector DB", "LLM Gen"],
        "ml": ["ML Pipeline"],
        "agent": ["Agent Execution", "Tool Invocation"],
        "workflow": ["Workflow Execution"],
        "chat": ["Chat Manager", "LLM Gen"],
        "llm": ["LLM Gen"],
        "tool": ["Tool Invocation"],
    }

    capabilities = set()
    for node in execution_path:
        node_lower = node.lower()
        for key, caps in capability_map.items():
            if key in node_lower:
                capabilities.update(caps)

    return list(capabilities) if capabilities else ["LLM Gen"]
