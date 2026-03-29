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

### 5. Showcase Stewardship

- this is still a `Hero`-path change because `cloudapp` backs the primary
  browser surface
- no new module or tier promotion is proposed, so the capability question does
  not apply beyond confirming the existing hero role
- `deployable-inventory.md` ownership stays unchanged and the existing hero
  smoke path remains the browser verification gate

### 6. Environment And Secrets

- not required if no new environment variables or secret handling rules are
  introduced

### 7. Docs And Release Notes

- note the response-shape change in the PR or release notes
- call out any browser consumer updates that were required

### 8. Go/No-Go

The change is promotion-ready only when:

- the snapshot and manifest are aligned
- generated clients are current
- the affected browser flow is verified
- there is no unexplained consumer drift left in the branch

## Showcase Stewardship Dry Runs

### Scenario A: Hero Module Change

Assume the CloudApp shell homepage is reworked so the first-run experience for
the `10-minute demo` changes.

Apply the checklist like this:

1. classify it as a `Hero` module UI change
2. keep the matching `Core showcase` path green:
   `frontend-static-checks`, `frontend-unit-tests`, and `e2e-core-tests`
3. update `README.md`, `showcase-tours.md`, and `showcase-evidence-pack.md`
   if the first-run story or screenshots changed
4. keep `deployable-inventory.md` and `showcase-smoke-paths.md` aligned if
   ownership or smoke-path expectations changed

Go/no-go:

- no promotion if the hero flow changed but the README or tours still describe
  the old path
- no promotion if the shell lacks a matching `Core showcase` smoke path

### Scenario B: Optional Module Change

Assume the Petstore remote adds a new scheduling dashboard.

Apply the checklist like this:

1. classify it as an `Optional` showcase module change
2. answer the stewardship question first: `what new capability does this
   demonstrate?`
3. run the targeted verification for the optional surface and make sure the
   default hero tour still works without the new screen
4. update showcase docs only if the optional module is now worth mentioning in
   the official tours or evidence pack

Go/no-go:

- no promotion if the new dashboard adds setup or demo friction to the hero
  path
- no promotion if the optional module cannot justify its distinct showcase
  value
