# DEMO-001 — Add direct scenario-to-test trace links

> Synthetic fixture intake. No Jira connection was made and no Jira
> operation was performed.

## Source snapshot

| Field | Value |
| --- | --- |
| Source | synthetic-fixture |
| Issue | [DEMO-001](https://jira.example.invalid/browse/DEMO-001) |
| Type / status / priority | Task / To Do / Medium |
| Created / updated | 2026-10-05T09:00:00Z / 2026-10-05T09:30:00Z |
| Snapshot SHA-256 | 270b29f5c02c6c1b368a72d17742ff9318ef49cfa82b1ba3bcee0b7f9820d122 |

## Change request

As a repository maintainer, I want each imported change request to map its Jira key to stable requirement and acceptance scenario IDs and generated test cases, so reviewers can follow the full change history.

## Requirement links

- [REQ-HARNESS-001 — Jira change requests remain traceable to requirements and test cases](../requirements/REQ-HARNESS-001.md)
  Baseline SHA-256: 6bf7d40e66112ab20b3eefac02594abb8a63e2029d26342957e365bc724b3a1c

  Linked acceptance scenarios:
  - AC-REQ-HARNESS-001-01 — Import a linked Jira change from the read-only fixture source
  - AC-REQ-HARNESS-001-02 — Reject an issue that references an unknown requirement
  - AC-REQ-HARNESS-001-03 — Keep a proposed requirement change separate from the accepted baseline
  - AC-REQ-HARNESS-001-04 — Generate portable cases from requirement scenarios

## Proposed requirement amendment

> Proposal only. The canonical requirement has not been changed.

Record the chain from the Jira issue through the linked requirement and acceptance scenario to the generated case and eventual PR. Keep the requirement amendment as a proposal until a person accepts it.

## Traceability

| Jira issue | Requirement | Acceptance scenarios | Generated case |
| --- | --- | --- | --- |
| DEMO-001 | REQ-HARNESS-001 | AC-REQ-HARNESS-001-01, AC-REQ-HARNESS-001-02, AC-REQ-HARNESS-001-03, AC-REQ-HARNESS-001-04 | tests/requirement-cases/generated/REQ-HARNESS-001.feature |

## Human review

- Confirm the linked requirement IDs and proposed delta.
- Resolve product or technical questions before implementation.
- Update the canonical requirement in a reviewed PR; regenerate its
  acceptance cases in the same change.
- Add the implementation PR link to this trace when available.
- Update Jira only through a separate, explicitly approved action.
