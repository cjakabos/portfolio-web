# ADR 001: Gateway Policy Boundary

- Status: Accepted
- Date: 2026-03-17

## Context

The repository already routes browser traffic through the NGINX gateway for
auth checks, CORS handling, websocket upgrades, route protection, and selective
admin-only AI access. That edge boundary is one of the few platform patterns
that is already stronger than the average service/module boundary elsewhere in
the repo.

Without a written decision, the likely failure mode is drift:

- browser apps begin talking directly to internal services
- auth and RBAC rules get duplicated in clients
- AI/operator routes diverge from product routes
- CORS and rate-limiting policy fragment across services

## Decision

The NGINX gateway remains the single browser-facing policy boundary for the
platform.

The gateway owns:

1. Browser-to-service ingress policy.
2. Authentication delegation and auth-check routing.
3. RBAC-sensitive route gating for operator/admin surfaces.
4. CORS policy and preflight behavior.
5. Websocket upgrade handling.
6. Rate limiting and abuse controls.

Browser-facing applications should call same-origin or gateway-routed paths when
those paths exist. Direct browser calls to internal service hosts are not the
default path.

## Guardrails

- New browser routes should be added through gateway configuration, not by
  publishing internal ports directly to clients.
- AI/operator actions that can mutate system state must be explicitly reviewed
  at the gateway boundary.
- Exceptions require an ADR or an equivalent written design note that explains
  why the gateway is not the correct boundary.

## Consequences

Positive:

- auth, CORS, and route protection stay centralized
- browser applications stay thinner and less duplicated
- operator-only behavior has one obvious enforcement point

Tradeoffs:

- gateway changes require discipline and review
- service teams cannot bypass ingress design for convenience
- some local-debug flows remain slightly more complex than direct-service calls

## Out Of Scope

This ADR does not redefine internal service-to-service networking. It only
defines the default policy boundary for browser traffic.
