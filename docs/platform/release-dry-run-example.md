# Release Checklist Dry Run

This example shows how to apply the release checklist to a representative
governed change.

## Scenario

Assume a CloudApp API change updates an item or order response shape that is
consumed by the shared browser clients.

## Dry Run

### 1. Classify The Change

- change class: governed contract change
- affected service: `cloudapp`
- release impact: `releaseCritical` because the primary product web depends on
  this service

### 2. Contract Discipline

- refresh `contracts/openapi/cloudapp.json`
- bump `cloudapp.snapshotRevision` in `contracts/openapi/manifest.json`
- regenerate `packages/contracts/src/`
- review the generated diff and the shared client fallout in
  `packages/api-clients/` and browser consumers

### 3. Gateway And Auth

- if the API route stays behind the existing gateway prefix, no gateway config
  change is required
- if auth semantics changed, validate the corresponding browser flow through
  the gateway before promotion

### 4. AI And Operator Impact

- not required for a pure CloudApp contract change unless the monitor or AI
  layer consumes the changed route

### 5. Environment And Secrets

- not required if no new environment variables or secret handling rules are
  introduced

### 6. Docs And Release Notes

- note the response-shape change in the PR or release notes
- call out any browser consumer updates that were required

### 7. Go/No-Go

The change is promotion-ready only when:

- the snapshot and manifest are aligned
- generated clients are current
- the affected browser flow is verified
- there is no unexplained consumer drift left in the branch
