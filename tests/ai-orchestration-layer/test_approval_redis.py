"""Real Redis checks shared atomic claims and restart-safe completed outcomes."""
import asyncio
import os
import uuid

import pytest
from routers.approvals_router import ApprovalStorage


@pytest.mark.asyncio
async def test_redis_claim_is_atomic_and_completion_survives_restart(monkeypatch):
    url = os.getenv("REDIS_TEST_URL")
    if not url:
        pytest.skip("real Redis regression runs in the native Compose suite")
    monkeypatch.setenv("REDIS_URL", url)
    stores = [ApprovalStorage() for _ in range(3)]
    request_id = "claim-test-" + uuid.uuid4().hex
    try:
        for store in stores:
            await store.initialize()
            assert store._use_redis, "requested Redis regression must not fall back to memory"
        results = await asyncio.gather(*(store.claim_execution(request_id, "binding") for store in stores[:2]))
        assert sum(claimed for claimed, _ in results) == 1
        claim = next(record for claimed, record in results if claimed)
        await stores[0].finish_execution(request_id, claim, "completed", {"status": "completed"})
        claimed, record = await stores[2].claim_execution(request_id, "binding")
        assert not claimed and record["state"] == "completed"
        assert record["response"] == {"status": "completed"}
    finally:
        if stores[0]._use_redis:
            await stores[0]._redis_client.delete(f"approval-execution:{request_id}")
        for store in stores:
            if store._redis_client:
                await store._redis_client.aclose()
