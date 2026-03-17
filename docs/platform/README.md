# Platform Governance Docs

This directory holds the repo-level architecture and governance documents that
define the current platform direction.

## Core Docs

- [deployable-inventory.md](./deployable-inventory.md): deployable inventory,
  owner matrix, ingress map, and critical user journeys
- [module-classification.md](./module-classification.md): module labels for
  core platform, operator support, and legacy/demo-derived areas
- [frontend-version-policy.md](./frontend-version-policy.md): approved shared
  frontend dependency versions and intentional exceptions
- [secret-classification.md](./secret-classification.md): secret classes,
  handling rules, and local versus production expectations
- [remaining-backlog-pr-plan.md](./remaining-backlog-pr-plan.md): sequenced PR
  plan for unfinished backlog work

## Architecture Decision Records

- [adr/adr-001-gateway-policy-boundary.md](./adr/adr-001-gateway-policy-boundary.md)
- [adr/adr-002-frontend-workspace-strategy.md](./adr/adr-002-frontend-workspace-strategy.md)
- [adr/adr-003-ai-operator-boundary.md](./adr/adr-003-ai-operator-boundary.md)
- [adr/adr-004-generated-contract-governance.md](./adr/adr-004-generated-contract-governance.md)
- [adr/adr-005-runtime-and-data-store-defaults.md](./adr/adr-005-runtime-and-data-store-defaults.md)

## Usage

Use these documents as the baseline when:

- proposing a new runtime, data store, or browser surface
- changing ingress, auth, or operator capabilities
- reviewing API-contract changes between backend and frontend
- evaluating whether a module is product-bearing, operator-only, or legacy/demo
