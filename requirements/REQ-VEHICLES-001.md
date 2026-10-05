---
schema_version: 1
id: REQ-VEHICLES-001
title: Vehicle map and administrator vehicle maintenance
status: proposed
owner: vehicles-and-maps
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-VEHICLES-001 — Vehicle map

## Observed behavior

The OpenMaps module displays vehicles in a list and on an interactive map. The vehicle API enriches listed and individual vehicles with a resolved address and price from its downstream clients. Regular users can view the map; administrator users can add vehicles by selecting a map location and can edit or delete vehicles through the module.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- frontend/remote/openmaps/components/OpenMaps/OpenMaps.tsx — map, list, role-gated controls, and location selection
- frontend/remote/openmaps/hooks/useVehiclesMap.ts — vehicle API operations
- backend/vehicles-api/src/main/java/com/udacity/vehicles/api/CarController.java — vehicle CRUD endpoints
- backend/vehicles-api/src/main/java/com/udacity/vehicles/service/CarService.java — address and price enrichment
- docs/platform/showcase-smoke-paths.md — OpenMaps hero route

## Acceptance scenarios

```gherkin
@REQ-VEHICLES-001
Feature: View and manage vehicles on a map

  @AC-REQ-VEHICLES-001-01
  Scenario: View vehicle locations and details
    Given the vehicle service returns vehicles
    When a user opens OpenMaps
    Then the module shows vehicles in the map and list with location and price details

  @AC-REQ-VEHICLES-001-02
  Scenario: Restrict vehicle changes in the map interface
    Given a regular user and an administrator
    When each user opens the vehicle map
    Then the regular user has read-only access and the administrator can add, edit, and delete vehicles

  @AC-REQ-VEHICLES-001-03
  Scenario: Create a vehicle from a map location
    Given an administrator is viewing the map
    When the administrator selects a map location and saves a valid vehicle
    Then the new vehicle is persisted and appears in the vehicle list and map
```
