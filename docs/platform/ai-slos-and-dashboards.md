# AI SLOs And Dashboards

This document defines the first operating objectives for the AI stack on the
current branch. It stays scoped to the current deployable topology while
browser-surface reduction remains deferred.

## Measurement Posture

The repo does not yet have a centralized production metrics backend checked
into source control. For now, the governed source of truth is:

- live endpoint data from `ai-orchestration-layer`
- synthetic load tests in [`../../tests/ai-load/README.md`](../../tests/ai-load/README.md)
- the AI monitor dashboards that already read the same backend routes

That means the SLOs below are intentionally tied to current endpoint-backed
signals rather than Prometheus-only queries that the repo does not actually
operate yet.

## Service Objectives

| Capability | SLI | Target | Measurement source | Notes |
| --- | --- | --- | --- | --- |
| Orchestration latency | p95 request latency for `POST /ai/orchestrate` | p95 `< 2500 ms` in steady state windows | `/ai/metrics/detailed?hours=1`, `tests/ai-load/orchestration.js` | Applies to the current conversational/operator orchestration path |
| Orchestration success | failed request ratio for orchestrations | error rate `< 2%` | `/ai/metrics/detailed?hours=1`, `tests/ai-load/orchestration.js` | Excludes planned degraded windows where the orchestrator is intentionally offline |
| Approval visibility | time from `POST /ai/approvals/request` to visibility in `/ai/approvals/pending` | p95 `< 5 s`, success rate `>= 99%` | `tests/ai-load/approvals.js`, `/ai/approvals/health` | Visibility matters more than raw queue depth for operator response time |
| RAG upload success | successful completion of synthetic upload jobs | `>= 95%` completion for the fixture workload | `tests/ai-load/rag-upload.js`, `/ai/rag/health` | Current baseline is for the checked-in text fixture and small manual uploads |
| RAG upload latency | time from upload acceptance to `completed` | p95 `< 180 s` for the synthetic fixture | `tests/ai-load/rag-upload.js` | This is intentionally loose until the embedding path is better characterized |
| Operator access | admin auth and routed monitor access | no sustained `401` / `403` regressions in steady state | monitor behavior tests, gateway logs, `/cloudapp-admin/user/admin/auth-check` | Treated as release-critical even though it is not a numeric SLO today |

## Dashboard Queries

Use these endpoint-backed queries as the minimum dashboard pack for the AI
stack.

### Orchestration summary

```bash
curl -s http://localhost:8700/metrics | jq '{totalRequests, successRate, avgLatency, activeOrchestrations}'
curl -s 'http://localhost:8700/metrics/detailed?hours=1' | jq '{avg_latency_ms, error_rate, requests_per_minute, latency_percentiles}'
```

Recommended panels:

- request volume and requests per minute
- avg latency and p95 latency
- success rate and error rate
- active orchestrations
- orchestration type distribution

### Approval control plane

```bash
curl -s http://localhost:8700/approvals/health | jq '{storage, pending_count, orchestrator_available, hitl_manager_available}'
curl -s http://localhost:8700/approvals/stats -H 'X-Internal-Auth: test-internal-token' | jq
```

Recommended panels:

- approval storage backend (`redis` versus `memory`)
- pending approval count
- approval visibility latency from the synthetic load test
- approval success rate from the synthetic load test

### RAG ingestion

```bash
curl -s http://localhost:8700/rag/health | jq '{status, initialized, total_documents, total_chunks, embedding_model}'
curl -s http://localhost:8700/rag/stats | jq '{total_documents, total_chunks, documents_by_type}'
```

Recommended panels:

- RAG health status
- total indexed documents and chunks
- upload completion rate from the synthetic load test
- upload completion latency from the synthetic load test

### Admin access and operator path

```bash
curl -i http://localhost/cloudapp-admin/user/admin/auth-check
curl -i http://localhost/ai/approvals/pending
```

Recommended panels:

- auth-check status
- monitor route availability
- admin WebSocket connection failures from browser/test logs

## Alert Guidance

Alert when any of the following remain true for more than one review window:

1. orchestration error rate exceeds `2%`
2. orchestration p95 exceeds `2500 ms`
3. approvals health reports `storage: memory` unexpectedly
4. approval visibility synthetic checks fall below `99%`
5. RAG health is `unhealthy`
6. operator access checks regress with repeated `401`, `403`, or upstream auth
   failures

## Load-Test Sources

The repo-backed synthetic checks live in:

- [`../../tests/ai-load/orchestration.js`](../../tests/ai-load/orchestration.js)
- [`../../tests/ai-load/approvals.js`](../../tests/ai-load/approvals.js)
- [`../../tests/ai-load/rag-upload.js`](../../tests/ai-load/rag-upload.js)

Treat those scripts as the governed synthetic baseline for the objectives above.

## Review Rules

1. If the route shape changes, update the SLO document and the matching load
   test in the same PR.
2. If an objective changes, explain whether the change reflects real system
   improvement, a temporary downgrade, or a measurement change.
3. Do not add dashboard queries that depend on infrastructure the repo does not
   actually provision today without marking them as future-state only.
