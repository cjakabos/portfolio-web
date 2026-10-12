---
schema_version: 1
id: REQ-PETSTORE-001
title: Petstore customer, pet, employee, and schedule workflows
status: accepted
owner: petstore-module
basis: code-derived-current-behavior
review: requirements/reviews/REMAINING-2026-10-12.md
---

# REQ-PETSTORE-001 — Petstore domain workflows

## Product intent

The PetStore remote is exposed as an administrator-only module. Its service API supports customer and pet records, employee records and availability, and schedules that associate dates, activities, pets, and employees. Schedule data can be listed or queried by pet, employee, or customer.

The repository owner accepted this behavior for the local portfolio showcase.
See [the human decision](reviews/REMAINING-2026-10-12.md) for scope and limits.

## Evidence

- frontend/remote/petstore/pages/index.tsx and frontend/remote/petstore/pages/petstore/[[...slug]].tsx — remote entry and pages
- backend/petstore/src/main/java/com/udacity/jdnd/course3/petstore/user/UserController.java — customer and employee operations
- backend/petstore/src/main/java/com/udacity/jdnd/course3/petstore/pet/PetController.java — pet operations and owner association
- backend/petstore/src/main/java/com/udacity/jdnd/course3/petstore/schedule/ScheduleController.java — schedule operations and queries
- frontend/cloudapp-shell/src/constants/routes.tsx — administrator-only route

## Acceptance scenarios

```gherkin
@REQ-PETSTORE-001
Feature: Manage pet care records and schedules

  @AC-REQ-PETSTORE-001-01
  Scenario: Associate a pet with its customer
    Given a customer exists
    When a pet is created or updated with that customer's owner identifier
    Then the pet record is associated with the customer and is available in owner queries

  @AC-REQ-PETSTORE-001-02
  Scenario: Track employee service skills and availability
    Given employees have service skills and availability
    When the administrator requests employees for a service
    Then the service returns matching employee records

  @AC-REQ-PETSTORE-001-03
  Scenario: Create and query a pet care schedule
    Given pets and employees exist
    When a schedule is created with a date, activities, pet identifiers, and employee identifiers
    Then the schedule is saved and can be queried by pet, employee, or customer
```
