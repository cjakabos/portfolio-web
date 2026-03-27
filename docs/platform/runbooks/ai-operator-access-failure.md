# AI Runbook: Operator Access Failure

Use this runbook when the AI monitor cannot load or admin-only actions fail
before they reach business logic.

## Trigger

- the monitor loops on sign-in or refresh
- approvals, user management, or observability calls return `401` or `403`
- admin WebSocket routes disconnect immediately
- the browser cannot reach `/ai/*` or `/cloudapp-admin/*` through the gateway

## Likely Causes

- CloudApp admin auth-check is failing
- the gateway route or upstream mapping changed
- session cookies are missing, expired, or not forwarded
- the user has a valid CloudApp session but not `ROLE_ADMIN`

## Immediate Checks

1. From the browser or an HTTP client, call:
   - `/cloudapp-admin/user/admin/auth-check`
   - `/ai/approvals/pending`
2. Confirm whether the failure is:
   - authentication required
   - admin access required
   - upstream unavailable
3. Check gateway logs for:
   - auth-check upstream failures
   - route mismatches
   - WebSocket upgrade failures
4. Verify the current operator account still has the expected admin role.

## Containment

1. Avoid debugging AI internals until gateway and auth checks pass.
2. If only one operator account is affected, validate the role assignment in
   CloudApp before treating the incident as platform-wide.
3. If admin auth is broadly broken, stop using the monitor for write actions and
   move incident coordination outside the UI.

## Recovery

1. Restore the gateway route or upstream auth dependency.
2. Re-authenticate with a confirmed admin user.
3. Re-test:
   - `/cloudapp-admin/user/admin/auth-check`
   - `/ai/approvals/pending`
   - the approvals WebSocket
4. Confirm one read-only dashboard and one write-capable operator action work
   again.

## Escalate When

- admin auth-check fails while CloudApp itself is healthy
- WebSocket upgrades fail only on admin AI routes
- the monitor can read data but all write actions still return `403`

## Aftercare

- record whether the fault was identity, gateway routing, or upstream AI
  availability
- include the exact failing route and HTTP status in the incident note
- if roles changed unexpectedly, audit the corresponding admin user updates
