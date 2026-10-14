"""Exercise every RAG HTTP route with real administrator authentication logic."""
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import auth
from core.app_state import AIControlPlaneState
from core.orchestrator import AIOrchestrationLayer
from core.parallel_executor import ParallelExecutionManager
from routers import approvals_router, orchestration_router, rag_router
from tools.http_client import HTTPClient


@pytest.fixture
def rag_api(monkeypatch):
    client_type = httpx.AsyncClient
    checks = []
    operations = []

    def verify(request):
        checks.append(request)
        if request.headers.get("authorization") == "Bearer administrator" or request.headers.get("cookie") == "CLOUDAPP_AUTH=administrator":
            return httpx.Response(200, json={"username": "verified-admin", "roles": ["ROLE_ADMIN"]})
        if request.headers.get("authorization") == "Bearer regular-user":
            if request.url.path.endswith("/user/auth-check"):
                return httpx.Response(200, json={"username": "regular-user", "roles": ["ROLE_USER"]})
            return httpx.Response(403, json={"detail": "Administrator access required"})
        return httpx.Response(401, json={"detail": "Authentication required"})

    monkeypatch.setattr(auth, "get_config", lambda: SimpleNamespace(services=SimpleNamespace(
        cloudapp_url="http://cloudapp.test/cloudapp", http_timeout=5,
        internal_gateway_admin_token="gateway-token", internal_ai_orchestration_token="ai-token")))
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: client_type(
        transport=httpx.MockTransport(verify), **kwargs))

    class Engine:
        async def execute(self, state):
            operations.append(("query", state["input_data"]))
            return {**state, "final_output": "administrator corpus answer"}

        async def list_documents(self, **kwargs):
            operations.append(("list", kwargs))
            return []

        async def delete_document(self, doc_id):
            operations.append(("delete", doc_id))
            return {"deleted": True}

    monkeypatch.setattr(rag_router, "_get_engine", Engine)
    app = FastAPI()
    app.include_router(rag_router.router)
    app.include_router(orchestration_router.router)
    layer = AIOrchestrationLayer.__new__(AIOrchestrationLayer)
    layer.rag_engine = Engine()
    layer.enable_error_handling = False

    class Runtime:
        async def invoke(self, state):
            # Deterministic routing into the real guarded capability, no model.
            return await layer.execute_rag_query(state)

        async def astream(self, state):
            yield {"rag_system": await layer.execute_rag_query(state)}

    app.state.ai_control_plane = AIControlPlaneState(
        orchestrator=Runtime(),
        context_store=SimpleNamespace(load_user_profile=lambda user_id: {}),
        memory_manager=SimpleNamespace(get_history=lambda session_id: [], save_interaction=lambda **kwargs: None),
    )
    return app, client_type, checks, operations


@pytest.mark.asyncio
async def test_rag_http_routes_reject_unauthenticated_and_regular_users(rag_api):
    app, client_type, checks, operations = rag_api
    routes = (
        ("POST", "/rag/documents/upload", {"files": {"file": ("sample.txt", b"sample", "text/plain")}}),
        ("GET", "/rag/documents/upload/status/job-1", {}),
        ("GET", "/rag/documents/upload/jobs", {}),
        ("GET", "/rag/documents", {}),
        ("GET", "/rag/documents/doc-1", {}),
        ("DELETE", "/rag/documents/doc-1", {}),
        ("DELETE", "/rag/documents/user/7", {}),
        ("POST", "/rag/query", {"json": {"query": "sample", "user_id": 7}}),
        ("GET", "/rag/stats", {}),
        ("GET", "/rag/health", {}),
    )
    spoofed = {"X-Auth-User": "admin", "X-Auth-Roles": "ROLE_ADMIN",
               "X-Internal-Service-Name": "ai-orchestration", "X-Internal-Service-Token": "ai-token"}
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://rag") as client:
        for method, path, payload in routes:
            for headers, expected in (({}, 401), (spoofed, 401),
                                      ({**spoofed, "Authorization": "Bearer regular-user"}, 403)):
                response = await client.request(method, path, headers=headers, **payload)
                assert response.status_code == expected, (method, path, response.text)
    assert operations == []
    assert len(checks) == len(routes)
    assert all(request.url.path == "/cloudapp/user/admin/auth-check" for request in checks)


@pytest.mark.asyncio
async def test_verified_admin_can_read_and_delete_shared_corpus_documents(rag_api):
    app, client_type, checks, operations = rag_api
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://rag") as client:
        response = await client.get("/rag/documents?user_id=7", headers={"Cookie": "CLOUDAPP_AUTH=administrator"})
        assert response.status_code == 200
        assert response.json()["user_id"] == 7
        response = await client.delete("/rag/documents/doc-1", headers={"Authorization": "Bearer administrator"})
        assert response.status_code == 200 and response.json()["deleted"] is True
    assert operations == [("list", {"user_id": 7, "limit": 100}), ("delete", "doc-1")]
    assert len(checks) == 2


@pytest.mark.asyncio
async def test_orchestration_cannot_bypass_rag_administrator_policy(rag_api):
    app, client_type, checks, operations = rag_api
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://rag") as client:
        for mode in ("rag_query", "conversational"):
            response = await client.post("/orchestrate", headers={
                "Authorization": "Bearer regular-user", "X-Auth-Roles": "ROLE_ADMIN",
                "X-Internal-Service-Name": "ai-orchestration", "X-Internal-Service-Token": "ai-token",
            }, json={"message": "query documents", "user_id": "verified-admin", "session_id": "denied", "orchestration_type": mode,
                     "context": {"roles": ["ROLE_ADMIN"], "approval_status": "approved"}})
            assert response.status_code == 403, (mode, response.text)
        response = await client.post("/orchestrate", headers={"Cookie": "CLOUDAPP_AUTH=administrator"},
            json={"message": "query documents", "user_id": "verified-admin", "session_id": "allowed", "orchestration_type": "rag_query"})
        assert response.status_code == 200
        assert response.json()["response"] == "administrator corpus answer"
    assert operations == [("query", "query documents")]
    assert HTTPClient.get_request_context_headers() == {}
    assert any(r.headers.get("cookie") == "CLOUDAPP_AUTH=administrator" for r in checks)


def test_streaming_rag_uses_verified_handshake_credentials(rag_api):
    app, _, _, operations = rag_api
    with TestClient(app) as client:
        with client.websocket_connect("/ws/stream", headers={"Authorization": "Bearer regular-user"}) as websocket:
            websocket.send_json({"message": "query documents", "context": {"roles": ["ROLE_ADMIN"]}})
            assert websocket.receive_json()["type"] == "ack"
            assert websocket.receive_json()["type"] == "error"
        assert operations == []
        with client.websocket_connect("/ws/stream", headers={"Cookie": "CLOUDAPP_AUTH=administrator"}) as websocket:
            websocket.send_json({"message": "query documents"})
            assert websocket.receive_json()["type"] == "ack"
            assert websocket.receive_json()["type"] == "node_end"
            assert websocket.receive_json()["data"]["token"] == "administrator corpus answer"
            assert websocket.receive_json()["type"] == "complete"
    assert operations == [("query", "query documents")]


@pytest.mark.asyncio
async def test_rag_capability_requires_credentials_even_after_approval(rag_api):
    _, _, checks, operations = rag_api
    layer = AIOrchestrationLayer.__new__(AIOrchestrationLayer)
    state = {"capabilities_used": [], "approval_status": "approved", "resuming_from_approval": True,
             "user_context": {"roles": ["ROLE_ADMIN"]}}
    with pytest.raises(auth.HTTPException) as exc:
        await layer.execute_rag_query(state)
    assert exc.value.status_code == 401
    assert state["capabilities_used"] == []
    assert checks == operations == []


@pytest.mark.asyncio
async def test_parallel_rag_checks_credentials_in_worker_tasks(rag_api):
    _, _, _, operations = rag_api
    layer = AIOrchestrationLayer.__new__(AIOrchestrationLayer)
    layer.enable_parallel = True
    layer.parallel_manager = ParallelExecutionManager(max_workers=2)
    try:
        for headers in ({}, {"Authorization": "Bearer regular-user"}):
            state = {"request_id": "parallel-denied", "user_id": "regular-user", "input_data": "query documents",
                     "capabilities_used": [], "execution_path": [], "logs": [], "metrics": {}, "intermediate_results": {}}
            token = HTTPClient.set_request_context_headers(headers)
            try:
                with pytest.raises(auth.HTTPException) as exc:
                    await layer.parallel_coordinator(state)
                assert exc.value.status_code in (401, 403)
            finally:
                HTTPClient.reset_request_context_headers(token)
        assert operations == []
    finally:
        layer.parallel_manager.executor.shutdown(wait=True)


@pytest.mark.asyncio
async def test_rag_resume_cannot_elevate_the_original_requester(rag_api, monkeypatch):
    app, client_type, _, operations = rag_api
    app.include_router(approvals_router.router)
    monkeypatch.setattr(approvals_router, "_orchestrator", app.state.ai_control_plane.orchestrator)
    monkeypatch.setattr(approvals_router, "_context_store", app.state.ai_control_plane.context_store)
    monkeypatch.setattr(approvals_router, "_memory_manager", app.state.ai_control_plane.memory_manager)
    store = approvals_router.ApprovalStorage()
    store._initialized = True
    monkeypatch.setattr(approvals_router, "storage", store)
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://rag") as client:
        for requester, expected in (("regular-user", "error"), ("verified-admin", "completed")):
            approval = {
                "status": "approved", "requester_id": requester, "orchestration_id": "rag-resume",
                "execution_context": {"next_capability": "rag", "rag_query": "query documents"},
                "context": {"state_summary": {"session_id": "resume-session", "input": "query documents"}},
            }
            approval["operation_digest"] = approvals_router.operation_digest(approval)
            # Distinct approvals are distinct execution keys.
            approval_id = "resume-rag-" + requester
            await store.add_pending(approval_id, approval)
            response = await client.post(f"/approvals/pending/{approval_id}/resume",
                headers={"Cookie": "CLOUDAPP_AUTH=administrator"}, json={"session_id": "ignored"})
            assert response.status_code == (403 if requester == "regular-user" else 200), response.text
            if response.status_code == 200:
                assert response.json()["status"] == expected
    assert operations == [("query", "query documents")]
    assert HTTPClient.get_request_context_headers() == {}


@pytest.mark.asyncio
async def test_rag_authentication_failures_deny_access(rag_api, monkeypatch):
    app, client_type, _, operations = rag_api
    failures = (
        httpx.Response(302, headers={"Location": "/login"}),
        httpx.Response(500),
        httpx.Response(200, json=[]),
        httpx.Response(200, json={"roles": ["ROLE_ADMIN"]}),
        httpx.Response(200, json={"username": "regular", "roles": ["ROLE_USER"]}),
    )
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://rag") as client:
        for failure in failures:
            monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: client_type(
                transport=httpx.MockTransport(lambda request: failure), **kwargs))
            response = await client.get("/rag/documents", headers={"Authorization": "Bearer administrator"})
            assert response.status_code in (403, 503)
        def unavailable(request):
            raise httpx.ConnectError("identity provider unavailable", request=request)
        monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: client_type(
            transport=httpx.MockTransport(unavailable), **kwargs))
        assert (await client.get("/rag/documents", headers={"Authorization": "Bearer administrator"})).status_code == 503
    assert operations == []
