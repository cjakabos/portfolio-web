# Showcase Reset And Recovery

Use this runbook when the local flagship platform is in an unknown or broken
state and you need to get back to the supported demo baseline quickly.

## 1. Reset To The Known-Good Demo Baseline

Portfolio path:

```bash
./scripts/showcase-reset.sh --mode portfolio
```

Extended path:

```bash
./scripts/showcase-reset.sh --mode extended
```

AI/operator path:

```bash
./scripts/showcase-reset.sh --mode ai-operator
```

What the script does:

- ensures `.env` exists and JWT keys are configured
- enables seeded demo users
- sets deterministic admin and regular demo credentials
- tears down app, infrastructure, and test compose stacks
- removes stale Playwright auth state

## 2. Re-Run The Supported Preflight

```bash
./scripts/showcase-preflight.sh --mode portfolio
```

If you are running a broader tour, use `extended` or `ai-operator` instead.

## 3. Start The Stack Again

Portfolio setup:

```bash
./scripts/showcase-up.sh --mode portfolio
```

Extended or AI/operator setup:

```bash
./scripts/showcase-up.sh --mode extended
./scripts/showcase-up.sh --mode ai-operator
```

## 4. Common Recovery Scenarios

### Gateway or shell will not start

- run the reset script again
- check that ports `80`, `443`, and `5001` are available
- verify the JWT key paths still exist in `.env`

### Demo users are missing

- confirm `CLOUDAPP_SEED_DEMO_USERS_ENABLED=true` in `.env`
- rerun `./scripts/showcase-reset.sh --force-demo-users`
- restart the app stack after the reset

### AI/operator tour is partially unavailable

- rerun `./scripts/showcase-preflight.sh --mode ai-operator`
- confirm whether Ollama and Jira credentials are configured
- if optional integrations are unavailable, continue with the degraded AI tour
