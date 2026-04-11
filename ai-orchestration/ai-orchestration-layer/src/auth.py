import logging
from dataclasses import dataclass
from typing import Mapping, Optional

import httpx
from fastapi import HTTPException, Request, WebSocket

from core.config import get_config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    username: str
    roles: tuple[str, ...] = ()
    is_internal: bool = False


def _resolve_internal_service_call(headers: Mapping[str, str]) -> Optional[str]:
    """Return the internal service name when the request carries valid service credentials."""
    config = get_config()
    service_name = headers.get("x-internal-service-name", "").strip()
    service_token = headers.get("x-internal-service-token", "").strip()

    if not service_name or not service_token:
        return None

    if (
        service_name == "gateway-admin-proxy"
        and config.services.internal_gateway_admin_token
        and service_token == config.services.internal_gateway_admin_token
    ):
        return service_name

    if (
        service_name == "ai-orchestration"
        and config.services.internal_ai_orchestration_token
        and service_token == config.services.internal_ai_orchestration_token
    ):
        return service_name

    return None


def _build_cookie_header(cookies: Optional[Mapping[str, str]]) -> Optional[str]:
    if not cookies:
        return None
    parts = [f"{key}={value}" for key, value in cookies.items()]
    return "; ".join(parts) if parts else None


def _auth_forward_headers(
    headers: Mapping[str, str],
    cookies: Optional[Mapping[str, str]] = None,
) -> dict[str, str]:
    forwarded_headers: dict[str, str] = {}

    authorization = headers.get("authorization")
    if authorization:
        forwarded_headers["Authorization"] = authorization

    cookie_header = headers.get("cookie") or _build_cookie_header(cookies)
    if cookie_header:
        forwarded_headers["Cookie"] = cookie_header

    traceparent = headers.get("traceparent")
    if traceparent:
        forwarded_headers["traceparent"] = traceparent

    tracestate = headers.get("tracestate")
    if tracestate:
        forwarded_headers["tracestate"] = tracestate

    return forwarded_headers


def _coerce_roles(response: httpx.Response) -> tuple[str, ...]:
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    roles = payload.get("roles")
    if isinstance(roles, list):
        return tuple(str(role) for role in roles)

    header_roles = response.headers.get("x-auth-roles", "")
    if not header_roles:
        return ()
    return tuple(role.strip() for role in header_roles.split(",") if role.strip())


def _coerce_username(response: httpx.Response) -> Optional[str]:
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    username = payload.get("username")
    if isinstance(username, str) and username.strip():
        return username.strip()

    header_username = response.headers.get("x-auth-user", "")
    return header_username.strip() or None


async def _verify_cloudapp_identity(
    headers: Mapping[str, str],
    cookies: Optional[Mapping[str, str]] = None,
    require_admin: bool = False,
) -> AuthenticatedPrincipal:
    forwarded_headers = _auth_forward_headers(headers, cookies)
    if not forwarded_headers:
        raise HTTPException(status_code=401, detail="Authentication required")

    config = get_config()
    auth_check_path = "/user/admin/auth-check" if require_admin else "/user/auth-check"
    auth_check_url = f"{config.services.cloudapp_url.rstrip('/')}{auth_check_path}"
    timeout_seconds = min(max(config.services.http_timeout, 1), 10)

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(auth_check_url, headers=forwarded_headers)
    except httpx.RequestError as exc:
        logger.error("CloudApp auth verification failed: %s", exc)
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Authentication required")
    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="Admin access required")
    if response.status_code >= 400:
        logger.error("Unexpected auth-check failure from CloudApp: %s", response.status_code)
        raise HTTPException(status_code=503, detail="Authentication verification failed")

    username = _coerce_username(response)
    if not username:
        logger.error("CloudApp auth-check response missing username")
        raise HTTPException(status_code=503, detail="Authentication verification failed")

    roles = _coerce_roles(response)
    if require_admin and "ROLE_ADMIN" not in roles:
        logger.warning("User %s passed admin auth-check without ROLE_ADMIN", username)
        raise HTTPException(status_code=403, detail="Admin access required")

    return AuthenticatedPrincipal(username=username, roles=roles, is_internal=False)


async def authenticate_principal(
    headers: Mapping[str, str],
    cookies: Optional[Mapping[str, str]] = None,
    require_admin: bool = False,
) -> AuthenticatedPrincipal:
    """
    Resolve the authenticated caller from request or WebSocket handshake data.

    Public callers must present a valid CloudApp session (cookie or bearer
    token), which is verified by CloudApp directly. Internal service traffic
    may use explicit service identity headers instead.
    """
    internal_service_name = _resolve_internal_service_call(headers)
    if internal_service_name:
        roles = ("ROLE_ADMIN",) if require_admin else ()
        return AuthenticatedPrincipal(
            username=f"internal:{internal_service_name}",
            roles=roles,
            is_internal=True,
        )

    return await _verify_cloudapp_identity(
        headers=headers,
        cookies=cookies,
        require_admin=require_admin,
    )


async def require_authenticated_user(request: Request) -> str:
    principal = await authenticate_principal(request.headers, request.cookies)
    return principal.username


async def require_admin_user(request: Request) -> str:
    principal = await authenticate_principal(
        request.headers,
        request.cookies,
        require_admin=True,
    )
    return principal.username


async def require_websocket_user(websocket: WebSocket) -> str:
    principal = await authenticate_principal(websocket.headers, websocket.cookies)
    return principal.username


async def require_websocket_admin(websocket: WebSocket) -> str:
    principal = await authenticate_principal(
        websocket.headers,
        websocket.cookies,
        require_admin=True,
    )
    return principal.username
