# Showcase Architecture

Use this document during the `Architect deep dive` and the `AI/operator tour`.
It keeps the flagship platform story grounded in a small set of diagrams rather
than expecting readers to reconstruct the shape from the source tree alone.

## 1. System Map

```mermaid
flowchart LR
  user["User browser"]
  operator["Operator browser"]

  subgraph browser["Browser surfaces"]
    shell["CloudApp shell (Next.js)"]
    openmaps["OpenMaps remote"]
    jira["Jira remote"]
    mlops["MLOps remote"]
    petstore_ui["Petstore remote"]
    chatllm["ChatLLM remote"]
    monitor["AI monitor (Vite/React)"]
  end

  gateway["NGINX gateway"]

  subgraph services["Routed services"]
    cloudapp["CloudApp (Spring Boot)"]
    vehicles["Vehicles API (Spring Boot)"]
    petstore_api["Petstore (Spring Boot)"]
    jiraproxy["Jira proxy (Spring Boot)"]
    ml_api["ML pipeline (Flask)"]
    ai["AI orchestration layer (FastAPI)"]
  end

  subgraph stores["Core stores and platform dependencies"]
    postgres_ml["Postgres ML"]
    mysql["MySQL"]
    postgres["Postgres"]
    mongo["MongoDB"]
    kafka["Kafka"]
    redis["Redis"]
    experiments["MongoDB AB test"]
    chroma["ChromaDB"]
    ollama["Ollama (optional)"]
  end

  user --> shell
  shell -. module federation .-> openmaps
  shell -. module federation .-> jira
  shell -. module federation .-> mlops
  shell -. module federation .-> petstore_ui
  shell -. module federation .-> chatllm
  shell --> gateway

  operator --> monitor
  monitor --> gateway

  gateway --> cloudapp
  gateway --> vehicles
  gateway --> petstore_api
  gateway --> jiraproxy
  gateway --> ml_api
  gateway --> ai

  cloudapp --> postgres
  cloudapp --> mongo
  cloudapp --> kafka
  petstore_api --> mysql
  ml_api --> postgres_ml
  ai --> redis
  ai --> experiments
  ai --> chroma

  chatllm -. local model calls .-> ollama
  jira -. optional AI refinement via remote API .-> ollama
  ai -. chat, tool, and embedding calls .-> ollama
```

What this shows:

- the shell is the primary user entrypoint and loads breadth modules through
  module federation
- the gateway remains the policy boundary for both product and operator traffic
- the Jira integration is split: Jira CRUD goes through the gateway and
  `jiraproxy`, while the Jira remote owns its local Ollama-assisted AI features
- the AI layer is part of the platform spine, not an isolated side project

## 2. Gateway-Routed Request Flow

```mermaid
sequenceDiagram
  participant Browser
  participant Shell as Shell or remote
  participant Gateway as NGINX gateway
  participant Auth as auth_request or admin boundary
  participant Service as Routed service
  participant Store as Service datastore

  Browser->>Shell: Navigate to a feature route
  Shell->>Gateway: Fetch /cloudapp, /vehicles, /jiraproxy, /mlops, or /ai
  Gateway->>Auth: Validate session and route policy
  Auth-->>Gateway: allow or deny

  alt Allowed
    Gateway->>Service: Forward normalized request headers
    Service->>Store: Read or mutate state
    Store-->>Service: Result
    Service-->>Gateway: JSON, SSE, or websocket payload
    Gateway-->>Shell: Routed response
    Shell-->>Browser: Render state
  else Denied
    Gateway-->>Shell: 401, 403, or problem detail
    Shell-->>Browser: Guarded route or error state
  end
```

What this shows:

- browser clients should prefer routed gateway paths over direct service access
- admin and operator boundaries are enforced before UI state is rendered
- the same gateway posture covers ordinary CRUD, browser remotes, and AI flows

## 3. AI / Operator Flow

```mermaid
sequenceDiagram
  participant Operator
  participant Monitor as AI monitor
  participant Gateway as NGINX gateway
  participant Orchestrator as AI orchestration layer
  participant Approval as Approval queue
  participant Knowledge as RAG stores
  participant Services as Routed services
  participant Models as Ollama

  Operator->>Monitor: Open dashboard, tool, or chat workflow
  Monitor->>Gateway: Call /ai or /ai/ws
  Gateway->>Orchestrator: Forward authenticated operator request
  Orchestrator->>Services: Query platform services when a tool step needs data
  Orchestrator->>Knowledge: Ingest or retrieve RAG documents
  Orchestrator->>Models: Run chat, tool, or embedding call

  alt Human approval required
    Orchestrator->>Approval: Create pending approval
    Approval-->>Monitor: Pending action appears in UI
    Operator->>Monitor: Approve or reject
    Monitor->>Gateway: Submit operator decision
    Gateway->>Orchestrator: Forward approval result
  end

  Orchestrator-->>Gateway: Final response, status, or metric
  Gateway-->>Monitor: Routed result
  Monitor-->>Operator: Updated dashboard or transcript
```

What this shows:

- the operator app uses the same gateway discipline as the product shell
- approvals and RAG are first-class flows, not bolted-on demos
- the orchestration layer can reach routed business services without the
  monitor needing direct service credentials

## How To Use These Diagrams

- Use the `System Map` when introducing the repo to an architect or reviewer.
- Use the `Gateway-Routed Request Flow` when explaining why the gateway matters
  even for local development and demos.
- Use the `AI / Operator Flow` when showing how approvals, model selection, and
  routed tools fit into the broader platform story.
