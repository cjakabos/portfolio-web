import os
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

SOURCE_ROOT = Path(os.getenv("AI_ORCH_SRC", "")).resolve() if os.getenv("AI_ORCH_SRC") else None
if SOURCE_ROOT is None or not SOURCE_ROOT.exists():
    SOURCE_ROOT = (Path(__file__).resolve().parents[2] / "ai-orchestration/ai-orchestration-layer/src").resolve()

if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

import auth


class StubServices:
    cloudapp_url = "http://cloudapp/cloudapp"
    internal_service_token = "shared-token"
    http_timeout = 5


class StubConfig:
    services = StubServices()


class DummyAsyncClient:
    def __init__(self, response: httpx.Response):
        self.response = response
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, headers: dict[str, str]):
        self.calls.append({"url": url, "headers": headers})
        return self.response


def _request(status_code: int = 200, headers: dict[str, str] | None = None, payload: dict | None = None) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        headers=headers,
        json=payload,
        request=httpx.Request("GET", "http://cloudapp/cloudapp/user/auth-check"),
    )


@pytest.mark.asyncio
async def test_require_authenticated_user_accepts_internal_service_token(monkeypatch):
    monkeypatch.setattr(auth, "get_config", lambda: StubConfig())
    request = SimpleNamespace(headers={"x-internal-auth": "shared-token"}, cookies={})

    user = await auth.require_authenticated_user(request)

    assert user == "internal-service"


@pytest.mark.asyncio
async def test_require_authenticated_user_verifies_identity_with_cloudapp(monkeypatch):
    monkeypatch.setattr(auth, "get_config", lambda: StubConfig())
    response = _request(
        payload={"username": "alice", "roles": ["ROLE_USER"]},
        headers={"x-auth-user": "alice", "x-auth-roles": "ROLE_USER"},
    )
    client = DummyAsyncClient(response)
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda timeout: client)

    request = SimpleNamespace(
        headers={"authorization": "Bearer token-123", "traceparent": "00-abc-def-01"},
        cookies={},
    )

    user = await auth.require_authenticated_user(request)

    assert user == "alice"
    assert client.calls[0]["url"] == "http://cloudapp/cloudapp/user/auth-check"
    assert client.calls[0]["headers"]["Authorization"] == "Bearer token-123"
    assert client.calls[0]["headers"]["traceparent"] == "00-abc-def-01"


@pytest.mark.asyncio
async def test_require_admin_user_verifies_admin_endpoint(monkeypatch):
    monkeypatch.setattr(auth, "get_config", lambda: StubConfig())
    response = _request(
        payload={"username": "admin", "roles": ["ROLE_ADMIN", "ROLE_USER"]},
        headers={"x-auth-user": "admin", "x-auth-roles": "ROLE_ADMIN,ROLE_USER"},
    )
    client = DummyAsyncClient(response)
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda timeout: client)

    request = SimpleNamespace(headers={}, cookies={"auth-cookie": "value"})

    user = await auth.require_admin_user(request)

    assert user == "admin"
    assert client.calls[0]["url"] == "http://cloudapp/cloudapp/user/admin/auth-check"
    assert client.calls[0]["headers"]["Cookie"] == "auth-cookie=value"


@pytest.mark.asyncio
async def test_require_admin_user_rejects_non_admin(monkeypatch):
    monkeypatch.setattr(auth, "get_config", lambda: StubConfig())
    response = _request(status_code=403, payload={"detail": "forbidden"})
    client = DummyAsyncClient(response)
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda timeout: client)

    request = SimpleNamespace(headers={"authorization": "Bearer token-123"}, cookies={})

    with pytest.raises(auth.HTTPException) as exc:
        await auth.require_admin_user(request)

    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin access required"


@pytest.mark.asyncio
async def test_require_authenticated_user_does_not_trust_forwarded_identity_headers_alone(monkeypatch):
    monkeypatch.setattr(auth, "get_config", lambda: StubConfig())
    request = SimpleNamespace(
        headers={"x-auth-user": "spoofed-user", "x-auth-roles": "ROLE_ADMIN"},
        cookies={},
    )

    with pytest.raises(auth.HTTPException) as exc:
        await auth.require_authenticated_user(request)

    assert exc.value.status_code == 401
