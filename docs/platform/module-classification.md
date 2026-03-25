# Module Classification And Legacy Inventory

This document labels the main repo modules as one of:

- `core platform`
- `operator support`
- `legacy/demo-derived`

The goal is to make it obvious which modules define the platform direction and
which ones are retained primarily for breadth, historical reasons, or showcase
coverage.

## Classification Rules

### Core platform

Core platform modules define the current architecture, developer workflow, or
primary product/operator journeys. These modules should receive the highest
governance and testing priority.

### Operator support

Operator support modules exist to operate, observe, or control platform
capabilities rather than to serve end users directly.

### Legacy/demo-derived

Legacy/demo-derived modules may still be functional and integrated, but they
either came from earlier sample/starter projects or represent showcase breadth
more than the platform's long-term spine.

## Current Classification

| Path | Classification | Why it is classified this way | Current posture |
| --- | --- | --- | --- |
| `frontend/nginx` | `core platform` | The gateway is the browser-facing policy boundary for auth, CORS, AI route protection, and websocket routing | Treat as platform-critical |
| `frontend/cloudapp-shell` | `core platform` | Main product shell and user entrypoint | Treat as the primary web product surface |
| `backend/cloudapp` | `core platform` | Main transactional backend for auth, catalog, cart, orders, notes, files, and chat | Treat as the primary domain service |
| `ai-orchestration/ai-orchestration-layer` | `core platform` | Defines the AI orchestration boundary and integrates with core product services | Treat as the primary AI service layer |
| `frontend/remote/jira` | `core platform` | Integrated admin workflow with active gateway/backend usage | Keep governed as an active product integration |
| `frontend/remote/mlops` | `core platform` | Integrated workflow backed by a live service and routed through the platform stack | Keep governed as an active product integration |
| `frontend/remote/openmaps` | `core platform` | Active user-facing module in the shell and part of the routed browser surface | Keep governed as an active product integration |
| `frontend/remote/chatllm` | `core platform` | Active browser-facing AI surface that participates in shell navigation and nightly AI checks | Keep governed as an active AI/product module |
| `ai-orchestration/ai-orchestration-monitor` | `operator support` | Dedicated operator-facing UI for orchestration, approvals, health, and tools | Keep separate from the product UI and govern like an operator app |
| `backend/petstore` | `legacy/demo-derived` | Course-derived domain retained as a working integrated module rather than as the platform spine | Keep functional, but do not treat as the default pattern for new domains |
| `frontend/remote/petstore` | `legacy/demo-derived` | Browser surface for the petstore domain; useful for breadth, but not part of the primary platform spine | Maintain only with clear scope and avoid expanding the pattern casually |
| `backend/vehicles-api` | `legacy/demo-derived` | Historical demo domain with narrower architectural alignment to the current platform defaults | Keep working, but treat as an exception under review |
| `frontend/remote/moduletemplate` | `legacy/demo-derived` | Scaffolding/template remote, not a product-bearing deployable | Do not promote to an active module without explicit adoption |

## Sample-Derived And Historical Notes

### `backend/vehicles-api`

- This service remains useful as a routed integration target, but it is not the
  preferred reference implementation for new transactional services.
- Future cleanup should focus on dependency hygiene and explicit long-term keep
  versus retire decisions.

### `frontend/remote/petstore` and `backend/petstore`

- These modules demonstrate breadth and remain integrated with the platform.
- They should not be used to justify adding more one-off domains without a
  clear platform reason.

### `ai-orchestration/ai-orchestration-monitor`

- The monitor previously carried stale scaffold-style documentation and naming
  drift, but the active docs and config no longer present it as generated
  AI Studio scaffolding.
- The remaining posture is `operator support`, not `legacy/demo-derived`.

## Review Guidance

Use this inventory during review when a change:

1. expands a `legacy/demo-derived` module
2. proposes a new browser surface
3. claims a module is part of the long-term platform spine
4. introduces a new shared pattern based on a legacy/demo-derived module
