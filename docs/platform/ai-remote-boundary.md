# ChatLLM and Jira AI remote boundary

ChatLLM and Jira remain optional supporting modules. Their browser UIs call
remote-owned adapters through the NGINX gateway. The adapters verify the
CloudApp session themselves, including when called directly on a remote port.
This implements the existing gateway policy and Jira administrator boundary.

## Routes and identity

| Browser path | Remote adapter | Required identity |
| --- | --- | --- |
| `/ai-remotes/chatllm/models` | ChatLLM `/api/models` | Signed-in CloudApp user |
| `/ai-remotes/chatllm/chat` | ChatLLM `/api/chat` | Signed-in CloudApp user |
| `/ai-remotes/jira/models` | Jira `/api/models` | CloudApp administrator |
| `/ai-remotes/jira/chat` | Jira `/api/chat` | CloudApp administrator |

The gateway delegates authentication to CloudApp, strips caller-supplied
internal-service/role headers, and applies the AI rate limiter. The adapter
forwards only Authorization/Cookie to the CloudApp auth-check endpoint, rejects
redirects, and verifies the returned username and administrator role where
required. Missing credentials return 401; insufficient roles return 403;
unavailable or malformed identity verification returns 503. An Origin header
and remote UI visibility do not establish identity. OPTIONS grants only CORS
preflight behavior and does not invoke the provider.

## Configuration and package ownership

- `NEXT_PUBLIC_GATEWAY_BASE_URL` selects the browser gateway at build time;
  local default is `http://localhost:80`. Both standalone and federated remotes
  use gateway paths and include the session cookie.
- `CLOUDAPP_URL` selects the server-side identity service; Compose uses
  `http://cloudapp:8099/cloudapp` (isolated tests use `test-cloudapp`).
- `OLLAMA_URL` selects the server-side provider root. The server appends `/api`;
  the browser never discovers or calls an Ollama host directly.
- `AI_REMOTE_CORS_ALLOWED_ORIGINS` configures the explicit remote allowlist in
  app Compose via `CORS_ALLOWED_ORIGINS`. Same-origin requests are allowed.
  Configure the gateway origin policy too when using a new deployed origin.
- Jira is attached to both frontend and backend networks so it can verify
  identity and reach the configured provider. Test aliases match gateway names.

Browser model discovery, filtering, errors, and URL helpers live in the public
`@portfolio/api-clients` barrel. Identity/provider handlers live only in the
`@portfolio/api-clients/ai-server` subpath; do not import that subpath into UI
code. The architecture check rejects browser provider hosts, Ollama server
configuration, and server-helper imports in these remote pages.

## Bounds, privacy, and degraded behavior

Chat requests are limited to 64 KiB and 64 messages with known roles and a
bounded model identifier. The requested model must exist in the provider
catalog and cannot be an embedding model. Body reading, identity checks,
catalog reads, and reasoning probes have five-second deadlines. Generation
has a 120-second deadline; gateway streaming allows 130 seconds. Disconnect
cancels generation and upstream streaming. Gateway body reception has a
five-second idle timeout and the shared AI rate control returns 429 on excess.

The adapter logs request ID, model, message count, and character count. It does
not log raw prompts, message content, credentials, or provider error text.
Streaming errors return a fixed unavailable message. Catalog/provider failures
return 503. Failed reasoning probes neither enable reasoning nor poison the
bounded support cache; an unsupported model can still provide plain answers.
An unavailable optional provider does not prevent the core showcase from
starting. No AI proposal applies a Jira write automatically; existing explicit
administrator confirmation remains in the Jira UI.

## Verification and replacement provenance

Frontend unit tests exercise model discovery, identity/role/origin denial,
malformed and oversized bodies, body deadlines, SSE chunks, reasoning probes,
response cancellation, and prompt-log privacy with deterministic transports.
The gateway suite exercises the new paths against real CloudApp sessions.
Production builds check both remote adapters and federation output. The
[disposable runtime overlay](../../tests/nginx-gateway/ai-remotes-runtime/compose.yml)
checks built pages, federation entries, identity denial, model discovery and
real SDK streaming through direct/gateway paths; the command is in TESTING.md. Live Jira
or Ollama checks remain opt-in under the existing read-only test authority.

This supersedes the AI remote portion of PR #68, retaining useful source work
from `cb9f13f`, `af536fc`, `5a768d2`, `a99ca14`, and `e1fbcfd` onto main after
#70. It adds direct identity enforcement and request/stream bounds to that
work. Generated `tsconfig.tsbuildinfo` changes from #68 are excluded; future
untracked build-info files are ignored.

Rollback: revert this slice and rebuild the two remotes and gateway together.
Independent review and affected acceptance evidence are required before
promotion; local checks alone do not record human product acceptance.
