# Contract Release Discipline

This document turns the generated-contract ADR into a release rule set for the
current repo.

## Governed Artifacts

The governed browser-facing contract surface is:

- OpenAPI snapshots in `contracts/openapi/*.json`
- contract snapshot manifest in `contracts/openapi/manifest.json`
- generated TypeScript contract output in `packages/contracts/src/`
- shared client consumption in `packages/api-clients/`

## Versioning Rules

1. Every governed snapshot must have an entry in
   `contracts/openapi/manifest.json`.
2. `snapshotRevision` is the repo-controlled contract revision number for that
   service.
3. Increase `snapshotRevision` whenever the checked-in snapshot changes, even if
   the upstream OpenAPI `info.version` stays the same.
4. Keep `sourceTitle` and `upstreamVersion` aligned with the actual snapshot
   metadata. The contract tool validates that alignment.
5. `releaseCritical` marks whether a contract change should block broad release
   until its consumers are verified.
6. Revisions never decrease. A new governed service starts at revision 1.
   Removing a snapshot requires a separately reviewed retirement policy;
   deleting its manifest entry cannot bypass the history check.

## Required Workflow

When a governed API changes:

1. update the backend behavior and OpenAPI output
2. refresh the snapshot under `contracts/openapi/`
3. bump the matching `snapshotRevision` in `manifest.json`
4. regenerate TypeScript clients
5. review the generated diff and any shared-client or app-level fallout

## Commands

Generate or refresh the TypeScript contract package:

```bash
python3 scripts/contracts/openapi_contracts.py generate-ts
```

Validate the manifest and generated TypeScript output without live services:

```bash
python3 scripts/contracts/openapi_contracts.py generate-ts --check
```

Enforce revision changes against an available reviewed Git base:

```bash
python3 scripts/contracts/openapi_contracts.py check-revisions --base-ref origin/main
```

This compares exact checked-in snapshot bytes, including formatting changes,
with the base commit. A changed snapshot requires a strictly greater revision
even when `info.version` and generated operations are unchanged. Missing,
invalid, or non-ancestor comparison history fails closed. Fetch the base before
running locally; a current-files-only manifest/client check cannot establish
that a revision increased.

The mandatory CI API-contract job fetches full history and compares with the PR
base SHA or previous push SHA. New branches use their merge base with the remote
default branch. These event-derived bases are the CI authority; choosing `HEAD`
manually only verifies an unchanged checkout and is not release evidence.
Temporary-repository regressions run in the Docker `test-requirements` gate.

Validate live contract drift plus manifest and generated output:

```bash
python3 scripts/contracts/openapi_contracts.py check --check-generated
```

## Review Triggers

Treat the following as release-review triggers:

- snapshot changes without a `snapshotRevision` bump
- manifest metadata that no longer matches the snapshot `info` block
- generated client changes without consumer verification
- contract changes on `releaseCritical` services without product or operator
  regression coverage

## Scope Notes

The current governed contract set covers `cloudapp`, `petstore`, and
`vehicles`. The AI orchestration layer is still governed through route/runbook
discipline and synthetic checks rather than generated contract snapshots.
