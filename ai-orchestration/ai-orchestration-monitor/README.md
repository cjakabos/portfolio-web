# AI Orchestration Monitor

Operator-facing React/Vite application for the AI orchestration layer. It
surfaces system health, approvals, tools, RAG activity, service explorers, and
real-time orchestration monitoring.

## Local development

Prerequisites:

- Node.js 22+
- The platform gateway and AI orchestration services running locally

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5010`.

## Environment

The monitor reads standard Vite variables. If you need non-default endpoints,
set them in a local ignored `.env.local` file:

```bash
VITE_API_URL=http://localhost:80
VITE_AI_BASE_URL=http://localhost:80/ai
VITE_AI_WS_URL=ws://localhost:80/ai
VITE_REQUEST_TIMEOUT=15000
```

If these variables are omitted, the app falls back to the local gateway
defaults baked into the client services.

The monitor uses a single canonical client surface in
`services/orchestrationClient.ts`. Approval and RAG traffic are no longer
managed by separate app-local clients.

For the operator boundary and route classification, see
[`../../docs/platform/ai-monitor-boundary.md`](../../docs/platform/ai-monitor-boundary.md).

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```
