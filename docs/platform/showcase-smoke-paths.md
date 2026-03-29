# Showcase Smoke Paths

This document maps the official flagship tours to the automated checks that
protect them. The goal is not to force every branch change through every
surface, but to make the coverage model explicit.

## CI Tiers

| Tier | Intent | Representative jobs |
| --- | --- | --- |
| `Core showcase` | Protect the README-first story, hero setup, and architecture spine | `backend-tests`, `nginx-gateway-tests`, `api-contract-tests`, `frontend-unit-tests`, `frontend-static-checks`, `docs-drift-checks`, `frontend-lockfile-checks`, `e2e-core-tests` |
| `Extended showcase` | Keep the deeper integrations, remotes, and operator surfaces healthy | `ml-pipeline-tests`, `ai-orchestration-tests`, `ai-monitor-checks`, `ai-monitor-component-tests`, `ai-monitor-behavior-tests`, `e2e-remote-tests` |
| `Optional security posture` | Surface dependency risk without blocking routine showcase curation | `dependency-scans` |

## Official Tour Coverage

| Tour | Recommended setup | Manual emphasis | Automated smoke and safety net |
| --- | --- | --- | --- |
| `10-minute demo` | `Hero setup` | Shell login, notes/files or shop, chat or maps, then one supporting moment | `backend-tests`, `nginx-gateway-tests`, `frontend-unit-tests`, `frontend-static-checks`, `e2e-core-tests` |
| `Architect deep dive` | `Hero setup` plus selective `Extended setup` modules | Gateway policy, module federation, shared packages, contract generation, CI discipline | `api-contract-tests`, `frontend-static-checks`, `frontend-lockfile-checks`, `docs-drift-checks`, `e2e-core-tests`, `e2e-remote-tests` |
| `AI/operator tour` | `AI/operator setup` | AI orchestration, monitor dashboards, approvals, RAG, degraded mode | `ai-orchestration-tests`, `ai-monitor-checks`, `ai-monitor-component-tests`, `ai-monitor-behavior-tests`, `e2e-remote-tests` |

## Route-Level Browser Smoke Map

| Surface | Main routed path | Static gate | Browser smoke path |
| --- | --- | --- | --- |
| CloudApp shell | `http://localhost:5001` | `frontend-static-checks` and `frontend-unit-tests` | `e2e/auth.spec.ts`, `e2e/shop.spec.ts`, `e2e/chat.spec.ts` via `e2e-core-tests` |
| OpenMaps | `/maps` in the shell | `frontend-static-checks` | `e2e/module-federation.spec.ts` via `e2e-remote-tests` |
| Jira remote | `/jira` in the shell | `frontend-static-checks` | `e2e/module-federation.spec.ts` via `e2e-remote-tests` |
| MLOps remote | `/mlops` in the shell | `frontend-static-checks` | `e2e/mlops.spec.ts` via `e2e-remote-tests` |
| Petstore remote | `/petstore` in the shell | `frontend-static-checks` | `e2e/module-federation.spec.ts` via `e2e-remote-tests` |
| ChatLLM remote | `/chatllm` in the shell | `frontend-static-checks` | `e2e/module-federation.spec.ts` via `e2e-remote-tests` |
| AI monitor | `http://localhost:5010` and `/ai` gateway flows | `frontend-static-checks` and `ai-monitor-checks` | `test-ai-monitor-component`, `test-ai-monitor-behavior`, `e2e/monitor.spec.ts` |

## Review Expectations

- Changes that affect `Hero` modules should keep the `Core showcase` tier
  green.
- Changes that affect supporting or operator surfaces should run the matching
  `Extended showcase` path before they are presented as demo-ready.
- `Optional security posture` findings should be triaged and documented, but
  they are not the same thing as a broken flagship tour.
