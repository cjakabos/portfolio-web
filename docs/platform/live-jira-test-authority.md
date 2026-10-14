# Live Jira test authority

Accepted Jira product intent includes administrator-directed issue mutations
and approval of AI proposals. Coding agents and unattended tests remain subject
to [AGENTS.md](../../AGENTS.md): each live create, update, transition, or delete
needs approval of the exact operation. The application's AI approval queue,
available credentials, and a broad workflow launch do not approve those writes.

## Unattended integration policy

The AI integration workflow runs live Jira checks only after a manual dispatch
with `jira_read_only=true`. The Boolean input defaults to false; pushes to main
and credential presence alone do not activate Jira. The workflow exposes only
dedicated `JIRA_READ_ONLY_*` configuration after that opt-in:

- `JIRA_READ_ONLY_DOMAIN`
- `JIRA_READ_ONLY_EMAIL`
- `JIRA_READ_ONLY_API_TOKEN`
- `JIRA_READ_ONLY_PROJECT_KEY`

Use a dedicated read-scoped identity and an existing non-production fixture
project containing synthetic issues. Its numeric Jira project ID must be
`10000`, matching the existing board's metadata request; the configured project
key must identify that same fixture project. Another project ID requires a
separate reviewed change to the board and guard. Configure those secrets through normal
repository administration; this implementation does not change remote settings.
Missing settings or invalid project keys fail an explicitly requested run.
The historical generic Jira secrets and `NIGHTLY_ENABLE_JIRA_E2E` flag cannot
enable this suite. Local opt-in uses `NIGHTLY_AI_E2E=1`,
`NIGHTLY_ENABLE_JIRA_READ_ONLY_E2E=1`, and the explicit fixture project key.

The live journey reads existing issues, generates a model proposal, and opens
the comparison view. It performs no issue creation, update, child creation,
transition, or cleanup deletion. A fixture issue must be supplied in advance;
the test never seeds or repairs a live Jira project.

## Runtime guard and regressions

[JiraReadOnlyBoundary](../../e2e/fixtures/jira-read-only.ts) accepts only the
configured proxy's `/get` operation for the fixture project's issue search and
issue-type metadata. This proxy uses browser/API **POST to perform an upstream
GET**, so a blanket HTTP-method rule would misclassify legitimate reads.
Browser CORS preflight on that endpoint is allowed separately. Other proxy
operations, foreign origins, spoofed bodies, duplicate JQL selectors, and
cross-project searches or metadata IDs are rejected before dispatch. Configured
proxy namespaces and encoded/matrix-parameter path aliases are guarded too;
aliases cannot broaden the exact allowed read URL. Attempted operations fail
the test even when application code handles the network rejection.

Browser routing is installed before opening Jira, with service workers blocked.
The API helper validates before calling `APIRequestContext`, which is separate
from browser routing. Tests must use that helper for Jira API calls. These test
guards complement a read-scoped provider identity; they do not provide server
authorization or replace a host permission boundary. See the official
[Playwright network guide](https://playwright.dev/docs/network) and
[APIRequestContext reference](https://playwright.dev/docs/api/class-apirequestcontext).
The dispatch input uses the official [GitHub inputs context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#inputs-context).

Run credential-free authority tests without an app stack or live Jira:

```bash
docker compose -f docker-compose.test.yml run --build --rm --no-deps test-e2e \
  e2e/jira-authority.spec.ts --config e2e/jira-authority.config.ts
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit \
  --exit-code-from test-requirements test-requirements
```

The first suite exercises real browser routing with deterministic transport and
API pre-dispatch guards. The second runs the actual workflow authority shell
step with synthetic credentials, including opt-in, missing settings, and target
injection failures. The nightly workflow runs the browser/API regressions before
its live integration specs, including when Jira is disabled. No live Jira
operation is part of these regressions.

## Live mutation verification

To verify a live mutation, prepare a separate integration task and operation
packet identifying the provider/project, existing target key or exact creation
payload, HTTP operation, full payload fingerprint, actor/credential reference,
and any cleanup. A person approves the concrete operation before dispatch.
For an AI-produced update, first generate the proposal read-only, then present
its exact payload for approval. Create operations return new keys; subsequent
updates/deletes of those keys need their own exact approvals. Cleanup must never
delete unrelated children or rely on a broad "delete all test tickets" grant.

The unattended suite intentionally has no mutation mode or approval-all flag.
Use human-operated product workflows or a separately reviewed executor for
each authorized operation. Requirement intake remains independently read-only.
Native fixture tests continue to cover Jira create/edit/delete and proposal
selection; the live nightly file now covers their read-only preview portion.
