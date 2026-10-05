---
id: REQ-JIRA-001
title: Jira issue board and local AI refinement
status: proposed
owner: jira-module
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-JIRA-001 — Jira issue workflow and AI assistance

## Observed behavior

The administrator-only Jira remote reads issues from the configured Jira project through the Jira proxy and lets an administrator create, edit, and delete issues. Its optional local Ollama assistant can review an issue or a parent with its children, propose revised issue text for comparison, and generate child issue suggestions. The administrator must explicitly approve an individual proposed change before the issue is updated and select which generated child suggestions to create.

This Jira product integration performs real Jira writes when its create, update, delete, or approve actions are used. It is distinct from the fixture-only read-only requirement intake described in REQ-HARNESS-001.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- frontend/remote/jira/pages/index.tsx — Jira board, issue mutations, AI comparison, and selected child proposals
- frontend/remote/jira/pages/api/chat.ts — local Ollama streaming chat adapter
- backend/web-proxy/src/main/java/com/example/demo/controllers/WebController.java — Jira proxy target validation and credentials
- frontend/cloudapp-shell/src/constants/routes.tsx — administrator-only route
- e2e/nightly-jira-ai.spec.ts — nightly integration flow and cleanup

## Acceptance scenarios

```gherkin
@REQ-JIRA-001
Feature: Manage Jira issues with optional local AI proposals

  @AC-REQ-JIRA-001-01
  Scenario: Read and maintain configured-project issues
    Given Jira is configured and the user is an administrator
    When the user opens the Jira board
    Then issues from the configured project are listed and can be created, edited, or deleted through the Jira proxy

  @AC-REQ-JIRA-001-02
  Scenario: Review an AI issue proposal before applying it
    Given an administrator asks the local AI assistant to refine an issue
    When the assistant returns proposed issue text
    Then the original and proposal can be compared and Jira is updated only after explicit approval

  @AC-REQ-JIRA-001-03
  Scenario: Select which generated child issues to create
    Given the local AI assistant has generated child issue suggestions for a parent
    When the administrator selects suggestions and confirms creation
    Then only selected non-empty suggestions are created under that parent
```
