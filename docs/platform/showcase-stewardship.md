# Showcase Stewardship

Use this document to decide how the flagship platform grows without turning
breadth into noise. The goal is not to freeze the repo. The goal is to make
every module, tour, and visual earn its place in the story.

## Intake Questions

Answer these before adding a module, promoting a tier, or changing a tour:

1. What new capability does this demonstrate?
2. Which official tour does it strengthen: `10-minute demo`, `Architect deep
   dive`, or `AI/operator tour`?
3. Which showcase tier should own it: `Hero`, `Supporting`, `Optional`, or
   `Operator tooling`?
4. Which owner role is accountable for it in `deployable-inventory.md`?
5. Which smoke path proves it is demo-ready?
6. Does it add setup or runtime requirements, and if so can those remain
   outside the default `Hero setup`?

If a proposed change cannot answer question 1 clearly, it should usually be
cut, narrowed, or kept as internal scaffolding.

## Tier Expectations

| Tier | When to use it | Minimum proof | Review cadence |
| --- | --- | --- | --- |
| `Hero` | Platform spine or first-impression differentiator | explicit owner, official tour placement, `Core showcase` smoke coverage, evidence in the screenshot pack | every release pass plus quarterly curation |
| `Supporting` | Adds breadth that strengthens the flagship story | linked tour value, `Extended showcase` or targeted smoke path, no dependency from the default hero path | quarterly keep/refresh/archive review |
| `Optional` | Interesting extra depth that should never block the main story | isolated setup, targeted verification, clear scope, easy to skip in demos | quarterly keep or archive decision |
| `Operator tooling` | Operates or governs the platform instead of serving end users directly | runbook alignment, operator tour placement, operator smoke path, explicit owner | quarterly review and after operator workflow changes |
| `Template / scaffold` | Accelerator or reference pattern for future work | clearly labeled as non-showcase and not advertised as a live tour surface | review only when adopted or repurposed |

## Promotion Rules

### Promote To `Hero` Only When All Are True

- it demonstrates a core architectural idea or differentiator for the repo
- it fits naturally into the `10-minute demo` or `Architect deep dive`
- it works from the supported setup contract without bespoke rescue steps
- it has a documented owner and a matching `Core showcase` smoke path
- it is represented in the README, tours, and evidence pack

### Keep A Module `Supporting` When

- it adds breadth or integration depth after the hero story is already clear
- it has a distinct reason to exist beyond “another screen”
- it can break without invalidating the default hero tour

### Keep A Module `Optional` When

- it demonstrates useful range but not core differentiation
- the setup cost or maintenance burden is higher than hero/supporting modules
- the right user experience is “nice to show if time allows”

### Keep A Surface As `Operator tooling` When

- the main user is an operator or platform engineer
- it depends on runbooks, degraded-mode behavior, or privileged actions
- it should not be treated as part of the public product shell

## Review Cadence

### Every PR

- identify the affected showcase tier
- note whether any official tour, setup path, or evidence asset changed
- keep the matching smoke path green before calling the branch demo-ready

### Quarterly Hero Review

- confirm the hero list still matches the README-first story
- verify owners, screenshots, and smoke paths are still current
- remove or demote hero candidates that no longer feel distinctive

### Quarterly Supporting And Optional Review

- decide `keep`, `refresh`, or `archive`
- refresh modules whose value is still real but whose docs or visuals drifted
- archive modules that no longer demonstrate a distinct capability

### Quarterly Operator Review

- confirm operator actions still match runbooks and degraded-mode docs
- verify approvals, RAG, and observability flows still justify dedicated UI

## Required Docs When The Showcase Story Changes

Update the relevant subset of these documents whenever a change affects what a
reader sees, runs, or believes about the platform:

- `README.md`
- `docs/platform/showcase-taxonomy.md`
- `docs/platform/showcase-tours.md`
- `docs/platform/showcase-smoke-paths.md`
- `docs/platform/showcase-evidence-pack.md`
- `docs/platform/deployable-inventory.md`

## Stewardship Outcomes

- `Keep`: the module still demonstrates a distinct capability and stays healthy
  enough to show confidently
- `Refresh`: the capability still matters, but setup, docs, screenshots, or
  smoke coverage drifted
- `Archive`: the module no longer earns the maintenance or attention it costs
