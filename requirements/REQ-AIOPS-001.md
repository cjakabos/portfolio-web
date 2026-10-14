---
schema_version: 1
id: REQ-AIOPS-001
title: AI operator console and orchestration control plane
status: accepted
owner: ai-platform
basis: code-derived-current-behavior
review: requirements/reviews/REMAINING-2026-10-12.md
---

# REQ-AIOPS-001 — AI operator console

## Product intent

The operator console uses the CloudApp administrator identity for protected operator operations. It exposes service health, orchestration activity, errors, metrics, available local models, and a discoverable tool catalog. The orchestration API accepts requests for platform capabilities and supports a WebSocket streaming path. Tool invocation is mediated by the orchestration service rather than by a browser calling each internal service directly.

The repository owner accepted this behavior for the local portfolio showcase.
See [the human decision](reviews/REMAINING-2026-10-12.md) for scope and limits.

## Evidence

- ai-orchestration/ai-orchestration-monitor/components/UnifiedDashboard.tsx — operator dashboard navigation
- ai-orchestration/ai-orchestration-monitor/components/ServicesDashboard.tsx — service and user inspection
- ai-orchestration/ai-orchestration-monitor/components/ObservabilityDashboard.tsx and ai-orchestration/ai-orchestration-monitor/components/ErrorDashboard.tsx — operator signals
- ai-orchestration/ai-orchestration-layer/src/routers/orchestration_router.py — orchestration and streaming routes
- ai-orchestration/ai-orchestration-layer/src/routers/tools_router.py — tool discovery and invocation
- ai-orchestration/ai-orchestration-layer/src/routers/system_router.py and ai-orchestration/ai-orchestration-layer/src/routers/metrics_router.py — system and metrics routes
- ai-orchestration/ai-orchestration-layer/src/auth.py — CloudApp identity and administrator checks
- tests/ai-orchestration-layer/test_auth.py — identity verification boundaries

## Acceptance scenarios

```gherkin
@REQ-AIOPS-001
Feature: Operate the AI orchestration platform

  @AC-REQ-AIOPS-001-01
  Scenario: Reject operator actions without an administrator identity
    Given a caller is unauthenticated or is a regular user
    When the caller requests an administrator-protected operator operation
    Then the service denies the operation after checking identity with CloudApp

  @AC-REQ-AIOPS-001-02
  Scenario: Inspect platform health and activity
    Given an administrator opens the operator console
    When service, observability, or error dashboards load
    Then the console presents the available health, execution, metric, and error information

  @AC-REQ-AIOPS-001-03
  Scenario: Discover and invoke an orchestration tool
    Given an authenticated user and a tool exposed by the AI control plane
    When the user discovers the tool and submits valid invocation parameters
    Then the orchestration service invokes the tool and returns its result
```
