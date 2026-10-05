---
id: REQ-IDENTITY-001
title: User registration, sessions, and role-based access
status: proposed
owner: cloudapp-backend
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-IDENTITY-001 — User identity and access

## Observed behavior

A person can register with a unique username, matching password confirmation, and a password of at least eight characters. Public registration assigns the regular-user role and creates a cart; it does not grant administrator access. Successful login issues the CloudApp authentication cookie, logout clears it, and protected pages require an authenticated session. Administrator routes and item mutations are restricted by the backend's role checks.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- backend/cloudapp/src/main/java/com/example/demo/controllers/UserController.java — registration, login, logout, and auth checks
- backend/cloudapp/src/main/java/com/example/demo/security/WebSecurityConfiguration.java — public, authenticated, and administrator route rules
- backend/cloudapp/src/main/java/com/example/demo/security/CloudappAccessPolicy.java — user-owned resource access
- frontend/cloudapp-shell/src/hooks/useAuth.ts and frontend/cloudapp-shell/src/components/Layout.tsx — session-aware shell and logout
- e2e/auth.spec.ts — registration, login, protected route, and role coverage

## Acceptance scenarios

```gherkin
@REQ-IDENTITY-001
Feature: Authenticate users and enforce application roles

  @AC-REQ-IDENTITY-001-01
  Scenario: Register a regular user with valid credentials
    Given a username that is not already registered
    And a password of at least eight characters with matching confirmation
    When the person submits public registration
    Then the account is created with the regular-user role and an associated cart

  @AC-REQ-IDENTITY-001-02
  Scenario: Reject invalid or duplicate registration
    Given a duplicate username, a short password, or mismatched password confirmation
    When the person submits public registration
    Then the account is not created

  @AC-REQ-IDENTITY-001-03
  Scenario: Establish and clear an authenticated session
    Given a registered user
    When the user logs in with valid credentials and later logs out
    Then login establishes the CloudApp authentication cookie and logout clears it

  @AC-REQ-IDENTITY-001-04
  Scenario: Restrict administrator operations
    Given an authenticated regular user
    When the user requests an administrator route or item mutation
    Then the backend denies the operation
```
