# AI Runbook: Approvals Failure

Use this runbook when the operator approval queue is missing, stale, or unable
to process decisions.

## Trigger

- the approvals panel cannot load pending requests
- approval decisions fail or never clear the queue
- approval resume completes with an error or never updates the chat surface
- `GET /ai/approvals/health` shows unexpected storage or orchestrator state

## Likely Causes

- Redis is unavailable and approvals fell back to memory
- the orchestrator or HITL manager is not connected
- admin auth is failing for approvals API or WebSocket requests
- conversation sync failed, so resume results are not visible in the monitor

## Immediate Checks

1. Call `GET /ai/approvals/health`.
2. Confirm:
   - `storage`
   - `orchestrator_available`
   - `hitl_manager_available`
3. Check the browser network tab for:
   - `GET /ai/approvals/pending`
   - `WS /ai/approvals/ws`
   - `POST /ai/approvals/pending/{id}/decide`
4. If approvals can be listed but resume output is missing, check whether the
   conversation-sync initialization failed at startup.

## Containment

1. If Redis is down but approvals are still working in memory, avoid restarting
   the AI service until Redis is restored or the queue is drained.
2. If admin auth is failing, stop asking operators to retry decisions and move
   to the operator-access runbook.
3. If only resume visibility is affected, use the approval history endpoint to
   confirm whether the decision actually completed.

## Recovery

1. Restore Redis if approval durability is required.
2. Restart the AI service only after Redis is healthy, so approvals reconnect to
   the durable backend.
3. Re-test:
   - create one approval request
   - list it in `/ai/approvals/pending`
   - approve it
   - confirm it appears in history and, if applicable, in the resumed chat
4. Verify the approvals WebSocket reconnects from the monitor.

## Escalate When

- approvals health reports `hitl_manager_available: false`
- a recreated approval still cannot be resumed after Redis recovery
- multiple approvals disappeared because the service restarted while running on
  in-memory fallback

## Aftercare

- record whether any approvals were lost because fallback storage was in memory
- capture whether the issue was auth, persistence, or orchestrator coupling
- update the incident notes with any requests that needed manual replay

## Approval manager unavailable

Required human approval remains mandatory when HITL is disabled, cannot import,
or has no manager. Explicit/risk-gated operations fail with 503 before agent, ML
or workflow execution, including parallel capability entry. Do not disable HITL
to bypass a blocked action. Restore the manager, obtain the required approval,
and retry with fresh evidence. Read-only/low-risk operations remain available.

## Claimed or uncertain approval execution

Decisions bind the reviewed requester, operation, execution context and approved
modifications. Resume cannot append unreviewed context. Old approved records
without a binding require a fresh approval. One atomic execution claim prevents
concurrent/repeated resumes; completed retries return the stored result.

Redis claims/outcomes survive storage-instance restart. Memory mode is local to
one process and loses approvals on restart; it is unsuitable for shared durable
operation. Claims outlive the full approval-key retention. If execution is
running or uncertain, the service returns 409 and never automatically reruns
side effects. Inspect downstream state, preserve the claim, and obtain a new
reviewed operation after reconciliation. Do not delete a claim to retry an
unknown write. HTTP tools automatically retry safe reads only; writes execute
once unless a separately governed downstream idempotency contract is added.
