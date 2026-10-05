---
id: REQ-HARNESS-001
title: Jira change requests remain traceable to requirements and test cases
status: proposed
owner: repository-maintainers
---

# REQ-HARNESS-001 — Traceable Jira change intake

## Requirement

The development workflow must import Jira change requests without writing to
Jira, link each request to stable requirement IDs, and produce a reviewable
proposal for any change to the canonical requirement. After a person accepts
the change, the requirement update and its generated acceptance cases must be
reviewable together with the implementation.

The trace must be navigable in both directions:

    Jira issue <-> requirement ID <-> acceptance scenario ID <-> generated case <-> PR

Jira tracks the A-to-B change and delivery workflow. It does not replace the
long-lived requirement or its rationale.

## Acceptance Scenarios

```gherkin
@REQ-HARNESS-001
Feature: Trace Jira changes to accepted requirements and test cases

  @AC-REQ-HARNESS-001-01
  Scenario: Import a linked Jira change from the read-only fixture source
    Given a fixture issue with a valid requirement ID
    When the intake command imports the issue
    Then it writes a Markdown snapshot containing the issue key, source link, timestamp, and fingerprint
    And it records the linked requirement and acceptance scenario IDs
    And it performs no Jira create, update, transition, or delete operation

  @AC-REQ-HARNESS-001-02
  Scenario: Reject an issue that references an unknown requirement
    Given a fixture issue with an unknown requirement ID
    When the intake command imports the issue
    Then it reports the unknown ID and writes no work item

  @AC-REQ-HARNESS-001-03
  Scenario: Keep a proposed requirement change separate from the accepted baseline
    Given an imported issue proposes a requirement change
    When the intake command creates its work item
    Then the proposed delta is clearly marked for human review
    And the canonical requirement file is unchanged

  @AC-REQ-HARNESS-001-04
  Scenario: Generate portable cases from requirement scenarios
    Given a requirement contains tagged Gherkin scenarios
    When the case generator runs
    Then it emits a generated feature file with the requirement and scenario IDs
    And the feature file points back to the Markdown source
```
