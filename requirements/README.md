# Requirements and Change Traceability

This directory is the canonical home for durable product and system
requirements. Jira issues describe proposed changes and track delivery; they
do not silently replace the requirement baseline.

## Source-of-Truth Rules

- Every durable requirement has a stable ID such as REQ-HARNESS-001.
- A Jira change issue links to one or more requirement IDs. In a live Jira
  project, use a dedicated requirement-ID field or an explicit requirement
  link; do not rely on matching ticket titles.
- Jira remains authoritative for its issue key, status, assignee, priority,
  parent, and source description.
- Accepted requirement Markdown remains authoritative for intended behavior,
  rationale, constraints, and acceptance scenarios.
- Intake creates a snapshot and amendment proposal under work-items/. It must
  never mutate Jira or the canonical requirement file.
- A person resolves questions and reviews the requirement delta. The
  requirement amendment and generated cases are updated in the same
  implementation PR as the code. Reviewers assess them together; when that PR
  merges, the reviewed requirement becomes the current baseline. Jira may then
  be updated with the PR link through a separately approved operation.
- If the source Jira issue changes after import, re-import and show the
  difference. Never overwrite an accepted requirement or human edit silently.

The trace should be navigable in both directions:

    Jira change -> requirement ID -> acceptance scenario ID -> generated case -> PR

## Requirement File Shape

Use one Markdown file per stable requirement. Each file starts with simple
front matter:

    ---
    schema_version: 1
    id: REQ-AREA-001
    title: Short requirement name
    status: proposed
    owner: owning-role
    ---

Use proposed, accepted, or retired for status. Accepted requirements are the
baseline; proposed changes remain drafts until reviewed. Put normative
behavior and rationale in prose. Put automatable acceptance scenarios in a
Gherkin fenced block and give every scenario stable tags:

    @REQ-AREA-001
    Feature: Requirement behavior

      @AC-REQ-AREA-001-01
      Scenario: A representative behavior
        Given a relevant state
        When an actor performs an action
        Then the observable result meets the requirement

Scenario tags are stable identifiers for traceability. The Gherkin text is
part of the requirement document and should be reviewed with it.

## Current Application Requirement Map

The REQ files below are a code-derived behavior baseline. They describe
observable behavior found in the current implementation and point to the
source paths used to derive it. They are marked proposed because source code
alone cannot establish that every existing behavior is intended product
behavior. Review the wording and scenarios with the product owner before
accepting them as the durable product baseline.

| Requirement | Current behavior area |
| --- | --- |
| [REQ-SHELL-001](REQ-SHELL-001.md) | CloudApp shell, remote availability, and role-aware navigation |
| [REQ-IDENTITY-001](REQ-IDENTITY-001.md) | Registration, login, sessions, and authorization |
| [REQ-WORKSPACE-001](REQ-WORKSPACE-001.md) | Personal notes and files |
| [REQ-COMMERCE-001](REQ-COMMERCE-001.md) | Catalog, personal cart, checkout, and order history |
| [REQ-CHAT-001](REQ-CHAT-001.md) | Shared rooms and live messaging |
| [REQ-VEHICLES-001](REQ-VEHICLES-001.md) | OpenMaps vehicle display and admin maintenance |
| [REQ-JIRA-001](REQ-JIRA-001.md) | Jira board, direct Jira mutations, and optional local AI assistance |
| [REQ-CHATLLM-001](REQ-CHATLLM-001.md) | Local-model chat and streamed responses |
| [REQ-MLOPS-001](REQ-MLOPS-001.md) | Customer segmentation workflow and results |
| [REQ-PETSTORE-001](REQ-PETSTORE-001.md) | Customers, pets, employees, and schedules |
| [REQ-AIOPS-001](REQ-AIOPS-001.md) | AI orchestration operator console and tool control plane |
| [REQ-RAG-001](REQ-RAG-001.md) | Document ingestion and retrieval-augmented queries |
| [REQ-APPROVAL-001](REQ-APPROVAL-001.md) | Human review of risk-sensitive AI operations |
| [REQ-HARNESS-001](REQ-HARNESS-001.md) | Jira intake and requirement-to-case traceability workflow |

This is a practical first baseline, not a claim of exhaustive requirements
coverage. New change work should link to the closest requirement or propose a
new stable ID when no existing requirement covers its behavior.

## Jira Intake: Fixture or Read-only Live Source

Both sources use the same requirement validation and Markdown renderer. Fixture
mode is the default, even when Jira credentials are configured. The live source
is selected explicitly with `--source jira`; it sends only GET requests and uses
a dedicated identity, separate from the product Jira board/proxy credentials.
No app stack, Jira administration change, or source-code edit is required.

### Fixture mode

Preview the committed synthetic issue in a separate directory so the existing
reviewed example is preserved:

```bash
docker compose -f docker-compose.test.yml run --build --rm --no-deps \
  --user "$(id -u):$(id -g)" jira-intake \
  --issue DEMO-001 --output-dir work-items/fixture-preview
```

This reads `fixtures/jira/DEMO-001.json` without network access and writes
`work-items/fixture-preview/DEMO-001.md`. The original example remains at
[work-items/DEMO-001.md](../work-items/DEMO-001.md). The `intake` Compose profile
keeps this operator command outside the automated test matrix.

### Jira Cloud

Put the following values in your local ignored `.env` or deployment environment:

```dotenv
JIRA_INTAKE_URL=https://your-company.atlassian.net
JIRA_INTAKE_EMAIL=you@example.com
JIRA_INTAKE_API_TOKEN=your-dedicated-intake-token
```

For a **scoped API token**, also set `JIRA_INTAKE_CLOUD_ID` to your site's UUID.
The adapter selects `https://api.atlassian.com/ex/jira/<cloud-id>` automatically;
`JIRA_INTAKE_URL` remains the browser URL used in snapshot links. Tokens without
scopes use the site URL directly. See
[Atlassian's token documentation](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).
The identity needs permission to read the target issue and the scopes needed by
[Get issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get).
Use a dedicated read-scoped token/account for this command.

Import an **existing** issue and link it to a requirement locally:

```bash
docker compose -f docker-compose.test.yml run --build --rm --no-deps \
  --user "$(id -u):$(id -g)" jira-intake \
  --source jira --issue PROJECT-123 --requirement-id REQ-IDENTITY-001
```

The output is `work-items/PROJECT-123.md`. It includes the issue link, source
created/updated timestamps, retrieval time, a SHA-256 of the API response, linked
requirement/scenario IDs, and their baseline fingerprints. Jira Cloud rich-text
(ADF) descriptions are converted to readable text. Moved issues use their returned
canonical key and preserve the requested key as provenance.

### Requirement links and amendments

- Repeat `--requirement-id` to link multiple requirements. Explicit arguments
  override source links and are validated locally before the API request.
- Without explicit arguments, exact `REQ-AREA-001` Jira labels supply links.
- An existing custom field can also supply IDs via
  `JIRA_INTAKE_REQUIREMENTS_FIELD=customfield_12345`. Text, multi-value/select and
  ADF text fields are supported. Creating a custom field is optional.
- Missing, duplicate or unknown explicit IDs are rejected. Duplicate IDs found
  across Jira labels/fields are consolidated. Retired requirements are rejected.
- `--proposed-change "Describe the intended requirement amendment"` adds a
  human-authored proposal. Otherwise the snapshot states that no delta was
  supplied; intake does not invent a requirement change from issue text.
- Existing work items are published atomically and preserved on repeat imports.
  After reviewing source changes and keeping human notes/PR links, explicitly
  use `--force` to replace the snapshot.
- Canonical requirements remain unchanged during either form of intake. Review
  amendments with the implementation PR and regenerate cases in that PR.

### Jira Data Center and deployment options

For a Data Center personal access token, configure:

```dotenv
JIRA_INTAKE_URL=https://jira.your-company.example/jira
JIRA_INTAKE_AUTH=bearer
JIRA_INTAKE_API_TOKEN=your-dedicated-personal-access-token
```

Bearer mode defaults to API v2 and needs no email. Basic mode defaults to API v3.
`JIRA_INTAKE_API_VERSION=2` or `3` overrides either default. See
[Atlassian's PAT documentation](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html).

Additional configuration requires no adapter changes:

| Setting | Purpose |
| --- | --- |
| `JIRA_INTAKE_API_BASE_URL` | API/proxy base URL when different from the browser URL; use this or `JIRA_INTAKE_CLOUD_ID` |
| `JIRA_INTAKE_API_TOKEN_FILE` | Read a mounted token file inside the container; leave `JIRA_INTAKE_API_TOKEN` empty |
| `JIRA_INTAKE_CA_CERT` | PEM CA bundle inside the container for an internal certificate authority |
| `--output-dir` | Alternative snapshot directory; relative paths resolve under the repository |

Mount secret files or CA bundles read-only at the configured container paths using
Compose overrides or `docker compose run --volume`. HTTPS verification stays
enabled; authenticated redirects are rejected. Requests have a 15-second timeout,
a 5 MiB response limit, and at most two retries for rate limits/transient gateway
errors. Longer server-requested delays produce a retry-later message. Authentication
and HTTP errors do not echo tokens, headers or response bodies.

The Linux/macOS examples use `--user "$(id -u):$(id -g)"` so snapshots belong to
your host account. On Windows/PowerShell, omit that option and run the command on
one line. Snapshots are created with owner-only permissions because live issue
data can be private. Source scripts, requirements and fixtures are mounted
read-only; only `work-items/` is writable. The local `.env` file is not mounted.
For an output directory outside `work-items/`, explicitly mount it writable too.

The current client is a local/operator command with environment-provided tokens.
It does not implement hosted multi-user OAuth onboarding or token refresh.
The existing mapped harness scenarios exercise fixture intake; live provider
verification requires an explicit follow-up test run and its own evidence.

## Generate Acceptance Cases

Regenerate portable Gherkin case files from requirement Markdown with:

    docker compose -f docker-compose.test.yml build test-requirements
    docker run --rm -v "$PWD:/workspace:rw" portfolio-web-requirements:local python3 scripts/requirements/generate_cases.py

Check freshness without writing:

    docker compose -f docker-compose.test.yml run --rm --no-deps --entrypoint python3 test-requirements scripts/requirements/generate_cases.py --check

The shared compiler validates YAML schema version 1 and uses Cucumber's official
Gherkin parser. Use exactly one Feature block per requirement and exactly one
`@AC-REQ-AREA-001-NN` tag on each Scenario. Tags must belong to their requirement,
and IDs must be unique across the baseline. Scenario Outlines require Examples.
Retired and removed requirements do not retain generated features.

Generated files and `index.json` live under tests/requirement-cases/generated/.
The index includes requirement and case digests. They are
derived artifacts: edit the Markdown source, then regenerate. Gherkin files
make test cases structured and portable, but they are not executable by this
repository's current Playwright, JUnit, or pytest runners until matching step
definitions or runner adapters are added. JUnit XML is a test-result format,
not a requirement source format.

## Fixture Example Scope

DEMO-001 remains a synthetic example of the traceability flow. It does not refer
to a live Jira issue or a released product commitment. REQ-HARNESS-001 describes
the intake workflow, including its configurable sources, and remains proposed
pending product validation.

## Test Evidence Contract

`test-map.json` uses schema version 2. Each canonical case has a reviewed
`case_digest`, a coverage owner, coverage (`complete`, `partial`, or `missing`),
a list of test targets, and a specific remaining gap. Complete coverage is a
reviewed assertion about the mapped tests; static validation cannot prove its
semantic completeness. Missing coverage has no targets and must explain the gap.
Changing requirement text or status invalidates its reviewed case digests.
Regenerate artifacts, review the affected assertions, then update the map digests
from the generated index in the same PR.

Targets use exact test declarations: Python function or `Class.method`, Java
`Class.method`, and a unique TypeScript test title within its source file.
Python AST and Java/TypeScript syntax trees reject comments, generic prefixes,
and ambiguous titles. Each target records what it asserts, its Docker suite,
and `default` or `opt-in` execution. Nightly/live tests remain opt-in.
This is declaration validation, not native runner discovery or execution.

Run the PR gate and command regression tests with:

    docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-requirements test-requirements

The gate compares features/index with canonical Markdown and checks exact test
links. Its JSON report initially labels every outcome `not-run`. The harness
runner produces JUnit XML and then attaches exact outcomes for its own tests.
Coverage completeness and passed/failed/skipped/not-run outcomes stay separate.
A skipped or unmapped test never counts as passing evidence.

Execution context records the commit identifier, canonical requirement digests,
test-map digest, mapped test source digests, application source/configuration,
dependency manifests, migrations, Docker definitions and harness sources before
each runner starts. Build caches, generated runtime output and environment files
are excluded. Changed implementation or runner inputs invalidate previous evidence.
The adapters refuse a context that differs from the validated report.

Python/Java JUnit XML and Jest/Vitest JSON identities are supported. JSON results
must match the exact repository-relative source path and unique test title;
missing, ambiguous and skipped results cannot become passing evidence. The
portable Gherkin scenarios remain the acceptance contract, linked to the existing
native runners without a second execution framework.

All 46 current scenarios have reviewed complete mappings. Completeness describes
the assertions at their documented boundaries; it is separate from execution and
from exhaustive product coverage. The tests exercise real application components,
API clients, databases, Kafka, document parsing, Chroma and KMeans where relevant.
External Ollama/model responses, Jira, map tiles/Leaflet geometry and operator hook
responses use deterministic fixtures. This does not establish live provider
availability, model quality, visual layout correctness or a production deployment.
Existing live/nightly browser checks remain complementary opt-in checks. They are
not prerequisites for the default mapped acceptance evidence.

Each native runner starts through `run_native.py`. The wrapper invalidates old
completion records and result files before dependency installation or discovery,
records source context, then records the exit status and report/context digests.
A failed or interrupted rerun cannot reuse previous passing evidence, and modified
report bytes are rejected even if the source context matches.

Native suites write reports, context and `run.json` under `test-results/`:

| Suite | Evidence directory | Result format |
| --- | --- | --- |
| Requirement harness | `requirements/` | JUnit XML |
| CloudApp, Petstore, Vehicles, Web Proxy | `backend/<service>/` | JUnit XML |
| ML pipeline | `ml-pipeline/` | JUnit XML |
| AI orchestration | `ai-orchestration/` | JUnit XML |
| Shell and remote components/hooks | `frontend-unit/` | Jest JSON |
| Operator monitor components | `ai-monitor-component/` | Vitest JSON |

After these suites run against the same checkout, require current passing evidence
for every default target:

    docker compose -f docker-compose.test.yml run --build --rm --no-deps test-requirement-evidence

This writes `test-results/requirements/executed-traceability.json` with per-target
and per-case outcomes. It fails for incomplete coverage, missing reports, stale
context, skipped targets or failed targets. `test-all` runs this aggregation last.
Set `TRACEABILITY_COMMIT` consistently for all suites and aggregation (CI uses the
checkout SHA; local runs default to `unknown` and still compare source digests).

GitHub CI uploads native evidence, downloads it in the Executed Requirement
Evidence job, validates the checkout and merges outcomes in Docker. Test Summary
requires both source validation and executed evidence. Branch protection must
require one of these gates or Test Summary to enforce it at merge time; repository
settings are unchanged. Product review is still required to accept the proposed
requirement baseline.
