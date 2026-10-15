# Testing (Minimal)

## Strategy
- Default path: Docker-only.
- Main command runs all suites in order via `test-all`.
- CI uses the same compose-based flow.

## Run Modes
- `Portfolio setup`: the supported default for the flagship `10-minute demo`.
  Start the curated runtime with seeded demo data and only the default story
  surfaces visible.
- `Extended setup`: broader platform demo and most architect deep-dive loops.
  Start the full app stack and optional integrations as needed.
- `AI/operator setup`: the operator-focused path for the AI monitor and
  orchestration layer.

Portfolio setup:
```bash
./scripts/showcase-up.sh --mode portfolio
```

Extended setup:
```bash
./scripts/showcase-up.sh --mode extended
```

AI/operator setup:
```bash
./scripts/showcase-up.sh --mode ai-operator
```

Reset to the known-good demo baseline:
```bash
./scripts/showcase-reset.sh --mode portfolio
```

## Full Run
```bash
cd /portfolio-web
docker compose -p portfolio_test_all -f docker-compose.test.yml up --build --abort-on-container-exit test-all
```

## Targeted Runs
```bash
PROJECT=portfolio_focus
SERVICE=test-e2e-core
docker compose -p "$PROJECT" -f docker-compose.test.yml up --build --abort-on-container-exit "$SERVICE"
```
- Common services: `test-requirements`, `test-backend`, `test-backend-petstore`, `test-backend-vehicles`, `test-backend-webproxy`, `test-ml-pipeline`, `test-ai-orchestration-layer`, `test-frontend-static`, `test-frontend-budgets`, `test-ai-monitor-lint`, `test-ai-monitor-component`, `test-ai-monitor-behavior`, `test-nginx-gateway`, `test-frontend-unit`, `test-e2e-core`, `test-e2e`.
- CI tiers: `Core showcase` must-pass, `Extended showcase` breadth coverage, and `Optional security posture`. See `docs/platform/showcase-smoke-paths.md`.
- `Test Summary` requires every Core Showcase job to report `success`; failed,
  cancelled, skipped, missing, or unrecognized core results fail it. The Docker
  `test-requirements` suite exercises the actual summary shell gate against
  synthetic job results, including optional failures and each core failure state.
- Gateway CI starts the backend stack and `test-rag-auth` before running
  `docker compose -f docker-compose.test.yml run --rm --no-deps test-nginx-gateway`.
  Reuse those healthy dependencies so a second Compose `up` cannot reset the
  tmpfs databases underneath already-running applications. From a fresh local
  project, the normal one-step `up` remains supported.

## Requirement Traceability

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-requirements test-requirements
```

- Core PR gate for canonical requirement schema, generated feature/index
  freshness, reviewed case digests, exact test declarations, recorded accepted
  product intent, and command tests. Accepted revisions must match the human
  decision and SHA-256 in `requirements/baseline.json`.
- Reports are under `test-results/requirements/`. Coverage and execution outcomes
  are separate; coverage assertions and test boundaries are recorded in `requirements/test-map.json`.
- All 52 current scenarios have complete reviewed native-test mappings. Source
  completeness remains separate from whether the current checkout passed.
- Mapped native suites persist JUnit XML or Jest/Vitest JSON plus source/config
  fingerprints under `test-results/`; see `requirements/README.md` for paths.
- After the harness, four backend, ML, AI, frontend unit and monitor component
  suites finish, run the executed-evidence gate:

```bash
docker compose -f docker-compose.test.yml run --build --rm --no-deps test-requirement-evidence
```

- The gate rejects missing, skipped, failed, interrupted or stale default evidence and writes
  `test-results/requirements/executed-traceability.json`. CI downloads native
  artifacts before running it; Test Summary requires it.
- Reports separate accepted/proposed intent from coverage and execution.
  For promotion, append `--requirement-id REQ-AREA-001` to the evidence command
  for each affected requirement. Proposed requirements cannot be promoted even
  with passing tests. See `requirements/README.md#product-intent-acceptance`.
- External model/Jira/Leaflet and operator data boundaries use deterministic
  fixtures. Live/nightly tests remain separate opt-in provider checks.
- Browser traces, screenshots and JUnit XML use `test-results/playwright/`;
  monitor-only runs use `test-results-monitor/playwright/`. Playwright clears
  its own output folder when starting a run, so keep native evidence outside it.

### Coding-agent authority

The mandatory `adlc-change-gate` checks the incoming event-derived diff against
`work-items/agent-tasks/change-selection.json` and requires exact-head independent
human GitHub review on PR events. Review submission/dismissal reruns CI.
Scope-only local and post-merge checks are diagnostics, not promotion approval.

Validate the scoped task declarations and the branch diff before review:

```bash
python3 scripts/adlc/task_contract.py work-items/agent-tasks/ADLC-2026-10-13.json --check-diff
```

The Docker `test-requirements` gate includes authority regressions for stale
intent, credential/network expansion, untrusted-input/review omissions, missing
Git bases, and out-of-scope files. Validation does not execute task commands or
authenticate the human approval source; see the coding-agent authority guide.

Contract history checks run without live services:

```bash
python3 scripts/contracts/openapi_contracts.py check-revisions --base-ref origin/main
python3 scripts/contracts/openapi_contracts.py generate-ts --check
```

The Docker requirement gate exercises changed snapshots without bumps,
decreases, unchanged upstream versions, new/removal cases, and unavailable Git
bases. CI also requires this comparison in the API-contract job before startup.

The [bounded ADLC example](docs/platform/adlc-example/README.md) runs real case
generation in a disposable workspace with networking disabled. Its Docker
replay records success, a missing-artifact failure, regeneration recovery,
source/artifact digests, and cleanup. The requirement gate runs replay
regressions; the example also publishes independent review and feedback.

### Automatic requirement acceptance scan

`test-requirements` discovers all canonical `requirements/REQ-*.md` files and
uses `--require-all-accepted`; every active document must have matching recorded
acceptance. New proposed requirements cannot pass by omitting their IDs from a
task or promotion selection. The acceptance-scan regressions exercise the actual
Compose validation command against disposable new/changed requirement fixtures.

REQ-INTENT-001 is the accepted policy for this gate; its
[2026-10-15 decision](requirements/reviews/INTENT-2026-10-15.md) binds the reviewed
revision. New unaccepted canonical requirements fail the Docker gate. To verify
proposed source/case mappings locally, run `validate_traceability.py` without the
strict flag. Case generation also remains available; neither command records acceptance.

### Exact native result identity

JUnit evidence uses Java package/class/method identity and Python suite-relative
module/class/function identity. A same-named test in another package/module
cannot supply evidence. Distinct parameter invocation suffixes aggregate; exact
duplicate identities are ambiguous, failures take precedence, and skipped or
missing results never pass. Source validation records each native runner identity.

### Read-only Jira intake command

`jira-intake` is an opt-in operator service, outside the automated suite matrix.
It shares the requirements image but receives only dedicated `JIRA_INTAKE_*`
configuration. Fixture mode is the default; `--source jira` explicitly enables
live GET requests. The harness regression suite remains credential-free.

`test-requirements` also exercises the live adapter with a deterministic HTTPS
transport: Cloud basic authentication and scoped-token URLs, Data Center bearer
token files, ADF/plain descriptions, requirement fingerprints and links, safe
access/redirect failures, and preservation of existing human snapshots. These
tests call the intake CLI without contacting a Jira server.

See [requirements/README.md](./requirements/README.md#jira-intake-fixture-or-read-only-live-source)
for Cloud/Data Center setup, requirement links and Docker examples. Live provider
checks require an explicitly chosen issue and identity. Existing 48 acceptance
mappings do not establish live-adapter execution coverage, and changes to the
adapter/Compose definition invalidate previously recorded execution context.

### Operator access checks

MLOps and RAG require a verified CloudApp administrator session at the gateway
and backend. Run `test-ml-pipeline`, `test-ai-orchestration-layer`, and
`test-nginx-gateway` for changes to these boundaries. Backend suites use
deterministic identity-check responses while exercising real HTTP authorization
logic; gateway tests use real CloudApp regular/admin sessions. RAG load checks
also require `ADMIN_AUTH_TOKEN`, rather than an internal service token. The
gateway RAG fixture serves the actual router and identity verifier with
deterministic corpus I/O, so checks do not need live models or vector storage.
AI tests also exercise real RAG capability authorization through orchestration,
streaming, parallel workers, and approval resumption. Model routing and corpus
I/O are deterministic; credentials remain request-local and are verified before
the restricted capability executes.

## Frontend Static Checks
```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-static
```
- Runs workspace version validation plus typecheck/lint for the shell, all Next remotes, and the AI monitor.

## Frontend Budget Checks
```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-frontend-budgets
```
- Builds the CloudApp shell and enforces the hero entry bundle gzip budget.
- The AI monitor budget is enforced inside `test-ai-monitor-lint`.
- Production shell builds use `tsconfig.json`; test files and Jest setup are
  compiled through `tsconfig.jest.json` by `test-frontend-unit`. Those tests
  import remote implementations and need the remote workspace dependencies
  installed by the unit runner. Production images install their own workspace.

## Nightly AI Integrations
- Workflow: `.github/workflows/nightly-ai-integrations.yml`
- Scope: ChatLLM (live Ollama), AI Monitor model selectors (`chat` / `rag` / `embedding`), and an opt-in read-only Jira board/AI proposal preview.
- Required models:
  - `qwen3:1.7b`
  - `qwen3-embedding:4b`
- Jira is disabled by default. Manual dispatch with `jira_read_only=true` uses
  dedicated `JIRA_READ_ONLY_*` settings and an existing fixture project; missing
  settings fail a requested run. Credentials alone cannot enable live tests.
- Live Jira create/update/delete/transition and cleanup need exact-operation
  human approval; the unattended spec has no mutation mode. See
  [live Jira authority](docs/platform/live-jira-test-authority.md).
- Run the credential-free browser/API boundary checks with
  `docker compose -f docker-compose.test.yml run --build --rm --no-deps test-e2e e2e/jira-authority.spec.ts --config e2e/jira-authority.config.ts`.

## Cleanup
```bash
docker compose -p portfolio_test_all -f docker-compose.test.yml down -v --remove-orphans
docker compose -p portfolio_focus -f docker-compose.test.yml down -v --remove-orphans
```

## Optional (local UI debugging)
```bash
docker compose -f docker-compose.test.yml --profile host-ui up -d test-shell-host test-nginx-host
```

## Local Playwright (no Docker)
Prerequisite: app endpoints must already be running on `localhost:5001` and `localhost:80`.

```bash
# Option A: start normal app stack (recommended for local Playwright)
./scripts/showcase-up.sh --mode portfolio --no-reset
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
cd /portfolio-web/frontend/cloudapp-shell
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

## Docker Debugging

Use the smallest Compose topology that answers the question:

- `docker-compose.test.yml`: isolated test stack
- `docker-compose-app.yml`: app stack
- `docker-compose-infrastructure.yml`: infra dependencies

### Core Commands

Build only what changed:

```bash
docker compose -f docker-compose.test.yml build test-shell-core test-e2e-core
docker compose -f docker-compose.test.yml build test-shell test-e2e
docker compose -f docker-compose.test.yml build test-nginx test-cloudapp
docker compose -f docker-compose.test.yml build test-ai-monitor
```

Run one-off focused commands:

```bash
docker compose -f docker-compose.test.yml run --rm test-e2e-core e2e/auth.spec.ts --grep-invert "Admin-Only Routes"
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/auth.spec.ts --project=chromium
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/monitor.spec.ts --project=chromium
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/auth.spec.ts --grep "Logout"
```

Bring up dependencies for manual inspection:

```bash
docker compose -f docker-compose.test.yml up -d test-shell-core test-nginx-core
docker compose -f docker-compose.test.yml up -d test-shell test-nginx test-ai-monitor
docker compose -f docker-compose-app.yml up -d
docker compose -f docker-compose-infrastructure.yml up -d
```

Inspect state:

```bash
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose-app.yml ps
docker ps --format "table {{.Names}}\t{{.Status}}"
docker ps -a --format "table {{.Names}}\t{{.Status}}"
```

Read logs:

```bash
docker compose -f docker-compose.test.yml logs test-nginx
docker compose -f docker-compose.test.yml logs test-shell
docker logs portfolio-web-test-e2e-1
docker logs next-nginx-jwt
```

### Recommended Flow

1. Rebuild only touched services.
2. Run one failing spec or one failing test container.
3. Check container logs before changing code again.
4. Widen to a small subset once the first failure is fixed.
5. Run the full suite only after the subset is green.
6. Reset with `down -v --remove-orphans` only when you suspect stale volumes or orphaned containers.

### Good Patterns

For gateway or contract failures:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-nginx-gateway
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-api-contracts
```

For E2E failures:

```bash
docker compose -f docker-compose.test.yml build test-shell-core test-e2e-core
docker compose -f docker-compose.test.yml build test-shell test-e2e
docker compose -f docker-compose.test.yml run --rm test-e2e-core e2e/auth.spec.ts e2e/shop.spec.ts --grep-invert "Admin-Only Routes"
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/auth.spec.ts --project=webkit
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/shop.spec.ts '--project=firefox' --grep 'should create a real item and add it to cart without request stubs'
docker compose -f docker-compose.test.yml run --rm test-e2e e2e/auth.spec.ts e2e/monitor.spec.ts --grep "admin|logout"
```

For AI and monitor failures:

```bash
docker compose -f docker-compose.test.yml build test-ai-monitor test-e2e
docker compose -f docker-compose.test.yml up -d test-ai-monitor test-nginx test-shell
docker compose -f docker-compose.test.yml logs test-ai-monitor
```

For app readiness:

```bash
docker compose -f docker-compose-app.yml up -d
docker compose -f docker-compose-app.yml ps
docker compose -f docker-compose-infrastructure.yml ps --all
```

### Common Failure Patterns

- Rebuilding everything when only one frontend changed.
- Running full E2E before reproducing a single failing spec.
- Forgetting that test builds can bake env vars into the frontend at build time.
- Debugging backend auth without checking gateway routing and `auth_request` behavior.
- Assuming container health means route readiness. In this repo, gateway behavior can still be wrong while all services are healthy.

### Platform-Specific Lockfiles

- macOS-generated `package-lock.json` files can miss Linux-native packages needed by Docker builds.
- For the Next.js remotes and shell, validate lockfiles before pushing:

```bash
python3 scripts/check_frontend_native_lockfiles.py
```

- This check guards the `Dockerfile_FE` services against missing Linux SWC and Tailwind oxide entries.
- The AI monitor uses a separate Dockerfile fallback for Rollup native bindings. Keep that fallback in place unless the monitor lockfile becomes reliably multi-platform in CI and nightly container builds.


### AI remote boundary regressions

Run `test-frontend-unit` for deterministic adapter/model discovery, identity,
role and origin denial, request limits/deadlines, SSE/reasoning behavior,
disconnect cancellation, and prompt-log privacy. Run `test-frontend-static`
for workspace types, lint, versions, and architecture boundaries. Build the
ChatLLM and Jira remotes to verify the edge adapters and federation output.
`test-nginx-gateway` checks the AI remote route denials with real CloudApp
sessions; it does not require a live model provider for those denials.

The configured provider and Jira are optional. Positive live-provider tests
remain opt-in; use disposable deterministic provider fixtures for default
verification. See [the boundary contract](./docs/platform/ai-remote-boundary.md)
for gateway paths, server configuration, and timeout behavior.

Reproduce the production-image check with real disposable CloudApp sessions and
a deterministic Ollama HTTP transport (standalone pages, federation entries,
models and SSE through direct and gateway paths):

```bash
docker compose --env-file /dev/null -p ai_remote_check \
  -f docker-compose.test.yml \
  -f tests/nginx-gateway/ai-remotes-runtime/compose.yml \
  up --build --abort-on-container-exit \
  --exit-code-from test-ai-remotes-runtime test-ai-remotes-runtime
```

The result, input context, and runner completion are recorded under
`test-results/ai-remotes-runtime/`. Clean up the disposable project with the
same two Compose files and `down -v` after inspection.
