---
schema_version: 1
id: REQ-INTENT-001
title: CI requires recorded acceptance for every active canonical requirement
status: accepted
owner: repository-maintainers
basis: repository-owner-request-2026-10-15
review: requirements/reviews/INTENT-2026-10-15.md
---

# REQ-INTENT-001 — Automatic requirement acceptance scan

## Product intent

The mandatory CI requirement gate discovers every `requirements/REQ-*.md`
document without a manually selected ID list. Every active document must have
accepted intent, a matching recorded human decision, and its exact file digest
in `requirements/baseline.json`. A newly added proposed requirement blocks the
gate even when its generated cases, coverage map and tests are otherwise valid.
Setting `status: accepted` alone or updating only a baseline digest cannot
establish acceptance. Amending an accepted document requires renewed review.

Retired documents do not represent active behavior. Their existing parser and
baseline consistency rules still apply, and retirement remains subject to
independent human review. Draft generation and source validation remain usable
without the strict CI mode while a proposal is under review.

The scan checks declared requirement documents. It does not infer missing
requirements from implementation code or authenticate an agent-editable human
decision record. Independent human review and protected repository settings
remain the trust boundary. Implementation authorization is separate from
acceptance of this requirement.

The repository owner accepted this requirement and its four scenarios on
2026-10-15 through an explicit chat instruction. See the
[human decision](reviews/INTENT-2026-10-15.md) for the exact accepted revision,
coverage boundaries, and scope. Passing tests remain a separate decision from
product acceptance.

## Acceptance scenarios

```gherkin
@REQ-INTENT-001
Feature: Require accepted intent for every active canonical requirement

  @AC-REQ-INTENT-001-01
  Scenario: Discover an unselected new proposed requirement
    Given the existing requirement baseline is accepted
    And a new proposed canonical requirement has fresh generated cases and valid test mappings
    When the mandatory CI requirement gate scans the repository
    Then it fails and identifies the unaccepted new requirement without requiring an explicit ID selection

  @AC-REQ-INTENT-001-02
  Scenario: Reject acceptance declared without a recorded decision
    Given a new canonical requirement is marked accepted without a matching recorded decision and baseline entry
    When the mandatory CI requirement gate scans the repository
    Then it fails rather than treating the status field as human acceptance

  @AC-REQ-INTENT-001-03
  Scenario: Reject an amended revision without renewed acceptance
    Given an accepted requirement is amended after its recorded human decision
    When the mandatory CI requirement gate scans the repository
    Then it fails until the exact revised digest matches the baseline and recorded decision

  @AC-REQ-INTENT-001-04
  Scenario: Pass when every active requirement has matching acceptance
    Given every active canonical requirement has a matching accepted decision and baseline revision
    And generated cases and source mappings are current
    When the mandatory CI requirement gate scans the repository
    Then source validation passes without claiming test execution or approval of undeclared behavior
```
