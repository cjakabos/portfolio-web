"""Missing HITL cannot turn explicit/risk-gated requests into side effects."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from core.orchestrator import AIOrchestrationLayer
from core.state import OrchestrationType


@pytest.fixture
def layer():
    instance = AIOrchestrationLayer.__new__(AIOrchestrationLayer)
    instance.enable_hitl = False
    instance.hitl_manager = None
    instance.enable_parallel = False
    instance.enable_error_handling = False
    return instance


def state(kind=OrchestrationType.AGENT_ROUTING, query="delete all records", **extra):
    return {"orchestration_type": kind, "input_data": query,
            "capabilities_used": [], **extra}


@pytest.mark.parametrize("enabled", [False, True])
def test_explicit_and_risky_routing_fail_closed_without_manager(layer, enabled):
    layer.enable_hitl = enabled
    for request in (state(), state(query="hello", requires_human=True),
                    state(OrchestrationType.ML_PIPELINE, "transfer money")):
        with pytest.raises(HTTPException) as error:
            layer.decide_execution_strategy(request)
        assert error.value.status_code == 503
        assert request.get("approval_status") != "auto_approved"


def test_low_risk_chat_survives_and_restored_manager_routes_to_review(layer):
    assert layer.decide_execution_strategy(state(OrchestrationType.CONVERSATIONAL, "hello")) == "chat"
    layer.enable_hitl = True
    layer.hitl_manager = object()
    assert layer.decide_execution_strategy(state()) == "human_review"


@pytest.mark.asyncio
async def test_parallel_or_direct_capability_cannot_execute_gated_side_effect(layer):
    calls = []
    async def execute(request):
        calls.append(request)
        return request
    layer.agent_executor = layer.ml_orchestrator = layer.workflow_executor = SimpleNamespace(execute=execute)
    for method in (layer.execute_agent_system, layer.execute_ml_pipeline, layer.execute_workflow):
        request = state(OrchestrationType.CONVERSATIONAL, "transfer money", requires_human=True)
        with pytest.raises(HTTPException):
            await method(request)
    assert calls == []


@pytest.mark.asyncio
async def test_direct_human_review_never_fabricates_approval(layer):
    request = state()
    with pytest.raises(HTTPException):
        await layer.human_review_node_risk_based(request)
    assert "approval_status" not in request
