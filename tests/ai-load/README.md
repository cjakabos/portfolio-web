# AI Load Test Pack

This directory holds the reproducible synthetic checks for the AI backlog
objectives in [`../../docs/platform/ai-slos-and-dashboards.md`](../../docs/platform/ai-slos-and-dashboards.md).

The scripts are written for `k6` and target the current AI service topology.

## Scripts

| Script | Purpose | Main route(s) |
| --- | --- | --- |
| `orchestration.js` | measures orchestration request latency and success | `/orchestrate`, `/metrics/detailed` |
| `approvals.js` | measures approval creation-to-visibility latency and decision flow | `/approvals/request`, `/approvals/pending`, `/approvals/pending/{id}/decide` |
| `rag-upload.js` | measures synthetic upload success and completion latency | `/rag/documents/upload`, `/rag/documents/upload/status/{job_id}`, `/rag/documents/{doc_id}` |

## Prerequisites

- `k6` installed locally or available via Docker
- the AI orchestration layer reachable directly or through the gateway
- a valid internal service token when the target requires authenticated access

The orchestration and approvals scripts default to the repo test token
`test-internal-token`. Override it for real environments.

## Main Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localhost:8700` | base URL for the AI service; can be direct service or gateway-prefixed |
| `INTERNAL_TOKEN` | `test-internal-token` | internal auth token for governed operator routes |
| `TARGET_VUS` | script-specific | target virtual users for the load profile |
| `WARMUP_DURATION` | script-specific | warmup stage duration |
| `SUSTAIN_DURATION` | script-specific | steady-state stage duration |
| `COOLDOWN_DURATION` | script-specific | cooldown stage duration |
| `POLL_INTERVAL_SECONDS` | `2` | poll interval for approval and RAG completion checks |
| `MAX_POLL_ATTEMPTS` | `30` | max status polls before a synthetic flow is treated as failed |

## Example Commands

Direct AI service:

```bash
k6 run tests/ai-load/orchestration.js
k6 run tests/ai-load/approvals.js
k6 run tests/ai-load/rag-upload.js
```

Gateway-routed AI service:

```bash
k6 run -e AI_BASE_URL=http://localhost/ai tests/ai-load/orchestration.js
k6 run -e AI_BASE_URL=http://localhost/ai -e INTERNAL_TOKEN=nightly-internal-token tests/ai-load/approvals.js
k6 run -e AI_BASE_URL=http://localhost/ai tests/ai-load/rag-upload.js
```

Docker-based execution:

```bash
docker run --rm -i \
  -v "$PWD:/work" \
  -w /work \
  grafana/k6:latest \
  run tests/ai-load/orchestration.js
```

## Interpretation

- `orchestration.js` is the main synthetic for orchestration latency and error
  rate.
- `approvals.js` is the main synthetic for approval visibility and operator
  control-plane responsiveness.
- `rag-upload.js` is the main synthetic for RAG ingestion success and
  completion latency.

If a script regresses, update both the script and the matching SLO document in
the same PR.
