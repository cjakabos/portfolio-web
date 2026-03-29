# Platform Governance Docs

This directory holds the repo-level architecture and governance documents that
define the current platform direction.

## Core Docs

- [ai-degraded-mode.md](./ai-degraded-mode.md): dependency failure matrix,
  degraded-mode expectations, and incident-detection signals for the AI stack
- [deployable-inventory.md](./deployable-inventory.md): deployable inventory,
  owner matrix, ingress map, and critical user journeys
- [showcase-taxonomy.md](./showcase-taxonomy.md): audience-facing labels for
  hero, supporting, optional, and operator surfaces
- [showcase-tours.md](./showcase-tours.md): the official 10-minute, architect,
  and AI/operator walkthroughs
- [showcase-smoke-paths.md](./showcase-smoke-paths.md): CI tiering and
  automated smoke-path mapping for the official tours
- [showcase-architecture.md](./showcase-architecture.md): system, request, and
  AI/operator diagrams for the flagship story
- [showcase-evidence-pack.md](./showcase-evidence-pack.md): curated screenshots
  and visuals for hero and supporting showcase surfaces
- [showcase-stewardship.md](./showcase-stewardship.md): promotion rules,
  review cadence, and curation expectations for showcase modules
- [showcase-demo-contract.md](./showcase-demo-contract.md): supported setup
  modes, required dependencies, and graceful-degradation rules
- [frontend-federation-contracts.md](./frontend-federation-contracts.md):
  typed route-to-remote contracts for the shell and module-federated remotes
- [ai-monitor-boundary.md](./ai-monitor-boundary.md): canonical monitor client
  surface, operator capability matrix, and gateway-enforced route classes
- [ai-product-boundary.md](./ai-product-boundary.md): current classification of
  AI capabilities as core product, operator-only, or experimental
- [ai-slos-and-dashboards.md](./ai-slos-and-dashboards.md): SLO targets,
  endpoint-backed dashboard queries, and load-test expectations for AI flows
- [backend-service-standards.md](./backend-service-standards.md): Spring
  controller/service contract for validation, error mapping, and logging
- [backend-service-taxonomy.md](./backend-service-taxonomy.md): backend service
  classification for core platform, AI/operator support, and demo modules
- [contract-release-discipline.md](./contract-release-discipline.md): contract
  snapshot versioning rules, generated client release expectations, and review
  triggers
- [module-classification.md](./module-classification.md): governance labels for
  core platform, operator support, showcase integrations, and templates
- [frontend-version-policy.md](./frontend-version-policy.md): approved shared
  frontend dependency versions and intentional exceptions
- [runtime-and-data-policy.md](./runtime-and-data-policy.md): operational
  defaults and exception posture for runtimes and data stores
- [release-checklist.md](./release-checklist.md): release readiness checklist
  for contracts, gateway/auth, environment changes, and operator impacts
- [release-dry-run-example.md](./release-dry-run-example.md): representative
  dry-run of the release checklist against a governed contract change
- [release-promotion-criteria.md](./release-promotion-criteria.md): promotion
  gates for gateway, auth, AI, and contract-touching changes
- [secret-classification.md](./secret-classification.md): secret classes,
  handling rules, and local versus production expectations
- [flagship-showcase-pr-plan.md](./flagship-showcase-pr-plan.md): sequenced PR
  plan for the flagship-platform curation roadmap
- [remaining-backlog-pr-plan.md](./remaining-backlog-pr-plan.md): sequenced PR
  plan for unfinished backlog work on the earlier productization track

## Runbooks

- [runbooks/showcase-reset-and-recovery.md](./runbooks/showcase-reset-and-recovery.md)
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
- evaluating whether a module is product-bearing, operator-only, supporting,
  or optional in the flagship story
