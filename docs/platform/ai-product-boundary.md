# AI Product Boundary

This document classifies the current AI capabilities in the repo as core
product, operator-only, or experimental. It is intentionally based on the
current branch topology while browser deployable reduction remains deferred.

## Classification Rules

### Core product

The capability is part of the user-facing or committed admin-facing product
experience and should be protected by normal regression expectations.

### Operator-only

The capability exists to operate, observe, or govern the platform. It can be
admin-only, but it is still release-significant.

### Experimental

The capability is real and worth keeping, but it is not yet the committed
default user experience. It should stay behind explicit review, admin usage, or
limited rollout until it graduates.

## Current Capability Map

| Capability | Primary surface | Classification | Release posture | Notes |
| --- | --- | --- | --- | --- |
| Local AI chat in the product UI | `frontend/remote/chatllm/` | `core product` | User-facing regression coverage required | This is the clearest end-user AI path in the repo |
| Jira AI refinement and child-ticket assistance | `frontend/remote/jira/` plus AI-backed flows | `core product` | Admin-path regression coverage required | Admin-facing, but still part of the committed product experience |
| AI monitor dashboards | `ai-orchestration-monitor` | `operator-only` | Release-critical for admin operators | Observability, service health, and error surfaces belong here |
| Approval queue and approval resume controls | `ai-orchestration-monitor` + `/ai/approvals/*` | `operator-only` | Release-critical with admin auth and fallback checks | These are operational control-plane functions, not end-user UX |
| RAG dashboard and document ingestion tools | `ai-orchestration-monitor` + `/ai/rag/*` | `operator-only` | Govern as an operator workflow until a product-facing use case exists | Productization can happen later, but it should not be implied now |
| Model selection and AI control-plane settings | `ai-orchestration-monitor` + `/ai/llm/*` | `operator-only` | Admin-path verification required | This is configuration, not a product feature |
| Cross-service orchestration flows | `ai-orchestration-layer` | `experimental` | Keep behind explicit review and synthetic checks | Useful platform capability, but not yet a stable committed product lane |
| Tool explorer and ad hoc tool invocation | `ai-orchestration-monitor` + `/ai/tools/*` | `experimental` | Admin-only and review-heavy | Valuable for platform breadth, but too flexible to treat as a default product surface |
| AI experimentation and A/B lifecycle routes | `/ai/experiments/*` | `experimental` | Operator-governed and persistence-aware | Keep bounded until experiment governance matures further |

## What This Means In Review

1. `core product` AI changes need user-journey or admin-journey regression
   coverage, not just static checks.
2. `operator-only` AI changes must keep gateway/admin auth, degraded-mode
   expectations, and runbooks current.
3. `experimental` AI changes can move faster, but they should not silently
   redefine the default product promise for end users.

## Deferred Work

This classification does not assume any browser-surface reduction yet. If the
repo later collapses or merges AI browser deployables, update this document in
the same PR so the classification still matches the actual release units.
