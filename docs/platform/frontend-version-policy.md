# Frontend Version Policy

This document defines which frontend dependency versions are treated as shared
workspace defaults and which areas are allowed to diverge intentionally.

## Shared Core Versions

These versions should stay aligned across browser-facing apps and shared
workspace packages whenever the dependency is present:

| Dependency | Approved version |
| --- | --- |
| `react` | `19.1.2` |
| `react-dom` | `19.1.2` |
| `next` | `15.3.8` |
| `eslint` | `^9.29.0` |
| `eslint-config-next` | `15.3.8` |
| `typescript` | `5.9.2` |
| `@types/node` | `24.3.1` |
| `@types/react` | `^19.1.8` |
| `@types/react-dom` | `^19.1.8` |

## Intentional Exceptions

- `vite`, `vitest`, and `typescript-eslint` are specific to the operator app
  and do not need to match the Next.js surfaces.
- `cypress` remains isolated to legacy remotes until those browser surfaces are
  consolidated or retired.
- Module Federation packages stay aligned where they are used, but they are not
  part of the generic root drift check because only the Next.js shell/remotes
  consume them.

## Enforcement

- Run `npm run frontend:check-versions` from the repo root to validate the
  shared-version policy across the workspace.
- Treat new version skew in the shared-core list as accidental unless there is
  a written exception and the drift check is updated deliberately.
