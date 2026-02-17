# Comprehensive Testing Suite — CloudApp Platform

## Architecture Overview

```
tests/
├── backend-integration/
│   ├── cloudapp/
│   │   ├── CloudAppIntegrationTest.java      # User/Item/Cart/Order/Note lifecycle
│   │   └── application-test.properties        # Spring test profile → ephemeral DBs
│   ├── petstore/
│   │   ├── PetstoreIntegrationTest.java       # Customer/Pet/Employee/Schedule CRUD
│   │   └── application-test.properties        # Spring test profile → ephemeral MySQL
│   └── vehicles-api/
│       └── VehiclesApiIntegrationTest.java    # Car CRUD with HATEOAS validation
├── ml-pipeline/
│   ├── conftest.py                            # Fixtures: ephemeral DB, schema, seed data
│   ├── test_app.py                            # Flask API tests (health, ML, validation)
│   └── requirements-test.txt                  # pytest + plugins
├── nginx-gateway/
│   └── test_nginx_gateway.py                  # JWT enforcement, CORS, routing, rate limit
├── cypress-e2e/
│   ├── e2e/
│   │   ├── auth.cy.ts                         # Register → Login → Protected access → Logout
│   │   ├── shop.cy.ts                         # Browse → Cart → Order → History
│   │   ├── chat.cy.ts                         # Create room → Send message → Verify
│   │   ├── mlops.cy.ts                        # Trigger segmentation → Verify charts
│   │   └── module-federation.cy.ts            # All remotes load without error boundary
│   └── support/
│       └── commands.ts                        # Reusable auth & UI helpers
├── frontend-unit/
│   └── hooks/
│       └── hooks.test.tsx                     # useItems, useCart, useLogin with mocked axios
├── docker-compose.test.yml                    # Complete ephemeral test infrastructure
└── README.md                                  # This file

ci/
└── ci-tests.yml                               # GitHub Actions workflow (5 parallel jobs)
```

## Test Coverage Map

| Layer | Service | What's Tested | Runner |
|-------|---------|---------------|--------|
| **Backend API** | CloudApp | User registration/login (JWT), Item CRUD, Cart add/remove/clear, Order submit/history, Note CRUD, Auth enforcement | JUnit 5 + Spring MockMvc + real Postgres/Mongo |
| **Backend API** | Petstore | Customer/Pet/Employee CRUD, Schedule creation, Employee availability search, Relationship integrity | JUnit 5 + Spring MockMvc + real MySQL |
| **Backend API** | Vehicles | Car CRUD lifecycle, HATEOAS links, Health actuator | JUnit 5 + Spring MockMvc + H2 |
| **ML Pipeline** | Flask | `/health` DB connectivity, `/getMLInfo` (sampleSize -2/-1/0/+N), `/addCustomer` (valid/invalid), `/getSegmentationCustomers`, Input validation (type, range, null) | pytest + real Postgres |
| **Gateway** | NGINX | JWT enforcement (401 for unauthenticated), CORS preflight headers, Routing to backends, Rate limiting detection, Security headers | pytest + requests |
| **Frontend Unit** | Hooks | `useItems` (fetch, create, error handling, loading state), Cart API operations, Login/Register API layer | Jest + React Testing Library + axios-mock-adapter |
| **E2E** | Auth | Register with validation → Login → Protected route → Logout | Cypress |
| **E2E** | Shop | Browse items → Create item → Add to cart → Submit order → View history | Cypress |
| **E2E** | Chat | Create room → Join → Send message → Verify display | Cypress |
| **E2E** | MLOps | Trigger segmentation → Verify charts render → Add customer | Cypress |
| **E2E** | MF Remotes | All 7 remotes load without `RemoteErrorBoundary` firing | Cypress |

## Quick Start

### Run Everything (single command)

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Run Individual Layers

```bash
# Backend integration tests (CloudApp)
docker compose -f docker-compose.test.yml up --build test-backend --abort-on-container-exit

# Backend integration tests (Petstore)
docker compose -f docker-compose.test.yml up --build test-backend-petstore --abort-on-container-exit

# ML Pipeline pytest
docker compose -f docker-compose.test.yml up --build test-ml-pipeline --abort-on-container-exit

# NGINX gateway tests
docker compose -f docker-compose.test.yml up --build test-nginx-gateway --abort-on-container-exit

# Cypress E2E
docker compose -f docker-compose.test.yml up --build test-e2e --abort-on-container-exit
```

### Run Frontend Unit Tests (locally, no Docker needed)

```bash
cd frontend/cloudapp-shell
npm install
npm install --save-dev @testing-library/react @testing-library/jest-dom axios-mock-adapter
npx jest --coverage
```

### Cleanup

```bash
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

## Installation Guide

### 1. Backend Integration Tests

Copy the integration test files into the appropriate source trees:

```bash
# CloudApp
cp tests/backend-integration/cloudapp/CloudAppIntegrationTest.java \
   backend/cloudapp/src/test/java/com/example/demo/CloudAppIntegrationTest.java

cp tests/backend-integration/cloudapp/application-test.properties \
   backend/cloudapp/src/test/resources/application-test.properties

# Petstore
cp tests/backend-integration/petstore/PetstoreIntegrationTest.java \
   backend/petstore/src/test/java/com/udacity/jdnd/course3/petstore/PetstoreIntegrationTest.java

cp tests/backend-integration/petstore/application-test.properties \
   backend/petstore/src/test/resources/application-test.properties

# Vehicles API
cp tests/backend-integration/vehicles-api/VehiclesApiIntegrationTest.java \
   backend/vehicles-api/src/test/java/com/udacity/vehicles/VehiclesApiIntegrationTest.java
```

### 2. ML Pipeline Tests

```bash
mkdir -p backend/ml-pipeline/tests
cp tests/ml-pipeline/conftest.py backend/ml-pipeline/tests/
cp tests/ml-pipeline/test_app.py backend/ml-pipeline/tests/
cp tests/ml-pipeline/requirements-test.txt backend/ml-pipeline/tests/
```

### 3. NGINX Gateway Tests

```bash
mkdir -p tests/nginx-gateway
# Already in place — just ensure docker-compose.test.yml references it
```

### 4. Cypress E2E Tests

```bash
cp tests/cypress-e2e/support/commands.ts \
   frontend/cloudapp-shell/cypress/support/commands.ts

cp tests/cypress-e2e/e2e/*.cy.ts \
   frontend/cloudapp-shell/cypress/e2e/
```

### 5. Frontend Unit Tests

```bash
mkdir -p frontend/cloudapp-shell/src/__tests__
cp tests/frontend-unit/hooks/hooks.test.tsx \
   frontend/cloudapp-shell/src/__tests__/hooks.test.tsx
```

### 6. CI Pipeline

```bash
mkdir -p .github/workflows
cp ci/ci-tests.yml .github/workflows/ci-tests.yml
```

### 7. Replace docker-compose.test.yml

```bash
cp tests/docker-compose.test.yml ./docker-compose.test.yml
```

## CI/CD Integration

The GitHub Actions workflow (`ci/ci-tests.yml`) runs 5 parallel jobs:

```
┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  backend-tests      │  │  ml-pipeline-tests │  │  frontend-unit   │
│  (Spring Boot)      │  │  (pytest)          │  │  (Jest)          │
│  ~10 min            │  │  ~5 min            │  │  ~3 min          │
└─────────┬───────────┘  └────────┬───────────┘  └──────────────────┘
          │                       │
          ▼                       ▼
┌──────────────────────────────────────────────┐
│              e2e-tests (Cypress)             │
│              ~15 min                          │
└──────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────┐
│  nginx-gateway-tests │
│  ~5 min              │
└──────────────────────┘
          │
          ▼
┌──────────────────────┐
│   test-summary       │
│   (report to PR)     │
└──────────────────────┘
```

Artifacts collected: JUnit XML reports, Cypress screenshots/videos, frontend coverage report.

## Key Design Decisions

1. **Real databases over mocks**: Integration tests use ephemeral Postgres/MySQL/MongoDB via `tmpfs` — destroyed on teardown, but exercising real SQL/NoSQL drivers.

2. **Test isolation**: Each test method cleans its own data. `@TestInstance(PER_CLASS)` + `@Order` allows ordered flows while `@BeforeEach`/fixtures ensure repeatability.

3. **Layered approach**: Unit tests catch logic bugs fast (~seconds), integration tests catch DB/config issues (~minutes), E2E tests catch UI/workflow regressions (~minutes).

4. **AI orchestration excluded**: Per requirements, the AI orchestration layer tests are deferred. The infrastructure (Redis, ChromaDB, MongoDB for A/B tests) is not started in test compose.
