---
schema_version: 1
id: REQ-MLOPS-001
title: Customer segmentation workflow and results
status: accepted
owner: mlops-module
basis: code-derived-current-behavior
review: requirements/reviews/ACCESS-2026-10-12.md
---

# REQ-MLOPS-001 — Customer segmentation

## Product intent

The MLOps module and its data/job APIs are administrator-only. It supports selecting a sample size to initialize or rerun segmentation, adding a customer record and reclustering, and viewing customer records alongside segmentation visualizations. The backend validates sampleSize as an integer from -2 through 10,000, supports read-only retrieval at -2, and reruns segmentation for the add-customer mode at -1. The module includes spending distribution and cluster views.

Both the gateway and Flask service verify administrator access. The service
checks the caller's bearer token or session cookie with CloudApp's administrator
auth endpoint before customer data access or segmentation work. Requests without
credentials receive 401 at the service; the gateway rejects unauthenticated
callers with 401 or 403. Regular users receive 403. Caller-supplied role/user
headers or internal service tokens cannot grant administrator access; identity
verification failures fail closed. Health checks and preflight remain available.

The repository owner approved this operator policy in the
[human decision](reviews/ACCESS-2026-10-12.md), scoped to the local showcase.

## Evidence

- frontend/remote/mlops/pages/index.tsx — customer form, sampling controls, charts, and paginated table
- backend/ml-pipeline/src/app.py — customer API and sampleSize control flow
- backend/ml-pipeline/src/access_control.py — CloudApp administrator verification
- frontend/nginx/conf/locations.conf — administrator-only gateway path
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

  @AC-REQ-MLOPS-001-04
  Scenario: Reject callers without administrator authority before ML work
    Given an unauthenticated caller or an authenticated regular user
    When the caller requests customer results, customer creation, or segmentation through the service API
    Then the unauthenticated caller receives 401 and the regular user receives 403
    And no customer data operation or segmentation job executes
```
