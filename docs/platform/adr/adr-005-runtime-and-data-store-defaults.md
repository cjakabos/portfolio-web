# ADR 005: Runtime And Data Store Defaults

- Status: Accepted
- Date: 2026-03-17

## Context

The repository demonstrates breadth across Java, Python, Next.js, Vite,
Postgres, MySQL, MongoDB, Redis, Kafka, and ChromaDB. That breadth is valuable
as a portfolio signal, but it becomes a maintenance liability if new work keeps
adding variation without policy.

The platform needs explicit defaults so new features do not keep expanding the
operating surface.

## Decision

Approved defaults:

### Runtime defaults

1. Spring Boot for transactional domain services.
2. Python services for AI/ML and orchestration-specific workloads.
3. Next.js for product-facing web surfaces.
4. Vite/React for operator tooling where a lighter operator app is the better
   fit.

### Data-store defaults

1. Postgres is the default transactional system of record.
2. Redis is the default transient cache/coordination store.
3. Kafka is reserved for evented or chat-style workflows.
4. ChromaDB is reserved for AI-private vector storage.
5. MongoDB and MySQL are treated as exceptions with historical or specialized
   reasons, not expansion defaults.

## Guardrails

- Introducing a new runtime or data store requires an ADR.
- New transactional product data should default to Postgres unless a written
  exception exists.
- New operator/product web surfaces should justify why they are not Next.js or
  the existing Vite operator model.

## Consequences

Positive:

- the repo gains an answer to "what should new work use?"
- long-term platform sprawl is easier to control
- review conversations can focus on exceptions rather than rediscovering defaults

Tradeoffs:

- some legacy modules remain on non-default stacks for now
- teams lose some freedom to optimize locally at the cost of platform coherence

## Out Of Scope

This ADR does not force immediate migration of existing MySQL or MongoDB
workloads. It defines the default policy for future work and rationalization.
