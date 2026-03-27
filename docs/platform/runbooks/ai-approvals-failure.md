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
