# Requirements and Change Traceability

This directory is the canonical home for durable product and system
requirements. Jira issues describe proposed changes and track delivery; they
do not silently replace the requirement baseline.

## Source-of-Truth Rules

- Every durable requirement has a stable ID such as REQ-HARNESS-001.
- A Jira change issue links to one or more requirement IDs. In a live Jira
  project, use a dedicated requirement-ID field or an explicit requirement
  link; do not rely on matching ticket titles.
- Jira remains authoritative for its issue key, status, assignee, priority,
  parent, and source description.
- Accepted requirement Markdown remains authoritative for intended behavior,
  rationale, constraints, and acceptance scenarios.
- Intake creates a snapshot and amendment proposal under work-items/. It must
  never mutate Jira or the canonical requirement file.
- A person resolves questions and reviews the requirement delta. The
  requirement amendment and generated cases are updated in the same
  implementation PR as the code. Reviewers assess them together; when that PR
  merges, the reviewed requirement becomes the current baseline. Jira may then
  be updated with the PR link through a separately approved operation.
- If the source Jira issue changes after import, re-import and show the
  difference. Never overwrite an accepted requirement or human edit silently.

The trace should be navigable in both directions:

    Jira change -> requirement ID -> acceptance scenario ID -> generated case -> PR

## Requirement File Shape

Use one Markdown file per stable requirement. Each file starts with simple
front matter:

    ---
    id: REQ-AREA-001
    title: Short requirement name
    status: proposed
    owner: owning-role
    ---

Use proposed, accepted, or retired for status. Accepted requirements are the
baseline; proposed changes remain drafts until reviewed. Put normative
behavior and rationale in prose. Put automatable acceptance scenarios in a
Gherkin fenced block and give every scenario stable tags:

    @REQ-AREA-001
    Feature: Requirement behavior

      @AC-REQ-AREA-001-01
      Scenario: A representative behavior
        Given a relevant state
        When an actor performs an action
        Then the observable result meets the requirement

Scenario tags are stable identifiers for traceability. The Gherkin text is
part of the requirement document and should be reviewed with it.

## Current Application Requirement Map

The REQ files below are a code-derived behavior baseline. They describe
observable behavior found in the current implementation and point to the
source paths used to derive it. They are marked proposed because source code
alone cannot establish that every existing behavior is intended product
behavior. Review the wording and scenarios with the product owner before
accepting them as the durable product baseline.

| Requirement | Current behavior area |
| --- | --- |
| [REQ-SHELL-001](REQ-SHELL-001.md) | CloudApp shell, remote availability, and role-aware navigation |
| [REQ-IDENTITY-001](REQ-IDENTITY-001.md) | Registration, login, sessions, and authorization |
| [REQ-WORKSPACE-001](REQ-WORKSPACE-001.md) | Personal notes and files |
| [REQ-COMMERCE-001](REQ-COMMERCE-001.md) | Catalog, personal cart, checkout, and order history |
| [REQ-CHAT-001](REQ-CHAT-001.md) | Shared rooms and live messaging |
| [REQ-VEHICLES-001](REQ-VEHICLES-001.md) | OpenMaps vehicle display and admin maintenance |
| [REQ-JIRA-001](REQ-JIRA-001.md) | Jira board, direct Jira mutations, and optional local AI assistance |
| [REQ-CHATLLM-001](REQ-CHATLLM-001.md) | Local-model chat and streamed responses |
| [REQ-MLOPS-001](REQ-MLOPS-001.md) | Customer segmentation workflow and results |
| [REQ-PETSTORE-001](REQ-PETSTORE-001.md) | Customers, pets, employees, and schedules |
| [REQ-AIOPS-001](REQ-AIOPS-001.md) | AI orchestration operator console and tool control plane |
| [REQ-RAG-001](REQ-RAG-001.md) | Document ingestion and retrieval-augmented queries |
| [REQ-APPROVAL-001](REQ-APPROVAL-001.md) | Human review of risk-sensitive AI operations |
| [REQ-HARNESS-001](REQ-HARNESS-001.md) | Jira intake and requirement-to-case traceability workflow |

This is a practical first baseline, not a claim of exhaustive requirements
coverage. New change work should link to the closest requirement or propose a
new stable ID when no existing requirement covers its behavior.

## Jira Fixture Intake

The current dummy intake reads only committed JSON fixtures. It uses no Jira
credentials, makes no network calls, and does not create a Jira ticket:

    python3 scripts/requirements/intake_jira.py --issue DEMO-001

It writes a reviewable snapshot and requirement-amendment proposal to
work-items/DEMO-001.md. Existing output is not overwritten unless --force is
passed.

The fixture is explicitly synthetic. A future live adapter should use a
read-only Jira identity and preserve this output contract. It must not reuse
the product's broad Jira CRUD flow or credentials used by the live Jira
integration test.

## Generate Acceptance Cases

Regenerate portable Gherkin case files from requirement Markdown with:

    python3 scripts/requirements/generate_cases.py

Generated files live under tests/requirement-cases/generated/. They are
derived artifacts: edit the Markdown source, then regenerate. Gherkin files
make test cases structured and portable, but they are not executable by this
repository's current Playwright, JUnit, or pytest runners until matching step
definitions or runner adapters are added. JUnit XML is a test-result format,
not a requirement source format.

## Dummy Scope

REQ-HARNESS-001 and DEMO-001 demonstrate the traceability flow only. They are
not claims about a live Jira issue or a released product commitment.
