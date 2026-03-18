# PR Plan For Remaining Detailed Backlog

## Purpose

This document turns the unfinished items from the original "5. Detailed
Backlog" into a practical PR sequence for the current branch state.

The goal is not to preserve the original ticket ordering literally. The goal is
to group the remaining work into reviewable PRs with clear dependencies,
acceptance criteria, and verification steps.

## Current Baseline

The following backlog items are already completed on `repo-improvements`:

| Backlog item | Status | Notes |
| --- | --- | --- |
| `PLAT-01` | Done | Deployable inventory and owner matrix added |
| `DOC-01` | Done | Top-level README rewritten to match the platform |
| `DOC-02` | Done | Test documentation rewritten for current CI stack |
| `CI-01` | Done | AI monitor typecheck added to the test stack |
| `SEC-01` | Done | Demo-user seeding is now explicitly opt-in |
| `SEC-03` | Done | Stale AI Studio / Gemini references removed |
| `DOC-03` | Done incidentally | Monitor README was rewritten as part of `SEC-03` |
| `CLEAN-01` | Done | Tracked backup artifact removed |
| `FE-01` | Done | Root npm workspace added |
| `AIM-01` | Done | Duplicate monitor hook stacks removed |
| `BE-01` | Done | Item and order service-layer extraction landed |

## Planning Rules

1. Keep PRs narrow enough to review in one sitting.
2. Prefer one architectural decision or one execution slice per PR.
3. Land governance and CI gates before broader consolidation work.
4. Avoid mixing large product-surface moves with policy or release-process work.
5. Keep the remaining work aligned with the target architecture already defined:
   gateway as policy boundary, one frontend workspace, Python for AI services,
   Spring Boot for transactional services, and Postgres as the default system
   of record.

## Remaining Backlog Coverage

The remaining unfinished items from the original backlog are:

- `PLAT-02`
- `CI-02`
- `CI-03`
- `CI-04`
- `SEC-02`
- `SEC-04`
- `CLEAN-02`
- `CLEAN-03`
- `FE-02`
- `FE-03`
- `FE-04`
- `FE-05`
- `AIM-02`
- `AIM-03`
- `AIM-04`
- `BE-02`
- `BE-03`
- `BE-04`
- `DATA-01`
- `DATA-02`
- `DATA-03`
- `SURF-01`
- `SURF-02`
- `SURF-03`
- `AI-01`
- `AI-02`
- `AI-03`
- `AI-04`
- `REL-01`
- `REL-02`
- `REL-03`

## Recommended PR Sequence

| PR | Title | Backlog items | Phase | Depends on |
| --- | --- | --- | --- | --- |
| `PR-01` | ADRs and Governance Baseline | `PLAT-02`, `SEC-04` | Governance | Current branch baseline |
| `PR-02` | Docs, Legacy Inventory, and Security Narrative Cleanup | `SEC-02`, `CLEAN-02`, `CLEAN-03` | Governance | `PR-01` |
| `PR-03` | CI Behavioral Gates and Docs Drift Enforcement | `CI-02`, `CI-03`, `CI-04` | Governance | `CI-01`, `PR-01` |
| `PR-04` | Frontend Shared Packages and Contract Consumption | `FE-02`, `FE-03`, `FE-04` | Consolidation | `FE-01`, `PR-01` |
| `PR-05` | Frontend Version Alignment and Workspace Adoption | `FE-05` | Consolidation | `PR-04` |
| `PR-06` | AI Monitor Client Consolidation and Boundary Definition | `AIM-02`, `AIM-04` | Consolidation | `AIM-01`, `PR-04` |
| `PR-07` | AI Monitor Behavioral Tests | `AIM-03` | Consolidation | `PR-03`, `PR-06` |
| `PR-08` | Backend Cross-Cutting Service Standards | `BE-02`, `BE-04` | Consolidation | `BE-01`, `PR-01` |
| `PR-09` | Vehicles Cleanup and Runtime/Data Policy | `BE-03`, `DATA-01`, `DATA-02`, `DATA-03` | Consolidation | `PR-08` |
| `PR-10` | Browser Deployable Reduction | `SURF-01`, `SURF-02`, `SURF-03` | Productization | `PR-04`, `PR-05`, `PR-06` |
| `PR-11` | AI Degraded Mode and Operator Runbooks | `AI-01`, `AI-02` | Productization | `PR-06`, `PR-08`, `PR-09` |
| `PR-12` | AI SLOs, Load Tests, and Product Boundary | `AI-03`, `AI-04` | Productization | `PR-11` |
| `PR-13` | Release and Contract Discipline | `REL-01`, `REL-02`, `REL-03` | Productization | `PR-03`, `PR-04`, `PR-09`, `PR-12` |

## Detailed PR Breakdown

## PR-01: ADRs and Governance Baseline

**Backlog items**

- `PLAT-02`
- `SEC-04`

**Objective**

Create the governing documents that the rest of the remaining backlog will
execute against.

**Scope**

- Add ADRs for:
  - gateway ownership and policy boundary
  - frontend workspace strategy
  - AI/operator boundary
  - generated contract governance
  - runtime and data-store default policy
- Add a short secret-classification document covering:
  - test-only values
  - demo-only values
  - local-dev bootstrap secrets
  - production-only credentials

**Suggested files**

- `docs/platform/adr/adr-001-gateway-boundary.md`
- `docs/platform/adr/adr-002-frontend-workspace.md`
- `docs/platform/adr/adr-003-ai-operator-boundary.md`
- `docs/platform/adr/adr-004-contract-governance.md`
- `docs/platform/adr/adr-005-runtime-and-data-policy.md`
- `docs/platform/secret-classification.md`

**Exit criteria**

- Every major later PR can cite an ADR instead of re-arguing architecture.
- Secret classes are documented and referenced from repo onboarding.

**Verification**

- Markdown lint/readability pass
- Cross-link ADRs from the main platform docs

## PR-02: Docs, Legacy Inventory, and Security Narrative Cleanup

**Backlog items**

- `SEC-02`
- `CLEAN-02`
- `CLEAN-03`

**Objective**

Clean the remaining misleading repo narrative and make the “demo versus real
platform default” distinction obvious.

**Scope**

- Remove any remaining misleading default-credential language
- Sweep stale comments and misleading scaffold notes in actively used code
- Create a “legacy/sample-derived module inventory” for:
  - `backend/vehicles-api`
  - `frontend/remote/petstore`
  - any remaining sample-derived monitor areas
- Label modules as one of:
  - core platform
  - operator support
  - legacy/demo-derived

**Exit criteria**

- A new contributor can tell which modules are product-bearing and which are
  retained mainly for portfolio breadth.

**Verification**

- Search pass for stale credential copy and sample scaffolding references
- Reviewer spot-check against current compose/docs behavior

## PR-03: CI Behavioral Gates and Docs Drift Enforcement

**Backlog items**

- `CI-02`
- `CI-03`
- `CI-04`

**Objective**

Move CI from static checks only toward behavior and drift enforcement.

**Scope**

- Add at least one real AI monitor behavioral test target
- Add a docs-drift validation step for key repo docs
- Ensure every browser-facing app has:
  - one static gate
  - one behavioral gate or smoke path

**Implementation ideas**

- Add a lightweight script that fails on stale markers such as dead tool names
  or forbidden legacy wording
- Add a monitor smoke test around auth/session, health dashboard load, or
  approvals rendering
- Add a matrix or explicit job coverage table for browser surfaces

**Exit criteria**

- CI fails when docs regress away from reality
- Operator app and browser surfaces are not protected by lint/build alone

**Verification**

- Run the new docs-drift script locally
- Run the new monitor test target locally or in docker test compose

## PR-04: Frontend Shared Packages and Contract Consumption

**Backlog items**

- `FE-02`
- `FE-03`
- `FE-04`

**Objective**

Use the root workspace to establish shared packages and make generated
contracts the default path for browser integrations.

**Scope**

- Create workspace packages for:
  - shared auth/session logic
  - shared UI primitives actually used across apps
  - generated API clients/contracts
- Move duplicated auth logic out of app-local hooks
- Wire contract generation output into a shared consumable package

**Suggested package structure**

- `packages/auth`
- `packages/ui`
- `packages/contracts`
- `packages/api-clients`

**Exit criteria**

- At least two frontend surfaces consume shared auth/client code from workspace
  packages
- Generated contracts become the documented default for browser API access

**Verification**

- Build affected apps from the root workspace
- Confirm no duplicated auth/session logic remains in the migrated paths

## PR-05: Frontend Version Alignment and Workspace Adoption

**Backlog items**

- `FE-05`

**Objective**

Reduce unnecessary frontend dependency divergence after shared packages exist.

**Scope**

- Align React, TypeScript, ESLint, testing, and common build-time dependencies
  where practical
- Decide where version skew is intentional versus accidental
- Add root-level workspace scripts or validation that detect version drift

**Exit criteria**

- Frontend apps no longer carry arbitrary version skew for shared core tooling

**Verification**

- Root workspace install
- Root workspace lint/typecheck/build scripts

## PR-06: AI Monitor Client Consolidation and Boundary Definition

**Backlog items**

- `AIM-02`
- `AIM-04`

**Objective**

Finish making the AI monitor a governed operator app instead of an exception.

**Scope**

- Standardize on one canonical orchestration client naming model
- Remove remaining naming or surface inconsistencies such as capitalized client
  variants or duplicate exports
- Document which monitor actions are:
  - read-only operator visibility
  - write-capable operator actions
  - admin-only actions enforced at the gateway

**Exit criteria**

- The monitor’s data access surface is singular and documented
- The monitor’s product boundary is explicit in code and docs

**Verification**

- Typecheck and build the monitor
- Review gateway/admin route expectations against monitor action affordances

## PR-07: AI Monitor Behavioral Tests

**Backlog items**

- `AIM-03`

**Objective**

Add operator-app behavior coverage after the client surface is consolidated.

**Scope**

- Cover:
  - auth/session behavior
  - service-health rendering
  - one orchestration or approval path

**Exit criteria**

- The monitor has meaningful behavioral coverage in CI, not only static checks

**Verification**

- Local or dockerized monitor test run
- CI job evidence for the new test path

## PR-08: Backend Cross-Cutting Service Standards

**Backlog items**

- `BE-02`
- `BE-04`

**Objective**

Spread the first service-layer extraction into platform-wide backend standards.

**Scope**

- Standardize validation, error mapping, and logging patterns across Spring
  services
- Document service classification:
  - core platform
  - AI/operator support
  - demo or portfolio module
- Apply the pattern first to the CloudApp areas adjacent to `ItemController`
  and `OrderController`

**Exit criteria**

- Core service patterns stop varying controller by controller
- Service taxonomy is documented and reviewable

**Verification**

- Targeted CloudApp controller/service tests
- Review of shared exception/validation behavior

## PR-09: Vehicles Cleanup and Runtime/Data Policy

**Backlog items**

- `BE-03`
- `DATA-01`
- `DATA-02`
- `DATA-03`

**Objective**

Lock the repo into explicit runtime and storage defaults while cleaning the most
obvious non-default backend outlier.

**Scope**

- Review `vehicles-api` dependencies and remove unused legacy pieces
- Publish the data-store default policy
- Publish the runtime default policy
- Add a short migration recommendation for each non-default store/runtime

**Exit criteria**

- The repo has a written answer for “what should new work use?”
- `vehicles-api` no longer carries easy-to-remove historical dependency debt

**Verification**

- `vehicles-api` build/test pass
- Policy docs linked from repo governance docs

## PR-10: Browser Deployable Reduction

**Backlog items**

- `SURF-01`
- `SURF-02`
- `SURF-03`

**Objective**

Reduce the number of separately deployed browser surfaces to the smallest set
that still matches real release boundaries.

**Scope**

- Decide which remotes keep independent deploy cadence
- Fold the rest into the shell or workspace modules
- Update compose/build/deploy references to match the reduced surface area

**Key architectural decision**

This PR should explicitly decide whether the long-term browser surface is:

- shell + operator app + one optional AI surface

or

- shell + operator app + a small fixed set of justified remotes

**Exit criteria**

- Each surviving deployable has a documented reason to exist independently

**Verification**

- Product shell loads the retained modules correctly
- Deployment docs and local compose match the reduced set

## PR-11: AI Degraded Mode and Operator Runbooks

**Backlog items**

- `AI-01`
- `AI-02`

**Objective**

Make the AI path operationally credible when dependencies are absent or
degraded.

**Scope**

- Define degraded-mode behavior for failures in:
  - Ollama
  - Redis
  - MongoDB
  - ChromaDB
- Add runbooks for:
  - approvals failures
  - RAG ingestion failures
  - orchestration startup degradation
  - operator-console access failures

**Exit criteria**

- Operators know what should happen and what they should do when core AI
  dependencies are unavailable

**Verification**

- Failure-mode tabletop or simulated dependency outage
- Runbook links from operator docs

## PR-12: AI SLOs, Load Tests, and Product Boundary

**Backlog items**

- `AI-03`
- `AI-04`

**Objective**

Define what the AI layer is accountable for and how it is measured.

**Scope**

- Add load tests for core AI/operator flows
- Define SLOs and target dashboards for:
  - orchestration latency
  - approval visibility
  - RAG upload success
- Classify AI capabilities as:
  - core product
  - operator-only
  - experimental

**Exit criteria**

- AI capability ownership is explicit
- Performance and reliability targets exist for the core flows

**Verification**

- Stored load-test artifacts or reproducible load-test scripts
- Dashboard definitions or metrics queries checked into the repo

## PR-13: Release and Contract Discipline

**Backlog items**

- `REL-01`
- `REL-02`
- `REL-03`

**Objective**

Put release management on rails once the platform shape is stabilized.

**Scope**

- Version generated contract snapshots
- Define promotion criteria for gateway/auth/AI/contract changes
- Add a release checklist that covers:
  - contract drift
  - gateway policy changes
  - security-sensitive env changes
  - operator impact

**Exit criteria**

- Contracts become first-class release artifacts
- Release readiness is defined instead of inferred

**Verification**

- Dry-run release checklist against one representative change
- CI/release docs cross-linked from the root README or platform docs

## Suggested Execution Waves

### Wave 1: Governance And CI

- `PR-01`
- `PR-02`
- `PR-03`

### Wave 2: Platform Consolidation

- `PR-04`
- `PR-05`
- `PR-06`
- `PR-07`
- `PR-08`
- `PR-09`

### Wave 3: Productization And Operations

- `PR-10`
- `PR-11`
- `PR-12`
- `PR-13`

## Minimum Review Checklist For Every Remaining PR

- Scope maps back to specific backlog IDs.
- Docs and compose/CI changes are updated together.
- New defaults are explicit, not implied.
- If a PR changes runtime behavior, at least one verification command is
  recorded in the PR description.
- If a PR reduces or merges deployables, rollout and fallback notes are
  included.

## Recommended Next PR

Open `PR-01: ADRs and Governance Baseline` next.

Reason:

- It unlocks the rest of the backlog.
- It reduces re-litigation in every later PR.
- It creates the policy baseline needed for the data/runtime/release work.
