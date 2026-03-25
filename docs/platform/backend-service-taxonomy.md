# Backend Service Taxonomy

This taxonomy narrows the repo-wide module classification down to backend
services and defines the expected governance posture for each category.

## Classification Groups

### Core platform

Core platform services define the primary transactional or ingress-backed
product behavior. They are the reference pattern for new backend work.

### AI and operator support

These services exist to operate, extend, or observe platform capabilities.
They are production-significant, but they are not the default blueprint for
new transactional domains.

### Demo or portfolio module

These services remain integrated and useful, but they represent breadth or
legacy sample lineage more than the platform spine.

## Current Backend Classification

| Service | Classification | Why | Expected posture |
| --- | --- | --- | --- |
| `cloudapp` | `core platform` | Primary transactional backend for auth, catalog, cart, orders, notes, files, and chat | Highest governance; default Spring service pattern |
| `jiraproxy` | `core platform` | Active gateway-backed integration used by the product UI | Govern as a first-class product integration |
| `ai-orchestration-layer` | `AI and operator support` | Owns orchestration, approvals, RAG, and operator-visible AI flows | Govern as a platform capability with explicit operational policies |
| `mlops-segmentation` | `AI and operator support` | Supports ML workflows rather than the main transactional spine | Keep aligned with AI/service governance, not as the default domain template |
| `petstore` | `demo or portfolio module` | Working integrated module, but not the preferred long-term domain template | Keep functional; avoid using it to justify new one-off domains |
| `vehicles-api` | `demo or portfolio module` | Historical sample-derived service with narrower alignment to current platform defaults | Keep as an exception under review and minimize dependency drift |

## Review Guidance

Use this taxonomy when reviewing backend changes:

1. New shared backend patterns should come from `cloudapp` or an approved core
   platform service.
2. AI/operator support services can justify exceptions when the capability is
   genuinely operator- or AI-specific.
3. Demo or portfolio modules should not define default runtime, storage, or
   service-layer patterns for new work.
