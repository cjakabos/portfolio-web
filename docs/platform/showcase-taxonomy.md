# Showcase Taxonomy

This document defines the audience-facing labels used to curate the flagship
platform story. These labels are for communication, prioritization, and
maintenance posture. They do not change runtime behavior or folder layout.

## Labels

### Hero

Hero modules are the main platform story.

- They should appear first in docs and walkthroughs.
- They should have the strongest smoke coverage.
- They should be safe to demonstrate on a fresh setup.

### Supporting

Supporting modules add breadth and credibility.

- They demonstrate integrations, adjacent workflows, or technical depth.
- They should be easy to discover, but they are not required for the first
  impression.
- They should not overshadow hero paths in README or tour docs.

### Optional

Optional modules are valuable extensions.

- They may require extra dependencies, extra setup, or a longer walkthrough.
- They should never block the main showcase path.
- They remain worth keeping when they add a distinct capability or learning
  signal.

### Operator tooling

Operator tooling is not part of the end-user product shell, but it is part of
the platform story.

- These surfaces support observability, orchestration, approvals, or governance.
- They should have their own tour and verification path.

### Template / scaffold

Template or scaffold modules exist as accelerators, not as headline demos.

- They should be clearly marked so readers do not confuse them for active
  showcase modules.
- They can be retained when they reduce future setup cost or demonstrate a
  repeatable pattern.

## Current Mapping

| Area | Label | Why |
| --- | --- | --- |
| `frontend/cloudapp-shell` | `Hero` | Primary user-facing entrypoint and main browser surface |
| `frontend/nginx` | `Hero` | Platform policy boundary for browser and AI traffic |
| `backend/cloudapp` | `Hero` | Main transactional service and authentication boundary |
| `ai-orchestration/ai-orchestration-layer` | `Hero` | AI-platform differentiator and orchestration boundary |
| `frontend/remote/openmaps` | `Supporting` | User-facing remote that proves module federation and routed integrations |
| `frontend/remote/chatllm` | `Supporting` | AI-native browser surface tied to local models and the platform story |
| `frontend/remote/jira` | `Supporting` | Admin workflow and external integration showcase |
| `frontend/remote/mlops` | `Supporting` | Python-backed analytics workflow with routed UI integration |
| `ai-orchestration/ai-orchestration-monitor` | `Operator tooling` | Dedicated operator console for orchestration, approvals, and observability |
| `frontend/remote/petstore` | `Optional` | Extra breadth module for business-domain diversity |
| `backend/petstore` | `Optional` | Supporting backend for the optional Petstore showcase |
| `backend/vehicles-api` | `Optional` | Extra routed domain that adds platform breadth |
| `frontend/remote/moduletemplate` | `Template / scaffold` | Starting point for future remote modules, not an active showcase surface |

## Reader-Facing Guidance

- Use these labels in README, tour docs, screenshots, and demo scripts.
- Do not use these labels to imply that optional modules are abandoned or low
  quality.
- Prefer `supporting` or `optional` over `legacy/demo-derived` in public-facing
  docs. The older wording is still useful only as internal historical context.
