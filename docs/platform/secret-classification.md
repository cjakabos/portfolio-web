# Secret Classification

This document defines how credentials, tokens, and environment-sensitive values
in this repository should be classified and handled.

## Secret Classes

| Class | Description | Examples in this repo | Allowed location |
| --- | --- | --- | --- |
| Production secret material | Real credentials or keys for live systems | Jira API token, production JWT private key, production DB passwords, production Umami app secret | Secret manager or deployment environment only |
| Local-dev bootstrap secret | Developer-local values needed to boot the stack safely | local `.env` database passwords, local JWT secret, local Umami app secret | local ignored `.env`, local secret files |
| CI/test-only secret | Disposable values used only in automated tests or ephemeral CI | `testpass`, CI-only JWT secret, nightly smoke credentials | CI environment or test compose only |
| Demo-only bootstrap value | Explicitly opt-in values that create seeded demo users or sample integrations | `CLOUDAPP_SEED_DEMO_USERS_*` values | local ignored `.env` only, never as a checked-in default |
| Public identifier / non-secret config | Values safe to expose to the browser or public docs | host URLs, project keys, Umami website ID, local ports | checked-in config or docs when appropriate |

## Handling Rules

### Production secret material

- Never commit to the repository.
- Never place in `env.example`.
- Rotation and storage should be owned by deployment tooling, not by the repo.

### Local-dev bootstrap secrets

- May appear as placeholders in `env.example`, never as usable defaults.
- Belong in a local ignored `.env` file or in ignored local secret files.
- Should be easy to regenerate.

### CI/test-only secrets

- May be hardcoded in test-only compose or workflow paths if they are clearly
  scoped to ephemeral environments.
- Must never be reused as local or production defaults.
- Should be named so their test-only purpose is obvious.

### Demo-only bootstrap values

- Must be opt-in, never silently enabled.
- Must be documented as local convenience values, not platform defaults.
- Must not be described as expected credentials unless the user explicitly set
  them in local `.env`.

### Public identifiers / non-secret config

- Can be committed when they do not grant access.
- Should still be reviewed for least-privilege exposure.

## Repo-Specific Guidance

- `env.example` may contain placeholders and empty opt-in demo-user fields, but
  not working credentials.
- README and onboarding docs should not advertise fixed CloudApp credentials as
  normal startup behavior.
- The only acceptable checked-in defaults for secrets are disposable test-only
  values used strictly inside CI/test compositions.
- Browser-exposed values must be reviewed separately from secret handling
  because "public" does not automatically mean "low risk."

## Review Triggers

Treat a change as security-sensitive when it does any of the following:

1. adds or renames an environment variable
2. changes a gateway auth path or operator-admin route
3. modifies seeded demo-user behavior
4. introduces a new external integration
5. moves a value from server-side config into browser-exposed config
