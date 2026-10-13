# Feedback and recovery record

The independent reviewer found five defects before the authority/revision work
was considered complete. Green implementation tests had not covered staged
content divergence, path aliases, missing decision records, or identical
temporary Git commits. The initial review blocked promotion, each issue gained
a reproducer, and the independent follow-up verified all 22 focused tests.
See [the review record](independent-review.md) for findings and source hashes.

The bounded generation rehearsal adds a second, executable failure/recovery
path. A generated feature is deliberately removed from a temporary workspace.
The real compiler rejects freshness with exit 2; regeneration restores the exact
accepted output. The execution record retains the failure and both surrounding
successful checks. Unexpected command failures and stale intent invalidate
previous success instead of reusing it.

Changes adopted from feedback:

- Inspect both staged and working content when checking an agent write boundary.
- Preserve governed Git namespaces; reject aliases before comparing history.
- Verify human-decision records as well as accepted file fingerprints.
- Make temporary Git fixtures deterministic through distinct commit content.
- Keep independent review results and executed command evidence separate from
  human release authority.

Follow-up triggers are explicit: new live-provider verification needs a separate
integration task and credential scope; Jira writes need exact-operation human
approval, including cleanup. A future amendment to accepted intent renews the
requirement decision and task fingerprints before replay. The local rehearsal
does not change product requirements, merge a PR, or deploy the platform.
