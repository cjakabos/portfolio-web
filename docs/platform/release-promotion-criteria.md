# Release Promotion Criteria

Use this document to decide whether a change can be promoted beyond local or
branch validation.

## Change Classes

| Change class | Minimum promotion gates | Required docs updates |
| --- | --- | --- |
| Hero module UI, route, setup, or demo-flow change | matching `Core showcase` static or behavioral gates plus the affected official tour path | update README, tours, smoke-path mapping, and evidence pack if the first-run story changed |
| Gateway routing, auth, or admin access | gateway integration tests, affected browser smoke or E2E path, admin auth-check verification | update runbooks or operator boundary docs if behavior changes |
| Governed contract change (`cloudapp`, `petstore`, `vehicles`) | snapshot updated, `snapshotRevision` bumped, generated clients refreshed, consumer verification completed | update contract discipline docs only if the policy changes |
| AI orchestration runtime behavior | relevant AI synthetic check, degraded-mode review, monitor or operator-path verification | update AI SLOs, runbooks, or product-boundary docs if semantics change |
| Environment or secret shape | env example updated, startup path checked, release checklist reviewed | update secret-classification or setup docs when handling rules change |
| Operator-only UI or workflow | static checks plus the relevant operator behavior path | update operator boundary or runbooks if operator actions changed |
| Supporting or optional showcase module change | matching extended smoke path or targeted verification, plus confirmation that the hero tour still works without it | update taxonomy, tours, or evidence docs only if the flagship story changes |
| New module or showcase-tier promotion | answer the capability question, assign an owner, identify smoke coverage, and confirm setup posture | update deployable inventory, showcase taxonomy, tours, smoke paths, and stewardship docs |

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
6. a hero-module change landed without matching `Core showcase` smoke coverage
7. a new module or tier promotion landed without answering `what new
   capability does this demonstrate?`
8. the official tours or demo setup changed without updating the reader-facing
   docs

## Release Notes Expectations

Promotion-ready changes should explain:

- which change class applies
- which showcase tier or tour is affected
- which governed surfaces were touched
- what verification was run
- what fallback or rollback posture exists if the change regresses
