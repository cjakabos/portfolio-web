"""Approved operations have a single execution claim and immutable payload."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request
from routers import approvals_router as router
from test_approvals_router import FakeContextStore, FakeMemoryManager


@pytest.fixture
def execution(monkeypatch):
    approval = {"request_id": "single", "orchestration_id": "workflow", "requester_id": "alice",
                "status": "approved", "context": {"state_summary": {"session_id": "original", "input": "continue"}},
                "execution_context": {"next_capability": "agent"}}
    approval["operation_digest"] = router.operation_digest(approval)
    storage = router.ApprovalStorage()
    storage._initialized = True
    storage._history = [approval]
    calls = []
    async def invoke(state, config):
        calls.append(state)
        await asyncio.sleep(.01)
        return {"final_output": "done", "execution_path": [], "capabilities_used": []}
    async def noop():
        pass
    monkeypatch.setattr(router, "storage", storage)
    monkeypatch.setattr(router, "_ensure_initialized", noop)
    monkeypatch.setattr(router, "_orchestrator", SimpleNamespace(graph=SimpleNamespace(ainvoke=invoke)))
    monkeypatch.setattr(router, "_context_store", FakeContextStore())
    monkeypatch.setattr(router, "_memory_manager", FakeMemoryManager())
    return storage, calls, approval


async def resume(extra=None):
    return await router.resume_after_approval("single", router.ResumeRequest(session_id="ignored", additional_context=extra),
                                               Request({"type": "http", "headers": []}), admin_user="alice")


@pytest.mark.asyncio
async def test_sequential_retry_returns_cached_result_without_execution(execution):
    storage, calls, _ = execution
    first, second = await resume(), await resume()
    assert first.model_dump() == second.model_dump()
    assert first.status == "completed"
    assert len(calls) == 1
    assert storage._executions["single"]["state"] == "completed"


@pytest.mark.asyncio
async def test_concurrent_resume_starts_only_one_graph(execution):
    _, calls, _ = execution
    results = await asyncio.gather(resume(), resume(), return_exceptions=True)
    assert len(calls) == 1
    assert sum(isinstance(result, HTTPException) and result.status_code == 409 for result in results) == 1


@pytest.mark.asyncio
async def test_modified_operation_or_unreviewed_context_cannot_execute(execution):
    _, calls, approval = execution
    with pytest.raises(HTTPException) as error:
        await resume({"planned_tool_calls": [{"tool": "different"}]})
    assert error.value.status_code == 400
    approval["execution_context"]["next_capability"] = "ml"
    with pytest.raises(HTTPException) as error:
        await resume()
    assert error.value.status_code == 409
    assert calls == []


@pytest.mark.asyncio
async def test_uncertain_execution_never_automatically_retries(execution, monkeypatch):
    storage, calls, _ = execution
    async def fail(state, config):
        calls.append(state)
        raise RuntimeError("unknown downstream outcome")
    monkeypatch.setattr(router._orchestrator.graph, "ainvoke", fail)
    assert (await resume()).status == "error"
    assert storage._executions["single"]["state"] == "uncertain"
    with pytest.raises(HTTPException) as error:
        await resume()
    assert error.value.status_code == 409
    assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["pending", "rejected", "expired", "timeout", "flagged"])
async def test_nonapproved_states_never_execute(execution, status):
    _, calls, approval = execution
    approval["status"] = status
    try:
        result = await resume()
        assert result.status in {"rejected", "expired"}
    except HTTPException as error:
        assert error.status_code in {400, 409}
    assert calls == []


@pytest.mark.asyncio
async def test_another_administrator_cannot_supply_requester_authority(execution):
    _, calls, _ = execution
    with pytest.raises(HTTPException) as error:
        await router.resume_after_approval("single", router.ResumeRequest(session_id="original"),
            Request({"type": "http", "headers": []}), admin_user="another-administrator")
    assert error.value.status_code == 403
    assert calls == []
