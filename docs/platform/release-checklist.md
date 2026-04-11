# Release Checklist

Use this checklist for any change that is more than a local-only experiment.

## 1. Classify The Change

- identify whether the change touches gateway/auth, governed contracts, AI
  behavior, environment shape, or operator-only UX
- identify whether the change affects a `releaseCritical` contract service
- identify the affected showcase tier: `Hero`, `Supporting`, `Optional`, or
  `Operator tooling`
- note whether an official tour, demo setup path, or evidence asset changes

## 2. Contract Discipline

- if a governed snapshot changed, update `contracts/openapi/*.json`
- bump the matching `snapshotRevision` in `contracts/openapi/manifest.json`
- regenerate `packages/contracts/src/`
- verify `python3 scripts/contracts/openapi_contracts.py generate-ts --check`

## 3. Gateway And Auth

- validate any affected gateway route or admin auth-check path
- confirm the relevant browser or operator flow still works through the gateway
- update operator runbooks if auth or ingress behavior changed

## 4. AI And Operator Impact

- run the relevant AI synthetic check or operator behavior test
- confirm degraded-mode expectations still match runtime behavior
- update `ai-degraded-mode.md`, runbooks, or `ai-product-boundary.md` if the
  operator contract changed

## 5. Showcase Stewardship

- if a new module or tier promotion is proposed, answer: `what new capability
  does this demonstrate?`
- confirm the affected module still has an owner in
  `deployable-inventory.md`
- confirm the matching smoke path still exists in
  `showcase-smoke-paths.md`
- update `showcase-taxonomy.md`, `showcase-tours.md`, or
  `showcase-evidence-pack.md` when the reader-facing story changes

## 6. Environment And Secrets

- update `.env` guidance or setup docs when variable shape changes
- review whether the change introduces a new secret class or handling rule
- perform at least one startup check with the new environment shape
- run `npm run architecture:check` when the change touches CloudApp controller
  boundaries, frontend hook API access, or internal service auth wiring

## 7. Docs, Tours, And Release Notes

- update platform docs for any policy or ownership change
- update README or showcase docs when the 10-minute demo, architect tour,
  AI/operator tour, or supported setup changes
- ensure release notes call out user-visible or operator-visible fallout
- include rollback notes when the change affects a release-critical surface

## 8. Final Go/No-Go

- no unresolved contract drift
- no missing manifest bump for changed governed snapshots
- no missing operator or gateway verification for affected paths
- no stale docs for newly introduced environment or release behavior
- no failing architecture guardrails for auth, hook API access, or controller
  module boundaries
- no hero-module change without owner clarity and matching smoke coverage
- no showcase-tier or tour change without the docs updates that make it legible
