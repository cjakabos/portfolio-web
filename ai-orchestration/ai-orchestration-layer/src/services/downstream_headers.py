from typing import Dict

from fastapi import Request, WebSocket


def extract_downstream_headers(request: Request | WebSocket) -> Dict[str, str]:
    """Forward auth-related headers to downstream service calls."""
    headers: Dict[str, str] = {}
    auth = request.headers.get("authorization")
    if auth:
        headers["Authorization"] = auth

    cookie = request.headers.get("cookie")
    if cookie:
        headers["Cookie"] = cookie

    internal_service_name = request.headers.get("x-internal-service-name")
    if internal_service_name:
        headers["X-Internal-Service-Name"] = internal_service_name

    internal_service_token = request.headers.get("x-internal-service-token")
    if internal_service_token:
        headers["X-Internal-Service-Token"] = internal_service_token

    return headers
