#!/usr/bin/env bash
# ===========================================================================
# showcase-up.sh — Start the curated portfolio/showcase modes with one command
#
# Usage:
#   ./scripts/showcase-up.sh
#   ./scripts/showcase-up.sh --mode portfolio
#   ./scripts/showcase-up.sh --mode extended
#   ./scripts/showcase-up.sh --mode ai-operator
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="portfolio"
ENV_FILE="${PROJECT_ROOT}/.env"
RESET_FIRST=1

usage() {
  cat <<'EOF'
Start the curated local showcase in one command.

Options:
  --mode <portfolio|hero|extended|ai-operator>  Startup mode (default: portfolio)
  --env-file <path>                             Path to env file (default: ./.env)
  --no-reset                                    Keep current local state instead of resetting to the demo baseline
  -h, --help                                    Show this help
EOF
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/showcase-up.XXXXXX")"

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

ensure_env_ready() {
  if [ ! -f "$ENV_FILE" ]; then
    "${PROJECT_ROOT}/scripts/setup-env-jwt-keys.sh" --env-file "$ENV_FILE"
  fi
}

sync_mode_env_flags() {
  ensure_env_ready

  upsert_env_var "NEXT_PUBLIC_ENABLE_OPENMAPS" "true" "$ENV_FILE"
  case "$MODE" in
    portfolio|ai-operator)
      upsert_env_var "NEXT_PUBLIC_ENABLE_CHATLLM" "false" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_JIRA" "false" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_MLOPS" "false" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_PETSTORE" "false" "$ENV_FILE"
      ;;
    extended)
      upsert_env_var "NEXT_PUBLIC_ENABLE_CHATLLM" "true" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_JIRA" "true" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_MLOPS" "true" "$ENV_FILE"
      upsert_env_var "NEXT_PUBLIC_ENABLE_PETSTORE" "true" "$ENV_FILE"
      ;;
  esac
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
    --no-reset)
      RESET_FIRST=0
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
  portfolio|hero|extended|ai-operator)
    ;;
  *)
    echo "Unsupported mode: $MODE" >&2
    usage >&2
    exit 1
    ;;
esac

if [ "$MODE" = "hero" ]; then
  MODE="portfolio"
fi

if [ "$RESET_FIRST" -eq 1 ]; then
  "${PROJECT_ROOT}/scripts/showcase-reset.sh" --mode "$MODE" --env-file "$ENV_FILE"
else
  sync_mode_env_flags
fi

"${PROJECT_ROOT}/scripts/showcase-preflight.sh" --mode "$MODE" --env-file "$ENV_FILE"

cd "$PROJECT_ROOT"

infra_args=(docker compose --env-file "$ENV_FILE" -f docker-compose-infrastructure.yml)
app_args=(docker compose --env-file "$ENV_FILE" -f docker-compose-app.yml)

case "$MODE" in
  extended)
    infra_args+=(--profile extended)
    app_args+=(--profile extended)
    ;;
  ai-operator)
    infra_args+=(--profile ai-operator)
    ;;
esac

echo "Starting infrastructure for mode: $MODE"
if [ "$MODE" = "ai-operator" ]; then
  "${infra_args[@]}" up -d --build
else
  "${infra_args[@]}" up -d
fi

echo "Starting application services for mode: $MODE"
"${app_args[@]}" up -d --build

printf '\nShowcase startup complete.\n'
printf 'Main app: http://localhost:5001\n'
printf 'Gateway:  http://localhost:80\n'
printf 'Maps:     http://localhost:5001/maps\n'

case "$MODE" in
  portfolio)
    printf 'Mode:     portfolio\n'
    ;;
  extended)
    printf 'Mode:     extended\n'
    printf 'Jira:     http://localhost:5001/jira\n'
    printf 'MLOps:    http://localhost:5001/mlops\n'
    printf 'PetStore: http://localhost:5001/petstore\n'
    printf 'ChatLLM:  http://localhost:5001/chatllm\n'
    printf 'Umami:    http://localhost:3001\n'
    ;;
  ai-operator)
    printf 'Mode:     ai-operator\n'
    printf 'AI monitor: http://localhost:5010\n'
    ;;
esac
