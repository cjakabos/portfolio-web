# AI Monitor Boundary

This document defines the governed boundary for the AI orchestration monitor.
It complements the AI/operator ADR by pinning the current code-level client
surface and the operator actions the app is allowed to expose.

## Canonical Client Surface

- `ai-orchestration/ai-orchestration-monitor/services/orchestrationClient.ts`
  is the only supported app-local client surface for monitor data access.
- Approval and RAG operations are folded into that client so the monitor no
  longer maintains separate `approvalClient` and `ragClient` stacks.
- Shared CloudApp authentication remains in `@portfolio/auth`, while monitor
  feature calls flow through the canonical orchestration client.

## Auth Boundary

- The monitor is an admin-only operator app.
- Sign-in and session refresh require the CloudApp admin auth check exposed
  through the gateway.
- Browser access reaches AI routes through `/ai/*` and CloudApp admin routes
  through `/cloudapp-admin/*`.

## Capability Matrix

| Monitor surface | Capability class | Primary routes | Notes |
|---|---|---|---|
| Command Center | Read-only, Action, Gateway admin | `/ai/*`, `/ai/system/*` | Mixed operator surface combining status, chat, and approvals |
| Observability | Read-only, Gateway admin | `/ai/health`, `/ai/metrics`, `/ai/system/*` | Metrics, health, feature status, connection stats, circuit breakers |
| Error Handling | Read-only, Gateway admin | `/ai/system/errors/*` | Error summaries and recent failures only |
| Tools Explorer | Read-only, Action | `/ai/tools/*` | Discovery plus explicit tool invocation |
| Documents (RAG) | Read-only, Action | `/ai/rag/*` | Upload, query, async job polling, and delete actions |
| All Services | Read-only, Gateway admin | `/cloudapp-admin/*`, `/petstore/*`, `/vehicles/*`, `/mlops-segmentation/*` | Service inspection surface, not a product console |
| Live Chat | Action | `/ai/orchestrate`, `/ai/ws/stream` | Operator-triggered orchestration and streaming |
| Approvals | Read-only, Action | `/ai/approvals/*`, `/ai/approvals/ws` | Review, decide, and resume approval flows |
| User Management | Read-only, Action, Gateway admin | `/cloudapp-admin/user/admin/*` | CloudApp role management only |

## Rules

- New monitor features must attach to `orchestrationClient.ts` instead of
  creating a new per-feature API client.
- New write-capable actions require an explicit route classification:
  read-only visibility, operator action, or gateway-admin.
- Any new admin-only action must be backed by a gateway-enforced route before
  it is exposed in the UI.
- Product-facing flows belong in product apps, not in the monitor, unless the
  action is explicitly operator-facing.
