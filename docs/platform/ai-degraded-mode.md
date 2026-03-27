# AI Degraded Mode

This document defines the current degraded-mode expectations for the
`ai-orchestration-layer` and the operator monitor.

It assumes the current deployable topology is still in place while browser
deployable reduction remains deferred.

## Purpose

The AI stack is allowed to start and remain partially useful when some
dependencies are unavailable. That posture is intentional, but it only helps if
operators know which capabilities should degrade, which should stop, and which
signals to check before they restart or escalate.

## Dependency Model

| Dependency | Primary responsibility | AI routes most affected |
| --- | --- | --- |
| Ollama / orchestrator runtime | Model execution and orchestration graph startup | `/ai/orchestrate`, `/ai/ws/stream`, `/ai/system/*` |
| Redis | Approval persistence and conversation-sync state | `/ai/approvals/*`, resume visibility in the monitor chat surface |
| MongoDB | Experiment persistence and audit trail storage | `/ai/experiments/*`, operator audit expectations |
| ChromaDB and RAG embedding path | Document indexing and retrieval | `/ai/rag/*` |
| CloudApp admin auth via gateway | Operator authentication and admin-only route access | `/cloudapp-admin/*`, admin-only `/ai/*` paths |

## Degraded-Mode Matrix

| Failure mode | Expected runtime behavior | Operator-visible outcome | Primary checks |
| --- | --- | --- | --- |
| Ollama or orchestrator startup failure | The FastAPI server still starts, but `main.py` leaves the orchestrator unset and routes that call `get_orchestrator()` or require orchestration return `503` or close with `Orchestrator not ready` | Command Center chat, orchestration streaming, and system feature dashboards are unavailable; approvals health can still load and report `orchestrator_available: false` | `GET /ai/approvals/health`, `POST /ai/orchestrate`, `GET /ai/system/feature-status` |
| Redis unavailable for approvals | Approval storage falls back to in-memory and `/ai/approvals/health` reports `storage: memory` | Existing approvals are not durable across restart; approval websocket and list views can still work on the active instance | `GET /ai/approvals/health`, monitor approvals panel, service logs for Redis fallback |
| Redis unavailable for conversation sync | The service logs a warning and keeps running without synchronized resume delivery | Resumed approval decisions may complete, but the chat panel may not auto-populate the resumed answer without a manual refresh or direct lookup | startup logs, approval resume path, monitor chat panel after approval resume |
| MongoDB unavailable | Experiments storage falls back to memory and audit-trail initialization becomes non-fatal | Experiment endpoints stay up with non-durable data; audit history is incomplete or absent until MongoDB returns | `GET /ai/experiments/health`, startup logs for experiment and audit initialization |
| ChromaDB or embedding path unavailable | RAG initialization warns and `/ai/rag/health` becomes `unhealthy` or remains `initializing` | Document upload, retrieval, and query flows fail or stall; other non-RAG AI surfaces can stay available | `GET /ai/rag/health`, upload job status, monitor RAG dashboard |
| CloudApp admin auth or gateway access failure | The operator monitor cannot complete admin auth-checks and admin-only AI routes fail before business logic runs | Login/session refresh fails, approvals and admin dashboards appear unauthorized, WebSocket admin routes reject the connection | `/cloudapp-admin/user/admin/auth-check`, gateway logs, browser network trace |

## Detection Signals

Use these signals before deciding whether the incident is isolated to one
capability or broad enough to page the platform owner.

### Startup and capability checks

- `GET /ai/approvals/health`
  - confirms approval storage backend
  - confirms whether the orchestrator and HITL manager are available
- `GET /ai/rag/health`
  - confirms whether the RAG engine initialized cleanly
- `GET /ai/experiments/health`
  - confirms whether experiments are running on MongoDB or memory
- `GET /ai/system/feature-status`
  - should only be treated as healthy when the orchestrator is actually
    initialized

### User-visible symptoms

- Command Center chat returns `503` or streaming closes immediately
- the approvals panel loads but newly created approvals disappear after restart
- resumed approvals complete in history but do not appear in the chat panel
- RAG uploads remain stuck in `pending` or move to `failed`
- the monitor login loop redirects back to auth or shows `401` / `403`

## Operating Rules

1. Do not bounce the whole AI stack just because a single persistence backend
   degraded to memory. Confirm whether the user-facing capability is still
   meeting the runbook objective first.
2. Treat `storage: memory` as a temporary containment state, not a steady
   operating mode. It is acceptable for short incidents, not for routine
   operation.
3. If the operator monitor is inaccessible, validate gateway auth before
   debugging AI internals. Many admin-path failures are ingress or auth issues,
   not orchestration issues.
4. If `orchestrator_available` is `false`, treat chat and orchestration
   failures as expected until Ollama and orchestrator startup are restored.

## Tabletop Drill

Run this lightweight tabletop before calling the AI stack operationally ready:

1. Stop or block Ollama and confirm the service still boots while
   `/ai/orchestrate` fails and `/ai/approvals/health` reports
   `orchestrator_available: false`.
2. Stop Redis and confirm `/ai/approvals/health` reports `storage: memory`.
   Create and resolve one approval so the operator team sees the degraded
   behavior clearly.
3. Stop MongoDB and confirm `/ai/experiments/health` flips to `storage: memory`
   while the service remains available.
4. Stop ChromaDB or the embedding dependency and confirm `/ai/rag/health`
   becomes unhealthy and the RAG dashboard surfaces the failure.
5. Break admin auth at the gateway and confirm the monitor shows an auth
   failure before any operator action is attempted.

## Related Runbooks

- [runbooks/ai-startup-degradation.md](./runbooks/ai-startup-degradation.md)
- [runbooks/ai-approvals-failure.md](./runbooks/ai-approvals-failure.md)
- [runbooks/ai-rag-ingestion-failure.md](./runbooks/ai-rag-ingestion-failure.md)
- [runbooks/ai-operator-access-failure.md](./runbooks/ai-operator-access-failure.md)
