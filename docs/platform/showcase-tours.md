# Official Showcase Tours

This document defines the intended walkthroughs for the flagship platform.

Reference material:
- use `showcase-architecture.md` for the diagrams behind the architect and AI
  tours
- use `showcase-evidence-pack.md` for the curated screenshot set
- use `showcase-smoke-paths.md` when you need to explain automated coverage

## 1. 10-Minute Demo

Audience:
- first-time readers
- recruiters
- hiring managers

Goal:
- reach a strong first impression quickly

Recommended path:
1. Open the CloudApp shell and show the shared dashboard.
2. Log in with a demo user and show notes/files or shop.
3. Open chat or maps to show a second core journey.
4. End with one AI or admin moment such as ChatLLM, Jira AI refinement, or the
   AI monitor landing page.

Must-work surfaces:
- CloudApp shell
- gateway-routed auth
- CloudApp backend
- at least one supporting module

## 2. Architect Deep Dive

Audience:
- engineers
- architects
- technical interviewers

Goal:
- explain how the platform is composed and governed

Recommended path:
1. Show the shell, gateway, remotes, and operator app inventory.
2. Explain gateway ownership and routed browser access.
3. Explain shared auth, generated contracts, and workspace packages.
4. Explain backend and AI runtime boundaries.
5. Finish with CI, test composition, and governance docs.

Must-cover topics:
- module federation
- gateway policy boundary
- contracts and generated clients
- runtime/store policy
- CI and docs drift enforcement

## 3. AI / Operator Tour

Audience:
- AI engineers
- platform engineers
- operators

Goal:
- spotlight the differentiating AI capabilities

Recommended path:
1. Open the AI orchestration monitor.
2. Show health, services, and model selection.
3. Show approvals or RAG flows.
4. Explain degraded mode, operator safeguards, and orchestration boundaries.
5. Close by relating the AI layer back to the routed services and gateway.

Must-work surfaces:
- AI orchestration layer
- AI monitor
- at least one observability or approval path
- degraded-mode documentation

## Tour Rules

- `10-minute demo` is the primary default path for new readers.
- `Architect deep dive` should reference diagrams and governance docs.
- `AI/operator tour` should be runnable even when optional integrations such as
  Jira are unavailable.
- Hero paths should not depend on optional modules unless the tour explicitly
  says so.
