# ADR 003: AI And Operator Boundary

- Status: Accepted
- Date: 2026-03-17

## Context

The repository exposes AI capabilities through the orchestration layer and also
ships a dedicated operator-facing monitor. Those surfaces mix read-only system
visibility, action-capable operator workflows, and privileged admin behavior.

Without a written boundary, the operator app becomes a policy exception and the
AI layer becomes harder to secure, test, and reason about.

## Decision

The AI orchestration layer and the operator monitor are treated as a distinct
operator domain, not as an extension of the end-user product UI.

The boundary works as follows:

1. The monitor remains a separate operator application.
2. Operator and AI routes are exposed through the gateway, not directly from
   the browser to internal AI services.
3. Operator capabilities are classified as:
   - read-only visibility
   - write-capable operator actions
   - admin-only actions
4. Admin-only actions require explicit gateway enforcement and should not rely
   on client-only affordances.

## Guardrails

- Product UI should not absorb operator workflows by default.
- AI capabilities exposed to product users must be intentionally promoted out of
  the operator domain.
- Degraded-mode behavior for AI dependencies must be explicit so operator flows
  fail predictably.

## Consequences

Positive:

- operator behavior is easier to secure and audit
- AI failure domains remain more isolated from core product flows
- monitoring and approvals workflows can evolve without distorting the product UI

Tradeoffs:

- some functionality will exist only in the operator surface
- cross-surface feature requests require explicit ownership decisions

## Out Of Scope

This ADR does not define the detailed feature set of the operator monitor. It
defines ownership and boundary rules.
