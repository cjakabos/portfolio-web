# Release Promotion Criteria

Use this document to decide whether a change can be promoted beyond local or
branch validation.

## Change Classes

| Change class | Minimum promotion gates | Required docs updates |
| --- | --- | --- |
| Gateway routing, auth, or admin access | gateway integration tests, affected browser smoke or E2E path, admin auth-check verification | update runbooks or operator boundary docs if behavior changes |
| Governed contract change (`cloudapp`, `petstore`, `vehicles`) | snapshot updated, `snapshotRevision` bumped, generated clients refreshed, consumer verification completed | update contract discipline docs only if the policy changes |
| AI orchestration runtime behavior | relevant AI synthetic check, degraded-mode review, monitor or operator-path verification | update AI SLOs, runbooks, or product-boundary docs if semantics change |
| Environment or secret shape | env example updated, startup path checked, release checklist reviewed | update secret-classification or setup docs when handling rules change |
| Operator-only UI or workflow | static checks plus the relevant operator behavior path | update operator boundary or runbooks if operator actions changed |

## Hard Stops

Do not promote when any of the following are true:

1. a governed contract changed without regenerating `packages/contracts/src/`
2. `manifest.json` no longer matches snapshot metadata
3. a gateway or auth change landed without validating the affected admin or
   browser flow
4. an AI behavior change landed without updating the matching runbook or SLO
   surface when the operator contract changed
5. required environment variables changed without doc updates and a startup
   check

## Release Notes Expectations

Promotion-ready changes should explain:

- which change class applies
- which governed surfaces were touched
- what verification was run
- what fallback or rollback posture exists if the change regresses
