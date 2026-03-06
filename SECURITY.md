# Security Policy

## Supported Versions

Security fixes are prioritized for:

| Version | Supported |
|---|---|
| `main` | yes |
| Latest tagged release | yes |
| Older tags/branches | best effort |

## Reporting A Vulnerability

Please do not open public issues for unpatched vulnerabilities.

Preferred path:
- Use GitHub Security Advisories (private report)

Fallback path:
- Open a normal issue with minimal details and include `SECURITY` in the title
- Do not publish exploit code or sensitive payloads in public threads

## What To Include

- Affected component(s)
- Reproduction steps
- Impact assessment
- Proposed mitigation if known

## Secrets Handling

- Never commit `.env` files or private keys
- Use local generated keys via `./scripts/setup-env-jwt-keys.sh`
- Rotate any leaked credentials immediately
