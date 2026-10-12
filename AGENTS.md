# Agent Instructions

## Start Here

- Read README.md, CONTRIBUTING.md, and TESTING.md.
- Use docs/platform/README.md to find authoritative architecture, security,
  release, and showcase rules.
- Use requirements/README.md for requirement ownership, Jira intake, and
  generated acceptance cases.

## Working Rules

- Keep changes small and aligned with the repository's showcase tiers.
- Treat accepted requirement Markdown as the product requirement baseline.
- Accepted revisions must link to a real human decision under requirements/reviews/
  and match requirements/baseline.json. Never invent acceptance or infer it from
  passing tests. For promotion, require accepted intent for each affected ID.
- Jira is a change and workflow tracker. Intake is read-only by default; never
  create, edit, transition, or delete Jira issues unless a human approves the
  exact operation.
- A Jira change proposes a requirement amendment. Update the canonical
  requirement and regenerate its cases in the same reviewed PR as the
  implementation. The merged PR becomes the current baseline.
- Run the Docker `test-requirements` gate for requirement/harness changes.
  Review changed case digests and update coverage assertions/gaps in test-map.json.
- Do not edit generated requirement cases directly. Edit their requirement
  source and regenerate them.
- Select focused checks from TESTING.md and the relevant smoke-path and
  release-promotion docs. Report commands and evidence.
- Escalate product ambiguity, missing requirement links, architecture
  exceptions, and security-sensitive decisions to a person.
