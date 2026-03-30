# Showcase Demo Contract

This document defines the supported setup modes for the flagship platform.

## Supported Modes

### Portfolio mode

Portfolio mode is the default entrypoint for the flagship platform.

- Goal: produce the shortest path to a strong first impression.
- Required dependencies: Docker, OpenSSL, `.env`, JWT keys.
- Required services: gateway, shell, CloudApp backend, OpenMaps, vehicles API,
  and the core datastores behind those paths.
- Expected outcome: the 10-minute demo is runnable with seeded demo users,
  seeded portfolio content, deterministic paths, and no optional remotes in the
  shell navigation.

### Extended setup

Extended setup expands the platform breadth.

- Goal: unlock supporting integrations such as Jira, MLOps, ChatLLM, and
  Petstore.
- Additional dependencies: more local resources and optional integration
  credentials.
- Expected outcome: supporting modules are available, but portfolio mode
  remains the default support path.

### AI/operator setup

AI/operator setup focuses on the orchestration and operator story.

- Goal: demonstrate approvals, RAG, model selection, observability, and
  degraded mode.
- Required services: AI orchestration layer, AI monitor, gateway, core stores.
- Optional integrations such as Jira or Ollama should degrade gracefully.

## Required Vs Optional Dependencies

| Dependency | Portfolio mode | Extended setup | AI/operator setup |
| --- | --- | --- | --- |
| Docker daemon | required | required | required |
| OpenSSL | required | required | required |
| JWT key files | required | required | required |
| Ollama | optional | recommended | recommended |
| Jira credentials | optional | recommended | optional |
| Mobile toolchains | optional | optional | optional |

## Guardrails

- Portfolio mode is the default support path for first-time readers.
- Supporting and optional modules must not silently redefine the default
  walkthrough.
- Missing optional dependencies must produce clear warnings, not vague failures.
- `./scripts/showcase-preflight.sh` is the required local readiness check for
  official showcase tours.
- `./scripts/showcase-reset.sh` is the supported path back to a deterministic
  demo state.
- `./scripts/showcase-up.sh` is the supported one-command startup path for all
  showcase modes.
