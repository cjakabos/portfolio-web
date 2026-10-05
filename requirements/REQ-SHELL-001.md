---
id: REQ-SHELL-001
title: Authenticated CloudApp shell and remote-module navigation
status: proposed
owner: frontend-platform
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-SHELL-001 — CloudApp shell navigation

## Observed behavior

The CloudApp shell is the signed-in entry point for the dashboard and integrated modules. The navigation and dashboard cards reflect the user's administrator role and the enabled and available status of remote modules. When a remote is configured as opt-in or cannot be reached, the route presents an explanatory unavailable state instead of silently rendering a blank module.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- frontend/cloudapp-shell/src/constants/routes.tsx — route catalog and role/remote visibility rules
- frontend/cloudapp-shell/src/context/RemoteModulesContext.tsx — remote status discovery
- frontend/cloudapp-shell/src/components/RemoteModuleRoute.tsx — opt-in and unavailable states
- docs/platform/showcase-tours.md — portfolio and extended tour intent

## Acceptance scenarios

```gherkin
@REQ-SHELL-001
Feature: Navigate the CloudApp shell and integrated modules

  @AC-REQ-SHELL-001-01
  Scenario: Show only routes available to the signed-in user
    Given a signed-in regular user and remote status has been loaded
    When the CloudApp shell renders navigation and dashboard cards
    Then it shows routes allowed to that user whose remote modules are enabled and not explicitly unavailable

  @AC-REQ-SHELL-001-02
  Scenario: Hide administrator modules from a regular user
    Given a signed-in regular user
    When the CloudApp shell renders its routes
    Then the Jira, MLOps, and PetStore administrator routes are not listed

  @AC-REQ-SHELL-001-03
  Scenario: Explain an unavailable or opt-in remote
    Given a user opens a route for a remote module that is disabled or unreachable
    When the route is rendered
    Then the shell shows the module's opt-in or unavailable explanation and recovery hint
```
