---
id: REQ-COMMERCE-001
title: Product catalog, personal cart, and order history
status: proposed
owner: cloudapp-product
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-COMMERCE-001 — Shop and order flows

## Observed behavior

An authenticated user can browse the shared item catalog, add and remove items in their own cart, clear that cart, submit checkout, and view their order history. Checkout records an order from the cart; the shell then clears the cart and refreshes order history. The backend scopes cart and order operations to the authenticated user. Administrator users can create, update, and delete catalog items; regular users cannot perform those item mutations.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- frontend/cloudapp-shell/src/pages/shop/index.tsx — catalog, cart, order tabs, and administrator item form
- frontend/cloudapp-shell/src/hooks/useCart.ts — cart and checkout requests
- backend/cloudapp/src/main/java/com/example/demo/controllers/CartController.java — user-scoped cart operations
- backend/cloudapp/src/main/java/com/example/demo/controllers/OrderController.java — user-scoped checkout and history
- backend/cloudapp/src/main/java/com/example/demo/commerce/OrderService.java — order snapshot creation
- backend/cloudapp/src/main/java/com/example/demo/security/WebSecurityConfiguration.java — administrator-only catalog mutations
- e2e/shop.spec.ts — shop journey coverage

## Acceptance scenarios

```gherkin
@REQ-COMMERCE-001
Feature: Shop for items and manage orders

  @AC-REQ-COMMERCE-001-01
  Scenario: Add catalog items to a personal cart
    Given an authenticated user and an item in the catalog
    When the user adds that item to the cart or clears the cart
    Then only that user's cart is changed and its displayed contents and total are refreshed

  @AC-REQ-COMMERCE-001-02
  Scenario: Submit checkout and view the resulting order
    Given an authenticated user with items in their cart
    When the user checks out
    Then an order is recorded from the cart contents, the shell clears the cart, and order history is refreshed

  @AC-REQ-COMMERCE-001-03
  Scenario: Restrict catalog maintenance to administrators
    Given a regular user and an administrator
    When each user attempts to create, update, or delete a catalog item
    Then the administrator can perform the mutation and the regular user is denied
```
