import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

# Import tools/http_client.py directly to avoid importing tools/__init__.py
# (which eagerly imports langchain-dependent modules not needed for these unit tests).
SOURCE_ROOT = Path(os.getenv("AI_ORCH_SRC", "")).resolve() if os.getenv("AI_ORCH_SRC") else None
if SOURCE_ROOT is None or not SOURCE_ROOT.exists():
    SOURCE_ROOT = (Path(__file__).resolve().parents[2] / "ai-orchestration/ai-orchestration-layer/src").resolve()

TOOLS_DIR = SOURCE_ROOT / "tools"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from http_client import HTTPClient, ServiceHTTPClients


class DummyResponse:
    def __init__(self, json_payload=None, text_payload="ok", status_code=200, raise_error=None):
        self._json_payload = json_payload
        self.text = text_payload
        self.status_code = status_code
        self._raise_error = raise_error

    def raise_for_status(self):
        if self._raise_error:
            raise self._raise_error

    def json(self):
        if self._json_payload is None:
            raise ValueError("No JSON payload")
        return self._json_payload


class DummyAsyncClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def request(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@pytest.mark.asyncio
async def test_request_merges_headers_with_expected_precedence(monkeypatch):
    client = HTTPClient(
        base_url="http://example",
        default_headers={"X-Internal-Auth": "default-token", "X-Default": "default"},
    )
    httpx_client = DummyAsyncClient([DummyResponse(json_payload={"ok": True})])
    monkeypatch.setattr(client, "_get_client", AsyncMock(return_value=httpx_client))

    token = HTTPClient.set_request_context_headers(
        {
            "Authorization": "Bearer from-context",
            "X-Internal-Auth": "context-token",
        }
    )
    try:
        result = await client.request(
            "GET",
            "/item",
            headers={"Authorization": "Bearer explicit"},
        )
    finally:
        HTTPClient.reset_request_context_headers(token)

    assert result == {"ok": True}
    sent_headers = httpx_client.calls[0]["headers"]
    assert sent_headers["X-Default"] == "default"
    assert sent_headers["X-Internal-Auth"] == "context-token"
    assert sent_headers["Authorization"] == "Bearer explicit"


def test_request_context_headers_can_be_set_and_reset():
    token = HTTPClient.set_request_context_headers(
        {"Authorization": "Bearer abc", "X-Internal-Auth": "internal-token"}
    )
    assert HTTPClient.get_request_context_headers() == {
        "Authorization": "Bearer abc",
        "X-Internal-Auth": "internal-token",
    }

    HTTPClient.reset_request_context_headers(token)
    assert HTTPClient.get_request_context_headers() == {}


@pytest.mark.asyncio
async def test_request_retries_on_failure_and_raises(monkeypatch):
    client = HTTPClient(base_url="http://example", max_retries=3)
    httpx_client = DummyAsyncClient(
        [RuntimeError("boom-1"), RuntimeError("boom-2"), RuntimeError("boom-3")]
    )
    monkeypatch.setattr(client, "_get_client", AsyncMock(return_value=httpx_client))
    sleep_mock = AsyncMock(return_value=None)
    monkeypatch.setattr("http_client.asyncio.sleep", sleep_mock)

    with pytest.raises(Exception, match="HTTP request failed after 3 attempts"):
        await client.request("GET", "/fail")

    assert len(httpx_client.calls) == 3
    assert sleep_mock.await_count == 2


def test_cloudapp_client_includes_internal_auth_default_header(monkeypatch):
    class StubServices:
        cloudapp_url = "http://cloudapp"
        petstore_url = "http://petstore"
        vehicles_url = "http://vehicles"
        ml_url = "http://ml"
        http_timeout = 10
        internal_service_token = "shared-internal-token"

    class StubConfig:
        services = StubServices()

    ServiceHTTPClients._clients.clear()
    monkeypatch.setattr("http_client.get_config", lambda: StubConfig())

    cloudapp_client = ServiceHTTPClients.get_cloudapp_client()
    assert cloudapp_client.default_headers == {"X-Internal-Auth": "shared-internal-token"}

    StubServices.internal_service_token = ""
    ServiceHTTPClients._clients.clear()
    cloudapp_client_no_token = ServiceHTTPClients.get_cloudapp_client()
    assert cloudapp_client_no_token.default_headers == {}
