---
schema_version: 1
id: REQ-CHATLLM-001
title: Local model chat with streamed responses
status: accepted
owner: chatllm-module
basis: code-derived-current-behavior
review: requirements/reviews/REMAINING-2026-10-12.md
---

# REQ-CHATLLM-001 — Local model chat

## Product intent

The ChatLLM remote obtains available model names from the configured local Ollama service, lets the user choose a model, and streams chat responses through the module's API route. The adapter probes whether a model supports reasoning output and includes that output when supported. Changing the selected model clears the current conversation.

The repository owner accepted this behavior for the local portfolio showcase.
See [the human decision](reviews/REMAINING-2026-10-12.md) for scope and limits.

## Evidence

- frontend/remote/chatllm/pages/index.tsx — model selection and conversation UI
- frontend/remote/chatllm/pages/api/chat.ts — Ollama request conversion and streamed response
- frontend/cloudapp-shell/src/constants/routes.tsx — ChatLLM shell route
- e2e/nightly-chatllm-ollama.spec.ts — optional live model integration coverage

## Acceptance scenarios

```gherkin
@REQ-CHATLLM-001
Feature: Chat with a selected local language model

  @AC-REQ-CHATLLM-001-01
  Scenario: Select an available model and receive a streamed answer
    Given the local Ollama service exposes available models
    When a user selects a model and sends a chat message
    Then the response is streamed into the conversation using that model

  @AC-REQ-CHATLLM-001-02
  Scenario: Clear the conversation after changing models
    Given a conversation exists with one selected model
    When the user changes to a different model
    Then the prior conversation is cleared before continuing with the new model

  @AC-REQ-CHATLLM-001-03
  Scenario: Show reasoning only when the model supports it
    Given a selected model may or may not support reasoning output
    When the chat adapter probes model support and handles the response
    Then reasoning output is included only when the adapter determines it is supported
```
