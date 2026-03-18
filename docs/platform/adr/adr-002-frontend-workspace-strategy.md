# ADR 002: Frontend Workspace Strategy

- Status: Accepted
- Date: 2026-03-17

## Context

The platform currently ships one shell, several remotes, and one operator app.
Historically, each frontend lived as its own mostly isolated package with its
own dependency graph and local conventions. That made early experimentation
easy, but it increased duplication around auth, API access, shared UI patterns,
and dependency management.

The repo now has a root npm workspace. The remaining question is what that
workspace is for and when a remote should continue to exist independently.

## Decision

The root workspace is the default development and dependency boundary for
browser-facing applications in this repository.

The intended model is:

1. `frontend/cloudapp-shell` remains the main product web entrypoint.
2. `ai-orchestration/ai-orchestration-monitor` remains a separate operator app.
3. Shared browser code should move into workspace packages instead of being
   copied between apps.
4. Module Federation remains an exception for modules with a real independent
   deployment or release-cadence reason.

## Guardrails

- New shared logic belongs in workspace packages before it is copied into a
  second app.
- New remotes require an explicit reason to exist independently.
- Workspace-level dependency alignment is preferred over app-local version drift.
- Shared auth/session, generated contracts, and common API clients should be
  treated as workspace assets, not app-local utilities.

## Consequences

Positive:

- dependency governance becomes cheaper
- common code has an obvious home
- frontend architecture becomes easier to explain and review

Tradeoffs:

- workspace changes can affect multiple apps at once
- remote independence is reduced unless explicitly justified
- package boundaries need stronger review discipline

## Out Of Scope

This ADR does not force immediate removal of all remotes. It defines the target
direction and the standard for future changes.
