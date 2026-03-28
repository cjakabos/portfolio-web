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
