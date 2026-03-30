# Test Guide

This repository uses `docker-compose.test.yml` as the main integration and CI
test entrypoint. The test stack is intentionally broad because it validates the
platform across backend services, frontend behavior, gateway policy, AI
services, and contract governance.

## Test Layers

| Layer | Main entrypoint | What it covers |
| --- | --- | --- |
| CloudApp integration | `test-backend` | Spring Boot integration across users, auth, items, cart, orders, notes, files, and chat-adjacent flows |
| Petstore integration | `test-backend-petstore` | Customer, pet, employee, and schedule behavior against MySQL |
| Vehicles integration | `test-backend-vehicles` | Vehicles API behavior and controller/service integration |
| Jira proxy integration | `test-backend-webproxy` | Proxy request validation and backend behavior |
| ML pipeline tests | `test-ml-pipeline` | Flask endpoints, validation, and segmentation behavior |
| AI orchestration tests | `test-ai-orchestration-layer` | FastAPI orchestration helpers, auth/config behavior, and HTTP client logic |
| Frontend static checks | `test-frontend-static` | Workspace version validation plus shell, remote, and AI monitor typecheck/lint coverage |
| Frontend budget checks | `test-frontend-budgets` | Build-time gzip budget checks for the CloudApp shell hero entry bundle |
| AI monitor static checks | `test-ai-monitor-lint` | Operator app install, typecheck, linting, production build validation, and AI monitor bundle-budget enforcement |
| AI monitor component tests | `test-ai-monitor-component` | Operator auth/session behavior, service-health rendering, and approval workflow coverage |
| AI monitor behavior | `test-ai-monitor-behavior` | Playwright coverage for routed monitor/operator flows |
| Frontend unit tests | `test-frontend-unit` | React and hook-level tests in the shell app |
| Gateway integration tests | `test-nginx-gateway` | Auth enforcement, routing, rate limiting, and CORS/security headers |
| API contract governance | `test-api-contracts` | OpenAPI drift detection and generated TypeScript contract validation |
| End-to-end browser tests (core) | `test-e2e-core` | Playwright flows for CloudApp shell, auth, shop, chat, and mobile regression paths |
| End-to-end browser tests (remotes) | `test-e2e` | Playwright flows for module federation, admin remotes, MLOps, and AI monitor |
| Docs drift checks | `python3 scripts/check_docs_drift.py` | Validates that key repo docs still match the current CI/test model |
| Full matrix runner | `test-all` | Runs the test services sequentially in a deterministic order |

## Main Commands

### Full matrix

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-all
```

### Individual suites

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-backend
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-backend-petstore
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-backend-vehicles
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-backend-webproxy
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ml-pipeline
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-orchestration-layer
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-static
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-budgets
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-monitor-lint
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-monitor-component
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-monitor-behavior
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-unit
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-nginx-gateway
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-api-contracts
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-e2e-core
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-e2e
python3 scripts/check_docs_drift.py
```

### Cleanup

```bash
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## CI Coverage Summary

The CI workflow is intentionally split into showcase tiers:

- `Core showcase`: backend integration, gateway integration, OpenAPI contract governance, frontend unit tests, frontend static checks, frontend budget checks, docs drift checks, frontend native lockfile validation, and Playwright E2E for the hero tour.
- `Extended showcase`: ML pipeline tests, AI orchestration tests, AI monitor static/component/browser checks, and Playwright E2E for remotes and operator flows.
- `Optional security posture`: dependency audit jobs for npm, Python, and Maven.

See `.github/workflows/ci-tests.yml` for the exact job graph.
See `docs/platform/showcase-smoke-paths.md` for the tour-to-test mapping.

## Playwright Notes

The browser E2E layer uses Playwright, not Cypress.

The `test-e2e-core` service boots the lean CloudApp browser stack with:

- shell UI
- gateway
- CloudApp backend
- CloudApp datastores

The `test-e2e` service boots the full routed stack with:

- shell UI
- gateway
- backend services
- ML frontend and backend components
- AI monitor

Artifacts are written to:

- `playwright-report/`
- `test-results/`

## Contract Tests

Contract governance is driven by `scripts/contracts/openapi_contracts.py`.

The contract test service:

- starts the relevant backend services
- compares live OpenAPI output to checked-in snapshots
- validates `contracts/openapi/manifest.json`
- validates generated TypeScript contract output

This is the primary protection against backend/frontend drift.

## AI Synthetic Load Tests

Synthetic AI load checks live in `tests/ai-load/` and back the current AI SLO
document in `docs/platform/ai-slos-and-dashboards.md`.

Run them with `k6` against either the direct AI service or the gateway-routed
AI prefix:

```bash
k6 run tests/ai-load/orchestration.js
k6 run tests/ai-load/approvals.js
k6 run tests/ai-load/rag-upload.js
```

These scripts are not part of the default CI matrix yet, but they are the
governed synthetic baseline for orchestration latency, approval visibility, and
RAG upload success.

## Browser Surface Quality Gates

Every browser-facing surface should have one static gate and one behavioral
gate or smoke path.

| Browser surface | Static gate | Behavioral gate or smoke path |
| --- | --- | --- |
| CloudApp shell | `test-frontend-static`, `test-frontend-budgets`, `test-frontend-unit`, and `test-shell` build/healthcheck in the E2E stack | `auth.spec.ts`, `shop.spec.ts`, `chat.spec.ts` |
| OpenMaps remote | `test-frontend-static` plus `test-openmaps-frontend` build/healthcheck in the E2E stack | `module-federation.spec.ts` |
| Jira remote | `test-frontend-static` plus `test-jira-frontend` build/healthcheck in the E2E stack | `module-federation.spec.ts` |
| MLOps remote | `test-frontend-static` plus `test-mlops-frontend` build/healthcheck in the E2E stack | `mlops.spec.ts` |
| Petstore remote | `test-frontend-static` plus `test-petstore-frontend` build/healthcheck in the E2E stack | `module-federation.spec.ts` |
| ChatLLM remote | `test-frontend-static` plus `test-chatllm-frontend` build/healthcheck in the E2E stack | `module-federation.spec.ts` |
| AI monitor | `test-frontend-static` and `test-ai-monitor-lint` | `test-ai-monitor-component` for component workflows plus `test-ai-monitor-behavior` via `monitor.spec.ts` |

## Local Test Expectations

- Integration suites are container-first and expect Docker Compose.
- Frontend unit tests run inside a containerized Node environment in CI.
- Browser E2E depends on the full routed stack, not isolated frontend mocks.
- The gateway suite is part of the platform safety net and should be treated as
  a release-critical layer.

## Where Test Sources Live

| Area | Path |
| --- | --- |
| CloudApp tests | `backend/cloudapp/src/test/` |
| Petstore tests | `backend/petstore/src/test/` |
| Vehicles API tests | `backend/vehicles-api/src/test/` |
| Jira proxy tests | `backend/web-proxy/src/test/` |
| ML pipeline tests | `tests/ml-pipeline/` |
| AI orchestration tests | `tests/ai-orchestration-layer/` |
| Gateway tests | `tests/nginx-gateway/` |
| Shell unit tests | `frontend/cloudapp-shell/src/__tests__/` |
| Browser E2E | `e2e/` |

## Maintenance Rules

1. Update this document whenever a test service is added, removed, or renamed.
2. Keep terminology aligned with the actual CI implementation.
3. Do not describe test layers that no longer exist.
