import os
import sys
import types
from pathlib import Path

import pytest

SOURCE_ROOT = Path(os.getenv("AI_ORCH_SRC", "")).resolve() if os.getenv("AI_ORCH_SRC") else None
if SOURCE_ROOT is None or not SOURCE_ROOT.exists():
    SOURCE_ROOT = (Path(__file__).resolve().parents[2] / "ai-orchestration/ai-orchestration-layer/src").resolve()

if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from routers import approvals_router


class FakeNotifier:
    def __init__(self):
        self.messages = []

    async def broadcast(self, message):
        self.messages.append(message)


class FakeDecisionStorage:
    def __init__(self, approval):
        self.approval = dict(approval)
        self.history = []

    async def remove_pending(self, request_id):
        if request_id != self.approval["request_id"]:
            return None
        return dict(self.approval)

    async def add_to_history(self, data):
        self.history.append(dict(data))


class FakeResumeStorage:
    def __init__(self, approval):
        self.approval = dict(approval)

    async def get_approval(self, request_id):
        if request_id != self.approval["request_id"]:
            return None
        return dict(self.approval)


class FakeContextStore:
    def __init__(self):
        self.loaded_user_ids = []

    def load_user_profile(self, user_id):
        self.loaded_user_ids.append(user_id)
        return {"user_id": user_id, "preferences": {}}


class FakeMemoryManager:
    def __init__(self):
        self.session_ids = []
        self.saved = []

    def get_history(self, session_id):
        self.session_ids.append(session_id)
        return []

    def save_interaction(self, session_id, user_message, assistant_response, metadata):
        self.saved.append(
            {
                "session_id": session_id,
                "user_message": user_message,
                "assistant_response": assistant_response,
                "metadata": metadata,
            }
        )


class FakeGraph:
    def __init__(self):
        self.calls = []

    async def ainvoke(self, state, config):
        self.calls.append({"state": dict(state), "config": dict(config)})
        return {
            "final_output": "resume-complete",
            "execution_path": ["resume_from_approval", "chat_system"],
            "capabilities_used": ["LLM Gen"],
        }


class FakeOrchestrator:
    def __init__(self):
        self.graph = FakeGraph()


@pytest.mark.asyncio
async def test_decide_approval_uses_authenticated_admin_identity(monkeypatch):
    approval = {
        "request_id": "apr_123",
        "orchestration_id": "orch_123",
        "approval_type": approvals_router.ApprovalType.AGENT_ACTION.value,
        "status": approvals_router.ApprovalStatus.PENDING.value,
        "created_at": "2026-01-01T00:00:00Z",
        "expires_at": "2026-01-01T00:05:00Z",
        "requester_id": "alice",
        "proposed_action": "Run tool",
        "risk_level": approvals_router.RiskLevel.HIGH.value,
        "risk_score": 0.9,
        "risk_factors": ["sensitive"],
        "context": {"state_summary": {}},
        "execution_context": {"next_capability": "chat"},
    }
    fake_storage = FakeDecisionStorage(approval)
    fake_notifier = FakeNotifier()

    async def noop():
        return None

    monkeypatch.setattr(approvals_router, "_ensure_initialized", noop)
    monkeypatch.setattr(approvals_router, "storage", fake_storage)
    monkeypatch.setattr(approvals_router, "notifier", fake_notifier)

    decision = approvals_router.ApprovalDecision(
        approved=True,
        approver_id="spoofed-user",
        approval_notes="ship it",
    )
    result = await approvals_router.decide_approval(
        "apr_123",
        decision,
        admin_user="admin-user",
    )

    assert result.approver_id == "admin-user"
    assert fake_storage.history[0]["approver_id"] == "admin-user"
    assert fake_notifier.messages[0]["data"]["approver_id"] == "admin-user"


@pytest.mark.asyncio
async def test_resume_after_approval_uses_original_requester_identity(monkeypatch):
    approval = {
        "request_id": "apr_456",
        "orchestration_id": "orch_456",
        "approval_type": approvals_router.ApprovalType.AGENT_ACTION.value,
        "status": approvals_router.ApprovalStatus.APPROVED.value,
        "created_at": "2026-01-01T00:00:00Z",
        "expires_at": "2026-01-01T00:05:00Z",
        "requester_id": "alice",
        "approver_id": "admin-user",
        "proposed_action": "Continue workflow",
        "risk_level": approvals_router.RiskLevel.HIGH.value,
        "risk_score": 0.9,
        "risk_factors": ["sensitive"],
        "context": {
            "state_summary": {
                "session_id": "sess-original",
                "input": "resume this request",
            }
        },
        "execution_context": {"next_capability": "chat"},
    }
    fake_storage = FakeResumeStorage(approval)
    fake_context_store = FakeContextStore()
    fake_memory_manager = FakeMemoryManager()
    fake_orchestrator = FakeOrchestrator()
    captured_sync = {}

    async def noop():
        return None

    async def store_resume_response(**kwargs):
        captured_sync.update(kwargs)

    conversation_sync_module = types.ModuleType("routers.conversation_sync")
    conversation_sync_module.store_resume_response = store_resume_response

    monkeypatch.setattr(approvals_router, "_ensure_initialized", noop)
    monkeypatch.setattr(approvals_router, "storage", fake_storage)
    monkeypatch.setattr(approvals_router, "_context_store", fake_context_store)
    monkeypatch.setattr(approvals_router, "_memory_manager", fake_memory_manager)
    monkeypatch.setattr(approvals_router, "_orchestrator", fake_orchestrator)
    monkeypatch.setitem(sys.modules, "routers.conversation_sync", conversation_sync_module)

    result = await approvals_router.resume_after_approval(
        "apr_456",
        approvals_router.ResumeRequest(session_id="ignored-by-server"),
        admin_user="admin-user",
    )

    graph_call = fake_orchestrator.graph.calls[0]
    assert fake_context_store.loaded_user_ids == ["alice"]
    assert fake_memory_manager.session_ids == ["sess-original"]
    assert graph_call["state"]["user_id"] == "alice"
    assert graph_call["state"]["session_id"] == "sess-original"
    assert captured_sync["session_id"] == "sess-original"
    assert result.status == "completed"
    assert result.response == "resume-complete"
