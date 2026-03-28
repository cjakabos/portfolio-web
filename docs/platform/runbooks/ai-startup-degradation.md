# AI Runbook: Startup Degradation

Use this runbook when the AI orchestration service starts, but core capability
surfaces are partially unavailable.

## Trigger

- `POST /ai/orchestrate` returns `503`
- `GET /ai/system/feature-status` returns `503`
- the monitor chat panel loads, but requests fail immediately
- service logs show `server will start in degraded mode` or `Orchestrator unavailable`

## Likely Causes

- Ollama is offline or unreachable
- orchestrator initialization failed during startup
- a required AI dependency timed out during service boot

## Immediate Checks

1. Check service logs for orchestrator startup warnings.
2. Call `GET /ai/approvals/health` and confirm whether
   `orchestrator_available` is `false`.
3. Call `GET /ai/rag/health` to see whether the incident is orchestration-only
   or broader.
4. Verify the model endpoint configured for the AI layer is reachable from the
   running service.

## Containment

1. Announce degraded AI orchestration in the operator channel.
2. Keep the monitor available for health and approval inspection if those
   routes are still healthy.
3. Pause operator workflows that depend on streaming or orchestration resumes
   until the orchestrator is back.

## Recovery

1. Restore Ollama or the configured model endpoint.
2. Restart only the AI orchestration service after the model dependency is
   healthy.
3. Re-check:
   - `POST /ai/orchestrate`
   - `GET /ai/system/feature-status`
   - `GET /ai/approvals/health`
4. Run one monitor chat request and one approval resume smoke test.

## Escalate When

- Ollama is healthy, but orchestrator startup still fails
- the service reports healthy startup while all orchestration routes still
  return `503`
- approvals health also reports the HITL manager as unavailable after restart

## Aftercare

- note whether the service stayed available in a useful degraded mode
- capture the startup log line that caused the degradation
- record whether any pending approvals needed manual re-run after recovery
