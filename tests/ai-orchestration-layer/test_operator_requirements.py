import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

import auth
from core.app_state import AIControlPlaneState
from core.human_in_loop import HumanInLoopManager, ApprovalType, ApprovalStatus, OrchestrationType
from routers import approvals_router, tools_router
from tools.tool_manager import ToolManager
from tools.http_client import HTTPClient, ServiceHTTPClients


@pytest.fixture
def operator_api(monkeypatch):
    original_client = httpx.AsyncClient
    checks = []

    def cloudapp(request):
        checks.append(request)
        if request.headers.get("authorization") != "Bearer administrator":
            return httpx.Response(403, json={"detail": "Admin access required"})
        return httpx.Response(200, json={"username": "verified-admin", "roles": ["ROLE_ADMIN"]})

    monkeypatch.setattr(auth, "get_config", lambda: SimpleNamespace(services=SimpleNamespace(
        cloudapp_url="http://cloudapp.test/cloudapp", http_timeout=5,
        internal_gateway_admin_token="", internal_ai_orchestration_token="")))
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: original_client(
        transport=httpx.MockTransport(cloudapp), **kwargs))
    storage = approvals_router.ApprovalStorage()
    storage._initialized = True
    monkeypatch.setattr(approvals_router, "storage", storage)
    monkeypatch.setattr(approvals_router, "notifier", approvals_router.ApprovalNotifier())
    app = FastAPI()
    app.include_router(approvals_router.router)
    return app, storage, checks, original_client


@pytest.mark.asyncio
async def test_operator_http_routes_reject_unauthenticated_and_regular_users(operator_api):
    app, _, checks, client_type = operator_api
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://operator") as client:
        for path in ["/approvals/pending", "/approvals/history", "/approvals/stats"]:
            assert (await client.get(path)).status_code == 401
            assert (await client.get(path, headers={"Authorization": "Bearer regular-user"})).status_code == 403
        assert len(checks) == 3
        assert all(r.url.path == "/cloudapp/user/admin/auth-check" for r in checks)


@pytest.mark.asyncio
async def test_real_risk_gate_stays_pending_and_is_visible_in_operator_queue(operator_api):
    app, storage, _, client_type = operator_api
    manager = HumanInLoopManager(router_storage=storage)
    state = {"request_id": "risk-test", "user_id": "alice", "session_id": "s1", "input_data": "delete all records",
             "logs": [], "orchestration_type": OrchestrationType.AGENT_ROUTING, "intermediate_results": {}}
    status, approval = await manager.request_approval_risk_based(state, "agent", ApprovalType.AGENT_ACTION)
    assert approval.risk_score >= 0.3
    assert status == ApprovalStatus.PENDING
    assert state["auto_approved"] is False
    wait = asyncio.create_task(manager.wait_for_approval(approval, state))
    try:
        await asyncio.sleep(0)
        assert not wait.done()
        async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://operator") as client:
            queue = await client.get("/approvals/pending", headers={"Authorization": "Bearer administrator"})
        assert queue.status_code == 200
        assert queue.json()[0]["request_id"] == approval.request_id
        assert queue.json()[0]["status"] == "pending"
        assert not wait.done()
        await manager.process_approval(approval.request_id, "verified-admin", True)
        assert (await asyncio.wait_for(wait, 1))[0] == ApprovalStatus.APPROVED
    finally:
        if not wait.done():
            wait.cancel()
            await asyncio.gather(wait, return_exceptions=True)


@pytest.mark.asyncio
async def test_http_approval_and_rejection_use_verified_identity_and_history(operator_api):
    app, storage, checks, client_type = operator_api
    async with client_type(transport=httpx.ASGITransport(app=app), base_url="http://operator") as client:
        for approved in [True, False]:
            request_id = f"decision-{approved}"
            await storage.add_pending(request_id, {"request_id": request_id, "orchestration_id": "orch", "requester_id": "alice",
                "approval_type": "agent_action", "proposed_action": "execute", "risk_level": "high", "risk_score": 0.9,
                "risk_factors": [], "context": {}, "status": "pending", "created_at": "2026-01-01T00:00:00Z",
                "expires_at": "2099-01-01T00:00:00Z"})
            response = await client.post(f"/approvals/pending/{request_id}/decide", headers={"Authorization": "Bearer administrator"},
                json={"approved": approved, "approver_id": "spoofed", "approval_notes": "reviewed"})
            assert response.status_code == 200
            assert response.json()["approver_id"] == "verified-admin"
            assert response.json()["status"] == ("approved" if approved else "rejected")
        history = (await client.get("/approvals/history", headers={"Authorization": "Bearer administrator"})).json()
        assert len(history) == 2
        assert {item["status"] for item in history} == {"approved", "rejected"}
        assert all(item["approver_id"] == "verified-admin" for item in history)
        assert await storage.get_all_pending() == []
        assert all(r.url.path.endswith("/user/admin/auth-check") for r in checks)


@pytest.mark.asyncio
async def test_actual_tool_catalog_and_invocation_execute_the_cloudapp_tool(monkeypatch):
    requests = []
    def downstream(request):
        requests.append(request)
        return httpx.Response(200, json={"id": 42, "name": "Acceptance item", "price": 12.5})
    pooled = HTTPClient(base_url="http://cloudapp.test/cloudapp")
    pooled._client = httpx.AsyncClient(base_url="http://cloudapp.test/cloudapp", transport=httpx.MockTransport(downstream))
    monkeypatch.setattr(ServiceHTTPClients, "_clients", {"cloudapp": pooled})
    app = FastAPI()
    app.state.ai_control_plane = AIControlPlaneState(tool_manager=ToolManager())
    app.include_router(tools_router.router)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://operator") as client:
            catalog = (await client.get("/tools")).json()
            assert any(tool["name"] == "get_item_by_id" for tool in catalog["tools"])
            response = await client.post("/tools/get_item_by_id/invoke", headers={"Authorization": "Bearer requester"},
                                         json={"parameters": {"item_id": 42}})
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["result"] == {"id": 42, "name": "Acceptance item", "price": 12.5}
        assert len(requests) == 1
        assert requests[0].url.path == "/cloudapp/item/42"
        assert requests[0].headers["authorization"] == "Bearer requester"
        assert HTTPClient.get_request_context_headers() == {}
    finally:
        await pooled.aclose()
