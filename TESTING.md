# Testing (Minimal)

## Strategy
- Default path: Docker-only.
- Main command runs all suites in order via `test-all`.
- CI uses the same compose-based flow.

## Full Run
```bash
cd /portfolio-web
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-all
```

## Targeted Runs
```bash
SERVICE=test-e2e
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit "$SERVICE"
```
- Common services: `test-backend`, `test-backend-petstore`, `test-backend-vehicles`, `test-backend-webproxy`, `test-ml-pipeline`, `test-ai-orchestration-layer`, `test-nginx-gateway`, `test-frontend-unit`, `test-e2e`.

## Nightly AI Integrations
- Workflow: `.github/workflows/nightly-ai-integrations.yml`
- Scope: ChatLLM (live Ollama), AI Monitor model selectors (`chat` / `rag` / `embedding`), Jira AI refine + child proposal flow with cleanup.
- Required models:
  - `qwen3:1.7b`
  - `qwen3-embedding:4b`
- Jira nightly spec auto-skips when Jira secrets are missing.

## Cleanup
```bash
docker compose -p portfolio_test_all -f docker-compose.test.yml down -v --remove-orphans
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## Optional (local UI debugging)
```bash
docker compose -f docker-compose.test.yml --profile host-ui up -d test-shell-host test-nginx-host
```

## Local Playwright (no Docker)
Prerequisite: app endpoints must already be running on `localhost:5001` and `localhost:80`.

```bash
# Option A: start normal app stack (recommended for local Playwright)
docker compose -f docker-compose-infrastructure.yml up -d
docker compose -f docker-compose-app.yml up -d
```

```bash
# Option B: start host-ui test stack
docker compose -f docker-compose.test.yml --profile host-ui up -d test-shell-host test-nginx-host
```

```bash
cd /portfolio-web
docker compose -f docker-compose.test.yml --profile host-ui down -v --remove-orphans
docker compose -f docker-compose.test.yml --profile host-ui up -d test-shell-host test-nginx-host
curl -sf http://localhost:5001 >/dev/null && echo shell-ok
curl -sf http://localhost:80/nginx_health >/dev/null && echo nginx-ok

cd /portfolio-web/frontend/cloudapp-shell
npm ci --include=dev
npm run playwright:install
npm run playwright:open:all
```

```bash
cd /Users/csaba/1_CODING/portfolio-web/frontend/cloudapp-shell
npm ci
npm run playwright:install
npm run playwright:open
# chromium only (recommended locally)
# optional full matrix: npm run playwright:open:all
# headless: npm run playwright:test
```
- Uses `http://localhost:5001` (frontend) and `http://localhost:80` (gateway) by default.
- Do not use `docker compose -f docker-compose.test.yml up -d` for this mode.
- `playwright:open:all` includes retries; transient browser crashes may show as flaky, not hard fail.

## Running With Existing `portfolio-web` Containers
- `docker-compose.test.yml` (default, no `host-ui`) is safe to run in parallel.
- Why: isolated project-scoped networks + no host ports for test DB/services.
- Can still clash on resources (CPU/RAM), causing slower/flakier tests.
- `host-ui` profile can clash on ports `80`, `5001`, `5005`.
  - If those ports are already used, stop app stack first or do not use `host-ui`.
