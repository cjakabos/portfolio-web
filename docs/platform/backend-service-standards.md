# Backend Service Standards

This document defines the default Spring service/controller pattern for backend
work in this repository. It exists to stop controller behavior from drifting
endpoint by endpoint.

## Default Pattern

1. Controllers stay thin and translate HTTP concerns only.
2. Services own domain validation and business invariants.
3. Services return domain objects or collections, not controller-oriented
   `Optional` or boolean flags, when failure should become an HTTP error.
4. Typed runtime exceptions are the standard way to signal invalid requests or
   missing resources to the shared exception handler.
5. `ProblemDetail` is the standard error shape for Spring HTTP APIs.

## Validation Rules

- Request DTO annotations are allowed for structural validation at the HTTP
  boundary.
- Service methods must still validate domain-specific invariants that are not
  expressible in DTO annotations or that need to hold across call sites.
- Validation failures should throw `RequestValidationException`.

Examples:

- blank item names
- negative prices
- missing mutation fields on partial updates
- blank usernames for order operations

## Error Mapping Rules

- Missing resources should throw `ResourceNotFoundException`.
- Validation failures should map to HTTP `400`.
- Not-found cases should map to HTTP `404`.
- Unexpected exceptions should fall through to the global handler and map to
  HTTP `500`.

The shared mapping lives in
[GlobalExceptionHandler.java](../../backend/cloudapp/src/main/java/com/example/demo/config/GlobalExceptionHandler.java).

## Logging Rules

- Log `info` for successful state-changing operations such as create, update,
  delete, and order submission.
- Log `warn` for invalid input, missing resources, and rejected access
  attempts.
- Log `error` only for unexpected failures handled by the global exception
  layer.

Avoid controller-level duplication of business success logs when the service
already owns the action.

## First Adopted Scope

The first concrete adoption is in the CloudApp item and order flows:

- [ItemService.java](../../backend/cloudapp/src/main/java/com/example/demo/model/service/ItemService.java)
- [OrderService.java](../../backend/cloudapp/src/main/java/com/example/demo/model/service/OrderService.java)
- [ItemController.java](../../backend/cloudapp/src/main/java/com/example/demo/controllers/ItemController.java)
- [OrderController.java](../../backend/cloudapp/src/main/java/com/example/demo/controllers/OrderController.java)

Future Spring controllers should follow this pattern instead of adding new
endpoint-local response-mapping conventions.
