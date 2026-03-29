# Deployable Inventory And Owner Matrix

## Purpose

This document is the source of truth for the deployable units in this
repository, their expected ownership, ingress paths, data dependencies, and
the user journeys they materially support.

The platform currently spans product web surfaces, operator tooling, domain
services, AI services, and shared infrastructure. The goal of this inventory is
to make operational and architectural ownership explicit before more feature
work is added.

## Related Governance Docs

- [docs/platform/README.md](./README.md)
- [secret-classification.md](./secret-classification.md)
- [runtime-and-data-policy.md](./runtime-and-data-policy.md)
- [adr/adr-001-gateway-policy-boundary.md](./adr/adr-001-gateway-policy-boundary.md)
- [adr/adr-002-frontend-workspace-strategy.md](./adr/adr-002-frontend-workspace-strategy.md)
- [adr/adr-003-ai-operator-boundary.md](./adr/adr-003-ai-operator-boundary.md)
- [adr/adr-004-generated-contract-governance.md](./adr/adr-004-generated-contract-governance.md)
- [adr/adr-005-runtime-and-data-store-defaults.md](./adr/adr-005-runtime-and-data-store-defaults.md)

## Ownership Model

Ownership is assigned by role rather than by individual so the model remains
useful as the team evolves.

| Area | Primary owner role | Supporting roles | Notes |
| --- | --- | --- | --- |
| Gateway and ingress policy | Platform engineer | Backend engineer, operator app engineer | Owns auth, CORS, rate limiting, websocket routing, and public API entrypoints |
| Product shell and frontend shared packages | Frontend platform engineer | Product frontend engineer | Owns shell navigation, shared UI, auth/session, contracts, and frontend dependency strategy |
| Operator console | Operator app engineer | Platform engineer, AI engineer | Owns observability UI, approvals UI, and operator workflows |
| Core transactional services | Backend engineer | Platform engineer | Owns CloudApp, Petstore, Vehicles API, and Jira proxy service behavior |
| AI orchestration and ML services | AI/platform engineer | Operator app engineer | Owns orchestration, RAG, approvals integration, and ML pipeline behavior |
| CI, releases, and docs | Platform engineer | All stream owners | Owns delivery workflows, quality gates, release discipline, and repo-level docs |

## Browser-Facing Deployables

| Deployable | Runtime | Local URL | Public ingress path | Owner role | Showcase tier | Main user journeys |
| --- | --- | --- | --- | --- | --- | --- |
| `next-cloudapp-shell` | Next.js | `http://localhost:5001` | User entrypoint UI; backend traffic routed via gateway | Frontend platform engineer | `Hero` | Login, shop, notes, files, chat, remote module navigation |
| `next-openmaps` | Next.js remote | `http://localhost:5002` | Loaded by shell via module federation | Frontend platform engineer | `Supporting` | Vehicle location management |
| `next-jira` | Next.js remote | `http://localhost:5003` | Loaded by shell via module federation | Frontend platform engineer | `Supporting` | Jira CRUD and AI refinement |
| `next-mlops` | Next.js remote | `http://localhost:5005` | Loaded by shell via module federation | Frontend platform engineer | `Supporting` | Customer segmentation workflows |
| `next-petstore` | Next.js remote | `http://localhost:5006` | Loaded by shell via module federation | Frontend platform engineer | `Optional` | Pet, employee, and schedule workflows |
| `next-chatllm` | Next.js remote | `http://localhost:5333` | Loaded by shell via module federation | Frontend platform engineer | `Supporting` | Local LLM chat UX |
| `ai-orchestration-monitor` | Vite/React static app | `http://localhost:5010` | Operator app for `/ai` workflows through gateway | Operator app engineer | `Operator tooling` | Operator dashboards, approvals, orchestration, RAG |

## Product And Operator Backend Services

| Service | Runtime | Internal port | Gateway path | Owner role | Showcase tier | Primary stores/dependencies | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cloudapp` | Spring Boot | `8099` | `/cloudapp`, `/cloudapp-admin` | Backend engineer | `Hero` | Postgres, MongoDB, Kafka | Identity, catalog, cart, orders, notes, files, chat rooms |
| `petstore` | Spring Boot | `8083` | `/petstore` | Backend engineer | `Optional` | MySQL | Customer, pet, employee, and scheduling flows |
| `vehicles-api` | Spring Boot | `8880` | `/vehicles` | Backend engineer | `Optional` | H2/runtime-local state, downstream clients | Vehicle CRUD and enrichment |
| `jiraproxy` | Spring Boot | `8501` | `/jiraproxy` | Backend engineer | `Supporting` | Jira external API | Server-side proxy for Jira credentials and request validation |
| `mlops-segmentation` | Flask | `8600` | `/mlops-segmentation` | AI/platform engineer | `Supporting` | Postgres (ML) | Customer segmentation and chart generation |
| `ai-orchestration-layer` | FastAPI | `8700` | `/ai`, `/ai/ws` via gateway | AI/platform engineer | `Hero` | Redis, MongoDB, ChromaDB, Ollama, gateway-backed services | Orchestration, approvals, RAG, experiments, system endpoints |

## Shared Infrastructure Deployables

| Deployable | Runtime | Purpose | Owner role | Consumers |
| --- | --- | --- | --- | --- |
| `next-nginx-jwt` | NGINX | Public ingress, auth delegation, policy enforcement | Platform engineer | All browser-facing product and AI traffic |
| `postgres` | Postgres | Primary CloudApp data store | Platform engineer | `cloudapp`, tests |
| `postgres-ml` | Postgres | ML pipeline data store | Platform engineer | `mlops-segmentation`, tests |
| `mysql` | MySQL | Petstore data store | Platform engineer | `petstore`, tests |
| `mongo` | MongoDB | CloudApp chat/document store | Platform engineer | `cloudapp`, tests |
| `zookeeper` | Zookeeper | Kafka coordination | Platform engineer | `broker` |
| `broker` | Kafka | Chat/event transport | Platform engineer | `cloudapp`, tests |
| `redis` | Redis | AI orchestration coordination and approvals state | Platform engineer | `ai-orchestration-layer` |
| `mongodb-abtest` | MongoDB | AI experiments and audit persistence | Platform engineer | `ai-orchestration-layer` |
| `chromadb` | ChromaDB | RAG vector store | Platform engineer | `ai-orchestration-layer` |
| `jaeger` | Jaeger | Trace collection and UI | Platform engineer | Instrumented backend and AI services |
| `prometheus` | Prometheus | Metrics scraping | Platform engineer | Instrumented backend and AI services |
| `grafana` | Grafana | Metrics dashboards | Platform engineer | Operators and developers |
| `ollama` | Ollama | Optional local model provider | AI/platform engineer | `next-chatllm`, `next-jira`, `ai-orchestration-layer` |

## Ingress And Policy Map

| Ingress | Owner role | Backing services |
| --- | --- | --- |
| `http://localhost:5001` | Frontend platform engineer | Product shell |
| `http://localhost:5010` | Operator app engineer | AI orchestration monitor |
| `http://localhost:80` / `http://localhost:8080` / `https://localhost:443` | Platform engineer | Gateway-routed backend and AI APIs |

The gateway is the platform policy boundary. Browser clients should not talk
directly to internal services when a routed gateway path exists.

## Critical User Journeys

| Journey | Primary surface | Primary backend path | Supporting infrastructure |
| --- | --- | --- | --- |
| User authentication | CloudApp shell | `/cloudapp/user/*` | Gateway auth_request, Postgres, JWT keys |
| Shop and orders | CloudApp shell | `/cloudapp/item`, `/cloudapp/cart`, `/cloudapp/order` | Gateway, Postgres |
| Notes and files | CloudApp shell | `/cloudapp/note`, `/cloudapp/file` | Gateway, Postgres/Mongo |
| Realtime chat | CloudApp shell | `/cloudapp/ws`, room/message APIs | Gateway websocket policy, Kafka, Mongo |
| Maps and vehicles | OpenMaps remote | `/vehicles` | Gateway, Vehicles API |
| Jira refinement | Jira remote | `/jiraproxy` plus local AI features | Gateway, Jira proxy, optional Ollama |
| ML segmentation | MLOps remote | `/mlops-segmentation` | Gateway, ML Postgres |
| Operator approvals and orchestration | AI monitor | `/ai`, `/ai/ws` | Gateway, FastAPI orchestration layer, Redis, MongoDB, ChromaDB |

## Data Store Policy Snapshot

The current platform uses multiple stores. Until a rationalization project is
completed, the practical policy is:

1. Postgres is the default transactional system of record.
2. Redis is for transient coordination and operational state.
3. Kafka is reserved for chat/event workflows.
4. ChromaDB is AI-private infrastructure.
5. MySQL and MongoDB are legacy or special-case stores that should not be
   expanded without an ADR.

## Immediate Follow-Up Actions

1. Keep this inventory updated as deployables are added, merged, or removed.
2. Link this document from repo-level onboarding and release docs.
3. Use this matrix as the baseline for future workspace consolidation and
   deployable reduction work.
