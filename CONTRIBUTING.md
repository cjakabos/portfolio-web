# Contributing

Thank you for contributing.

## Before You Start

- Read [README.md](./README.md), including testing

- Check existing issues to avoid duplicate work

## Local Setup

```bash
cp env.example .env
./scripts/setup-env-jwt-keys.sh
```

Start lean stack:

```bash
docker compose -f docker-compose-infrastructure.yml up -d postgres postgres-ml mysql mongo zookeeper broker
docker compose -f docker-compose-app.yml up -d
```

## Branch and PR Flow

1. Fork the repo
2. Create a focused branch
3. Make small, reviewable commits
4. Open a PR with clear scope and test evidence

## What To Include In A PR

- Problem statement and proposed change
- Risk notes (behavioral changes, migration impact)
- Test evidence (`docker compose ...`, screenshots, or logs)
- Docs updates for user-facing behavior changes

## Test Expectations

Run the smallest test scope that validates your change.

Examples:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-ai-orchestration-layer
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-nginx-gateway
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-e2e
```

For broad refactors, run full test-all:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test-all
```

## Reporting Issues

Use GitHub Issues:
- Bug reports: include reproduction steps and logs
- Feature requests: include user story and acceptance criteria

For security issues, follow [SECURITY.md](./SECURITY.md).
