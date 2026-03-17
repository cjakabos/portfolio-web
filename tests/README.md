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
| AI monitor static checks | `test-ai-monitor-lint` | Operator app install, typecheck, linting, and production build validation |
| Frontend unit tests | `test-frontend-unit` | React and hook-level tests in the shell app |
| Gateway integration tests | `test-nginx-gateway` | Auth enforcement, routing, rate limiting, and CORS/security headers |
| API contract governance | `test-api-contracts` | OpenAPI drift detection and generated TypeScript contract validation |
| End-to-end browser tests | `test-e2e` | Playwright flows across the full stack |
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
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-monitor-lint
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-unit
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-nginx-gateway
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-api-contracts
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-e2e
```

### Cleanup

```bash
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## CI Coverage Summary

The CI workflow runs the following categories:

- backend integration suites for CloudApp, Petstore, Vehicles API, and Jira proxy
- ML pipeline tests
- gateway integration tests
- OpenAPI contract governance
- frontend unit tests
- frontend native lockfile validation
- dependency audit jobs
- AI orchestration tests
- AI monitor checks
- Playwright E2E

See `.github/workflows/ci-tests.yml` for the exact job graph.

## Playwright Notes

The browser E2E layer uses Playwright, not Cypress.

The `test-e2e` service boots a full stack with:

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
- validates generated TypeScript contract output

This is the primary protection against backend/frontend drift.

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
