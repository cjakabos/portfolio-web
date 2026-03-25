# ADR 004: Generated Contract Governance

- Status: Accepted
- Date: 2026-03-17

## Context

The repo already contains OpenAPI snapshot and client-generation tooling. That
is the correct direction for a platform with multiple backends and multiple
browser consumers, but it only helps if it becomes the default integration
mechanism.

Without governance, backend/frontend drift returns through:

- hand-written browser clients
- stale generated output
- undocumented breaking changes
- PRs that update API behavior without updating contract artifacts

## Decision

Generated contracts are the default integration boundary for browser-facing API
consumers in this repository.

That means:

1. Backend API changes that affect browser consumers should update OpenAPI
   snapshots.
2. Generated TypeScript output should be refreshed as part of the same change.
3. Browser consumers should prefer generated/shared clients over app-local
   ad hoc request code when a governed contract exists.
4. CI remains responsible for detecting contract drift.

## Guardrails

- New browser integrations should not bypass generated contracts unless the API
  is intentionally experimental and short-lived.
- Contract changes should be reviewed as first-class release artifacts.
- Shared contract consumption belongs in workspace packages where practical.

## Consequences

Positive:

- backend/frontend drift is caught earlier
- API evolution becomes more reviewable
- multiple browser apps can share one stable contract source

Tradeoffs:

- API changes require regeneration discipline
- generated artifacts add review noise if changes are not scoped carefully

## Out Of Scope

This ADR does not require every legacy request path to be rewritten
immediately. It sets the default for new work and for touch points already
covered by the existing contract tooling.
