---
schema_version: 1
id: REQ-CHAT-001
title: Shared chat rooms and live messaging
status: accepted
owner: cloudapp-product
basis: code-derived-current-behavior
review: requirements/reviews/BASELINE-2026-10-12.md
---

# REQ-CHAT-001 — Community chat

## Product intent

A signed-in user can create a named room and receive a room code, list rooms derived from their message records, and open a room using its code. The current directory does not store a separate membership record: it finds rooms by messages whose sender matches the username. Room messages are sent over the CloudApp WebSocket/STOMP path and broadcast to the room topic. The message service also publishes each sent message to Kafka and stores a message record. The room page reports connection state and disables sending while disconnected.

The repository owner accepted this behavior for the local portfolio showcase.
The [human decision](reviews/BASELINE-2026-10-12.md) records the scope and demo
limits; implementation evidence remains as provenance.

## Evidence

- frontend/cloudapp-shell/src/pages/chat/index.tsx — create, list, and join room flow
- frontend/cloudapp-shell/src/pages/chat/rooms/[roomId].tsx — live room interaction
- backend/cloudapp/src/main/java/com/example/demo/controllers/RoomController.java — room endpoints
- backend/cloudapp/src/main/java/com/example/demo/controllers/MessageController.java — WebSocket message routes
- backend/cloudapp/src/main/java/com/example/demo/collaboration/MessageService.java — Kafka publication and persistence
- e2e/chat.spec.ts — create, join, and live connection behavior

## Acceptance scenarios

```gherkin
@REQ-CHAT-001
Feature: Join chat rooms and exchange live messages

  @AC-REQ-CHAT-001-01
  Scenario: Create a room and open it using its code
    Given an authenticated user
    When the user creates a room with a name
    Then the room has a code and the room page opens for that code

  @AC-REQ-CHAT-001-02
  Scenario: Join a room by its code
    Given an existing room code
    When an authenticated user joins the room
    Then the room page opens for that code

  @AC-REQ-CHAT-001-03
  Scenario: Send a message over a live connection
    Given a user is connected to a room's live WebSocket channel
    When the user sends a message
    Then it is broadcast to the room topic and the sender can see its sender and content

  @AC-REQ-CHAT-001-04
  Scenario: Prevent sending while disconnected
    Given the room WebSocket is disconnected
    When the room page is in its reconnecting state
    Then message sending is disabled until the live connection is available
```
