# A bounded agentic development lifecycle

This is an executed local example for accepted
[REQ-HARNESS-001](../../../requirements/REQ-HARNESS-001.md), specifically
`AC-REQ-HARNESS-001-04`: generate portable cases with stable IDs and a Markdown
source link. The engineering owner authorized this example on 2026-10-13 as
item 3 of the four-change task. No product behavior is amended by the replay.

## Trace from intent to feedback

| Stage | Concrete artifact and outcome |
| --- | --- |
| Accepted intent | [Requirement](../../../requirements/REQ-HARNESS-001.md), [human decision](../../../requirements/reviews/BASELINE-2026-10-12.md), and the exact revision in [baseline.json](../../../requirements/baseline.json) |
| Scoped task | [Generation task](../../../work-items/agent-tasks/LIFECYCLE-GENERATION-2026-10-13.json) binds the accepted requirement digest and one scenario; [parent task](../../../work-items/agent-tasks/ADLC-2026-10-13.json) records the four authorized engineering changes |
| Implementation | [Rehearsal driver](../../../scripts/adlc/rehearse_generation.py) invokes the real [compiler](../../../scripts/requirements/generate_cases.py) in a disposable workspace; its inputs are identified by SHA-256 in the execution record |
| Execution evidence | [Recorded run](recorded-run.json) retains the initial success, missing-feature rejection, regeneration, and recovered success; [regressions](../../../tests/requirement-cases/test_lifecycle_generation.py) also reject stale task intent and unexpected command failure |
| Independent review | [Review record](independent-review.md) identifies a separate agent explicitly authorized by the owner, reviewed file hashes, concrete findings, fixes, and final disposition |
| Release rehearsal | Re-run the command below, verify unchanged canonical inputs and identical recovered output, and confirm temporary workspace cleanup. The result is a local rehearsal, with no deployment or publication operation. |
| Feedback | [Feedback and recovery](feedback.md) records the independently found authority/revision bypasses and the regressions that closed them; future product amendments still need human acceptance |

The implementation revision is bound by file digests rather than a self-referential
commit hash inside the same commit. Use `git log -- scripts/adlc/rehearse_generation.py`
to find the commit that publishes these files together. The recorded JSON is a
historical run; it does not claim that later repository revisions passed all
native suites.

## Reproduce the local rehearsal

Build the existing requirement runtime, then disable networking for the replay:

```bash
docker compose -f docker-compose.test.yml build test-requirements
docker run --rm --network none \
  --mount type=bind,source="$PWD",target=/workspace \
  --workdir /workspace --entrypoint python3 portfolio-web-requirements:local \
  scripts/adlc/rehearse_generation.py
```

Evidence is written to `test-results/adlc-generation/run.json`. The driver never
executes commands from issue/task text and never reads live credentials. It
validates the task against accepted intent, copies canonical requirements into
a temporary directory, invokes the real generator, verifies freshness, removes
one temporary generated feature as fault injection, expects freshness exit 2,
regenerates, and verifies byte-equivalent recovery. The canonical source and
checked-in generated cases remain unchanged.

For the requirement and replay regressions:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit \
  --exit-code-from test-requirements test-requirements
```

The existing test map links this accepted scenario to
`RequirementHarnessTests.test_generator_emits_requirement_and_acceptance_ids`.
The new replay adds lifecycle/failure evidence alongside that native assertion;
it does not replace the mapped test or claim coverage for the other 47 scenarios.

## Failure and recovery decisions

| Trigger | Stop condition | Recovery |
| --- | --- | --- |
| Accepted requirement or human decision differs from task | Task validation rejects; old rehearsal success is invalidated | Obtain reviewed intent/task updates before retrying; never refresh acceptance automatically |
| Generated feature missing | Compiler freshness check returns 2; failed command remains in the report | Regenerate from accepted source and compare recovered artifact digests with the initial output |
| Unexpected generator exit | Run is `failed`, with command result preserved | Fix within authorized scope, obtain review and fresh evidence, then rehearse again |
| Review identifies scope/security defect | Promotion is blocked despite green tests | Preserve findings, add reproductions, fix, and request independent re-review |
| Git base missing or wrong branch | Task/revision checks fail closed | Restore the reviewed comparison history/branch; do not select a convenient base to bypass the gate |

Full repository promotion still requires current default-suite evidence for
every affected requirement, independent review, and applicable human merge or
release authority. Application AI approvals cannot authorize that promotion.
