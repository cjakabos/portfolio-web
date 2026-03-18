# Runtime And Data Policy

This document turns the defaults from
[ADR 005](./adr/adr-005-runtime-and-data-store-defaults.md) into an operational
policy for day-to-day review work.

## Approved Defaults

### Runtime defaults

| Workload | Default runtime | Notes |
| --- | --- | --- |
| Transactional domain services | Spring Boot | Default for new business APIs and gateway-backed product services |
| AI and orchestration services | Python | Default for orchestration, RAG, and ML-specific workloads |
| Product-facing web surfaces | Next.js | Default for the primary browser product experience |
| Operator-facing web surfaces | Vite/React | Approved default for operator tooling such as the AI monitor |

### Data-store defaults

| Data need | Default store | Notes |
| --- | --- | --- |
| Transactional system of record | Postgres | Default for new persistent product data |
| Cache and coordination state | Redis | Default for ephemeral operational state |
| Evented or chat transport | Kafka | Reserved for event-stream or chat-style workflows |
| AI-private vector storage | ChromaDB | Reserved for retrieval and embedding workloads |

## Review Rules

1. New transactional product data should default to Postgres.
2. New browser product surfaces should default to Next.js unless they are an
   operator-only tool.
3. New runtimes or stores require an ADR before they are added.
4. Existing exceptions can stay in place when there is a clear bounded reason,
   but they should not become templates for new work.

## Current Exceptions And Migration Recommendations

| Service | Non-default runtime/store | Why it exists today | Recommendation |
| --- | --- | --- | --- |
| `cloudapp` | MongoDB | Supports chat/document-oriented persistence alongside the core transactional model | Keep for the existing chat/document slice, but do not expand MongoDB to new product domains without an ADR |
| `petstore` | MySQL | Legacy/demo-derived module retained for portfolio breadth | Keep as-is while it remains a demo module; migrate to Postgres before any productization or major feature investment |
| `vehicles-api` | H2 | Lightweight sample-derived persistence for local/demo operation | Keep H2 for demo/local usage only; migrate to Postgres before any shared environment or production-grade persistence work |
| `ai-orchestration-layer` | MongoDB | Stores AI experiment and audit-style data outside the transactional spine | Keep as a bounded AI exception for now; re-evaluate if those records become part of the core product data model |

## Runtime Exception Posture

There are no current first-party runtime exceptions outside the approved
defaults above. In practice that means:

- Spring Boot remains the default backend runtime.
- Python remains the default AI/service runtime.
- Next.js remains the default product web runtime.
- Vite stays scoped to operator tooling.

Any new runtime outside those lanes should be treated as an exception request,
not a casual addition.
