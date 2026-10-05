---
schema_version: 1
id: REQ-APPROVAL-001
title: Human review of risk-sensitive AI actions
status: proposed
owner: ai-platform
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-APPROVAL-001 — Human-in-the-loop approvals

## Observed behavior

The orchestration layer creates approval requests for operations that its risk rules identify as requiring review. Operators can inspect pending approvals and approve or reject them. The service derives the approver identity from its verified administrator authentication, keeps approval history, and can resume an approved workflow with the original requester's identity. Approval updates can be sent to connected monitor clients.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- ai-orchestration/ai-orchestration-layer/src/core/human_in_loop.py — risk-based approval and workflow wait/resume
- ai-orchestration/ai-orchestration-layer/src/routers/approvals_router.py — approval API, identity, persistence, and history
- ai-orchestration/ai-orchestration-monitor/components/ApprovalInterface.tsx — operator decision interface
- tests/ai-orchestration-layer/test_approvals_router.py — approver attribution and resume identity behavior
- docs/platform/runbooks/ai-approvals-failure.md — approval operation runbook

## Acceptance scenarios

```gherkin
@REQ-APPROVAL-001
Feature: Review risk-sensitive AI actions

  @AC-REQ-APPROVAL-001-01
  Scenario: Present a review request for a gated operation
    Given an orchestration operation exceeds its configured automatic approval threshold
    When the operation reaches the approval gate
    Then it remains pending and is visible in the operator approval queue

  @AC-REQ-APPROVAL-001-02
  Scenario: Attribute an approval decision to the verified administrator
    Given an approval is pending and an administrator is authenticated
    When the administrator approves or rejects the request
    Then the decision records the verified administrator identity and appears in approval history

  @AC-REQ-APPROVAL-001-03
  Scenario: Resume an approved workflow as its original requester
    Given a requester's workflow is waiting for an approval decision
    When an administrator approves and resumes the workflow
    Then resumed downstream work uses the original requester's identity
```
