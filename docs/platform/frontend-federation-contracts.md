# Frontend Federation Contracts

This document captures the typed browser-surface contracts between the
CloudApp shell and its module-federated remotes. The goal is to make the
flagship showcase readable in code review and resilient to drift without
relying on `@ts-ignore` imports.

## Shell-to-Remote Map

| Shell route | Remote key | Remote app | Exposed module | Default export |
| --- | --- | --- | --- | --- |
| `/maps` | `remote` | `openmaps` | `remote/openmaps` | OpenMaps page component |
| `/jira` | `remote2` | `jira` | `remote2/jira` | Jira page component |
| `/chatllm` | `remote3` | `chatllm` | `remote3/chatllm` | ChatLLM page component |
| `/mlops` | `remote4` | `mlops` | `remote4/mlops` | MLOps page component |
| `/petstore/*` | `remote5` | `petstore` | `remote5/petstore` | PetStore app component |

## Review Rules

- Changes to a remote exposure in a remote `next.config.js` must be reflected
  in the shell ambient module declarations.
- Shell route pages should load remotes through the shared remote-loader helper
  so the federation boundary stays typed and reviewable.
- Route-level auth or admin gating still belongs in the shell pages; the typed
  contract only defines the federated component shape.
