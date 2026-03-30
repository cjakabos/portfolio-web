#!/usr/bin/env bash
# ===========================================================================
# showcase-reset.sh — Return the flagship platform to a known-good demo state
#
# Usage:
#   ./scripts/showcase-reset.sh
#   ./scripts/showcase-reset.sh --mode extended
#   ./scripts/showcase-reset.sh --dry-run
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="hero"
ENV_FILE="${PROJECT_ROOT}/.env"
DRY_RUN=0
FORCE_DEMO_USERS=0

DEFAULT_ADMIN_USERNAME="showcaseadmin"
DEFAULT_ADMIN_PASSWORD="ShowcaseAdmin123"
DEFAULT_REGULAR_USERNAME="showcaseuser"
DEFAULT_REGULAR_PASSWORD="ShowcaseUser123"

usage() {
  cat <<'EOF'
Reset the local showcase state to a deterministic demo baseline.

Options:
  --mode <hero|extended|ai-operator>  Output the next-step command for this mode
  --env-file <path>                   Path to env file (default: ./.env)
  --force-demo-users                  Override existing demo-user values in the env file
  --dry-run                           Print the actions without executing them
  -h, --help                          Show this help
EOF
}

run_step() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

run_shell_step() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$1"
    return 0
  fi
  /bin/sh -lc "$1"
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/showcase-reset.XXXXXX")"

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (updated == 0) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

read_env_value() {
  local key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi
  grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true
}

ensure_demo_value() {
  local key="$1"
  local default_value="$2"
  local current_value
  current_value="$(read_env_value "$key")"

  if [ -n "$current_value" ] && [ "$FORCE_DEMO_USERS" -ne 1 ]; then
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] set %s=%s in %s\n' "$key" "$default_value" "$ENV_FILE"
    return 0
  fi

  upsert_env_var "$key" "$default_value" "$ENV_FILE"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      [ $# -ge 2 ] || {
        echo "Missing value for --mode" >&2
        exit 1
      }
      MODE="$2"
      shift 2
      ;;
    --env-file)
      [ $# -ge 2 ] || {
        echo "Missing value for --env-file" >&2
        exit 1
      }
      ENV_FILE="$2"
      shift 2
      ;;
    --force-demo-users)
      FORCE_DEMO_USERS=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$MODE" in
  hero|extended|ai-operator)
    ;;
  *)
    echo "Unsupported mode: $MODE" >&2
    usage >&2
    exit 1
    ;;
esac

printf 'Resetting showcase state for mode: %s\n' "$MODE"

run_step "${PROJECT_ROOT}/scripts/setup-env-jwt-keys.sh" --env-file "$ENV_FILE"

if [ "$DRY_RUN" -ne 1 ] && [ ! -f "$ENV_FILE" ]; then
  echo "Expected env file to exist after setup: $ENV_FILE" >&2
  exit 1
fi

ensure_demo_value "CLOUDAPP_SEED_DEMO_USERS_ENABLED" "true"
ensure_demo_value "CLOUDAPP_SEED_DEMO_USERS_ADMIN_USERNAME" "$DEFAULT_ADMIN_USERNAME"
ensure_demo_value "CLOUDAPP_SEED_DEMO_USERS_ADMIN_PASSWORD" "$DEFAULT_ADMIN_PASSWORD"
ensure_demo_value "CLOUDAPP_SEED_DEMO_USERS_REGULAR_USERNAME" "$DEFAULT_REGULAR_USERNAME"
ensure_demo_value "CLOUDAPP_SEED_DEMO_USERS_REGULAR_PASSWORD" "$DEFAULT_REGULAR_PASSWORD"

run_shell_step "cd '$PROJECT_ROOT' && docker compose -f docker-compose-app.yml down -v --remove-orphans || true"
run_shell_step "cd '$PROJECT_ROOT' && docker compose -f docker-compose-infrastructure.yml down -v --remove-orphans || true"
run_shell_step "cd '$PROJECT_ROOT' && docker compose -f docker-compose.test.yml down -v --remove-orphans || true"
run_shell_step "cd '$PROJECT_ROOT' && rm -f e2e/.auth/user.json"

printf '\nShowcase reset complete.\n'
printf 'Demo users are enabled in %s.\n' "$ENV_FILE"
printf '  admin:   %s / %s\n' "$DEFAULT_ADMIN_USERNAME" "$DEFAULT_ADMIN_PASSWORD"
printf '  regular: %s / %s\n' "$DEFAULT_REGULAR_USERNAME" "$DEFAULT_REGULAR_PASSWORD"
printf '\n'

case "$MODE" in
  hero)
    printf 'Next steps:\n'
    printf '  ./scripts/showcase-preflight.sh --mode hero\n'
    printf '  docker compose -f docker-compose-infrastructure.yml up -d postgres postgres-ml mysql mongo zookeeper broker\n'
    printf '  docker compose -f docker-compose-app.yml up -d\n'
    ;;
  extended)
    printf 'Next steps:\n'
    printf '  ./scripts/showcase-preflight.sh --mode extended\n'
    printf '  docker compose -f docker-compose-infrastructure.yml up -d\n'
    printf '  docker compose -f docker-compose-app.yml up -d\n'
    ;;
  ai-operator)
    printf 'Next steps:\n'
    printf '  ./scripts/showcase-preflight.sh --mode ai-operator\n'
    printf '  docker compose -f docker-compose-infrastructure.yml up -d\n'
    printf '  docker compose -f docker-compose-app.yml up -d\n'
    ;;
esac
