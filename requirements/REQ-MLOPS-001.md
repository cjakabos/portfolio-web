---
id: REQ-MLOPS-001
title: Customer segmentation workflow and results
status: proposed
owner: mlops-module
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-MLOPS-001 — Customer segmentation

## Observed behavior

The MLOps module is marked administrator-only in shell navigation. It supports selecting a sample size to initialize or rerun segmentation, adding a customer record and reclustering, and viewing customer records alongside segmentation visualizations. The backend validates sampleSize as an integer from -2 through 10,000, supports read-only retrieval at -2, and reruns segmentation for the add-customer mode at -1. The module includes spending distribution and cluster views. The Flask routes shown do not perform role checks themselves, so direct API protection depends on deployment ingress configuration.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- frontend/remote/mlops/pages/index.tsx — customer form, sampling controls, charts, and paginated table
- backend/ml-pipeline/src/app.py — customer API and sampleSize control flow
- backend/ml-pipeline/src/segmentation_process.py — segmentation pipeline
- frontend/cloudapp-shell/src/constants/routes.tsx — administrator-only route
- e2e/mlops.spec.ts — sampling, chart, and customer-entry flows

## Acceptance scenarios

```gherkin
@REQ-MLOPS-001
Feature: Run and inspect customer segmentation

  @AC-REQ-MLOPS-001-01
  Scenario: Run segmentation for a selected sample
    Given an administrator is viewing the MLOps module
    When the administrator selects a supported sample size and runs sampling
    Then the service initializes the dataset, runs segmentation, and returns results for the module's charts

  @AC-REQ-MLOPS-001-02
  Scenario: Add a customer and recluster
    Given an administrator has entered customer attributes in the MLOps form
    When the administrator chooses Add and Re-Cluster
    Then the customer is submitted and the segmentation results are refreshed

  @AC-REQ-MLOPS-001-03
  Scenario: Inspect chart and customer results
    Given segmentation results and customer records are available
    When the administrator opens chart views or the customer table
    Then the module displays spending and cluster visualizations and paginated customer rows
```
