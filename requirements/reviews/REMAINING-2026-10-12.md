---
schema_version: 1
id: REMAINING-2026-10-12
status: accepted
decided_by: repository-owner
decided_on: "2026-10-12"
requirements:
  - REQ-AIOPS-001
  - REQ-APPROVAL-001
  - REQ-CHATLLM-001
  - REQ-JIRA-001
  - REQ-PETSTORE-001
requirement_digests:
  REQ-AIOPS-001: 614ba7fbb56af80195bf6d2ef8513e648a0b0a1fe04e521e51f9e9473dd68b3d
  REQ-APPROVAL-001: 3cc7c52ed04c51f52d95f2a0ca6cc38284e2084259cab76133a71e5c3a8a123c
  REQ-CHATLLM-001: 1e1615ab09ab8362c740a25928dac5adc73b4888658a32501d202b12af61f0bc
  REQ-JIRA-001: 84e1d3fecdc1984b7e8bbe5e7a52f58d9936c4e2b645c2da7fc78cc34fdb5934
  REQ-PETSTORE-001: f35f9dd76e91947e28c1cd34c65109662bd488bf3506a3f197a3245127233f13
---

# Remaining showcase and operator product intent

Decision status: accepted by the repository owner on 2026-10-12.
Branch: codex/adlc-review-fixes.

The repository owner explicitly approved the remaining product intent in chat:

> I approve  these also: Still proposed: Jira, ChatLLM, MLOps, Petstore, AI operator console, RAG, and AI approvals.

MLOps and RAG were already accepted in
[ACCESS-2026-10-12](ACCESS-2026-10-12.md), including their administrator-only
access policy. That policy remains part of the accepted baseline. This decision
accepts the five remaining requirement documents below and their existing 15
acceptance scenarios. The scenario wording and test assertions are unchanged.

| Requirement | Accepted intent | Scope and limits |
| --- | --- | --- |
| [REQ-JIRA-001](../REQ-JIRA-001.md) | Administrator Jira board, explicit issue mutations, comparison and approval of AI refinements, and selection of generated child issues | Default evidence uses deterministic Jira/model boundaries; live-provider availability is verified separately. Jira operations continue to require human authorization for each exact mutation. |
| [REQ-CHATLLM-001](../REQ-CHATLLM-001.md) | Local-model selection, streamed answers, conversation reset on model changes, and reasoning when supported | Default model responses and support probes are deterministic; acceptance does not establish model quality or live Ollama availability. |
| [REQ-PETSTORE-001](../REQ-PETSTORE-001.md) | Customer/pet association, employee skills and availability, and pet-care schedules with entity queries | Administrator-only module exposure is the UI scope; these domain scenarios do not certify backend mutation authorization. |
| [REQ-AIOPS-001](../REQ-AIOPS-001.md) | Administrator-protected operator actions, health/activity dashboards, and orchestration tool discovery/invocation | Administrator operations and authenticated-user tools retain their existing boundaries; dashboard provider data and downstream tool responses are deterministic in default evidence. |
| [REQ-APPROVAL-001](../REQ-APPROVAL-001.md) | Pending risk-gated requests, decisions attributed to verified administrators, approval history, and resumption as the original requester | Approval preserves requester identity and does not grant new access; RAG resumption remains subject to the accepted administrator policy. |

The complete wording and scenarios in the linked requirements are part of this
decision. Code-derived provenance stays recorded after acceptance. Together with
[the initial hero/harness decision](BASELINE-2026-10-12.md) and the MLOps/RAG
access decision, all 14 current requirements and 48 scenarios are accepted for
the local showcase.

The exact accepted revisions are bound above and in requirements/baseline.json.
Product acceptance establishes intended behavior; current passing execution
evidence remains a separate promotion gate. This record does not assert a fresh
full-suite run or production readiness. The merged reviewed PR becomes the
maintained baseline. Future amendments still require human review.
