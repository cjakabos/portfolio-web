# Platform Governance Docs

This directory holds the repo-level architecture and governance documents that
define the current platform direction.

## Core Docs

- [ai-degraded-mode.md](./ai-degraded-mode.md): dependency failure matrix,
  degraded-mode expectations, and incident-detection signals for the AI stack
- [deployable-inventory.md](./deployable-inventory.md): deployable inventory,
  owner matrix, ingress map, and critical user journeys
- [ai-monitor-boundary.md](./ai-monitor-boundary.md): canonical monitor client
  surface, operator capability matrix, and gateway-enforced route classes
- [backend-service-standards.md](./backend-service-standards.md): Spring
  controller/service contract for validation, error mapping, and logging
- [backend-service-taxonomy.md](./backend-service-taxonomy.md): backend service
  classification for core platform, AI/operator support, and demo modules
- [module-classification.md](./module-classification.md): module labels for
  core platform, operator support, and legacy/demo-derived areas
- [frontend-version-policy.md](./frontend-version-policy.md): approved shared
  frontend dependency versions and intentional exceptions
- [runtime-and-data-policy.md](./runtime-and-data-policy.md): operational
  defaults and exception posture for runtimes and data stores
- [secret-classification.md](./secret-classification.md): secret classes,
  handling rules, and local versus production expectations
- [remaining-backlog-pr-plan.md](./remaining-backlog-pr-plan.md): sequenced PR
  plan for unfinished backlog work

## Runbooks

- [runbooks/ai-approvals-failure.md](./runbooks/ai-approvals-failure.md)
- [runbooks/ai-rag-ingestion-failure.md](./runbooks/ai-rag-ingestion-failure.md)
- [runbooks/ai-startup-degradation.md](./runbooks/ai-startup-degradation.md)
- [runbooks/ai-operator-access-failure.md](./runbooks/ai-operator-access-failure.md)

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
