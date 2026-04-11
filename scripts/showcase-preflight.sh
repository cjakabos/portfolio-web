#!/usr/bin/env bash
# ===========================================================================
# showcase-preflight.sh — Validate the local machine for the flagship tours
#
# Usage:
#   ./scripts/showcase-preflight.sh
#   ./scripts/showcase-preflight.sh --mode portfolio
#   ./scripts/showcase-preflight.sh --mode hero
#   ./scripts/showcase-preflight.sh --mode extended
#   ./scripts/showcase-preflight.sh --mode ai-operator
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="portfolio"
ENV_FILE="${PROJECT_ROOT}/.env"
FAILURES=0
WARNINGS=0

usage() {
  cat <<'EOF'
Validate the local machine for the flagship platform showcase.

Options:
  --mode <portfolio|hero|extended|ai-operator>  Validation mode (default: portfolio)
  --env-file <path>                   Path to env file (default: ./.env)
  -h, --help                          Show this help
EOF
}

note() {
  printf '[info] %s\n' "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf '[warn] %s\n' "$1"
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf '[fail] %s\n' "$1"
}

check_command() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    note "$label: found"
  else
    fail "$label: missing from PATH"
  fi
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -Pn >/dev/null 2>&1
    return $?
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | tail -n +2 | grep -q .
    return $?
  fi
  return 1
}

check_port() {
  local port="$1"
  local label="$2"
  if port_in_use "$port"; then
    warn "$label port ${port} is already in use"
  else
    note "$label port ${port}: available"
  fi
}

read_env_value() {
  local key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return 0
  fi
  grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true
}

check_env_key() {
  local key="$1"
  local mode_label="$2"
  local value
  value="$(read_env_value "$key")"
  if [ -n "$value" ]; then
    note "${mode_label}: ${key} set"
  else
    fail "${mode_label}: ${key} is missing in ${ENV_FILE}"
  fi
}

check_file_from_env() {
  local key="$1"
  local path_value
  path_value="$(read_env_value "$key")"
  if [ -z "$path_value" ]; then
    fail "${key} is missing in ${ENV_FILE}"
    return
  fi
  if [ -f "$path_value" ]; then
    note "${key}: file exists"
  else
    fail "${key}: file does not exist at ${path_value}"
  fi
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker CLI is missing"
    return
  fi
  if docker info >/dev/null 2>&1; then
    note "Docker daemon: reachable"
  else
    fail "Docker daemon is not reachable"
  fi
}

check_disk_space() {
  local available_kb
  available_kb="$(df -Pk "$PROJECT_ROOT" | awk 'NR==2 {print $4}')"
  if [ -z "$available_kb" ]; then
    warn "Unable to determine available disk space"
    return
  fi
  if [ "$available_kb" -lt 15728640 ]; then
    warn "Less than 15 GB free disk space detected; hero mode may be unreliable"
  else
    note "Disk space: sufficient for hero mode"
  fi
}

check_memory() {
  local total_bytes=""
  if command -v sysctl >/dev/null 2>&1; then
    total_bytes="$(sysctl -n hw.memsize 2>/dev/null || true)"
  elif [ -r /proc/meminfo ]; then
    total_bytes="$(awk '/MemTotal/ {print $2 * 1024}' /proc/meminfo)"
  fi

  if [ -z "$total_bytes" ]; then
    warn "Unable to determine system memory"
    return
  fi

  if [ "$total_bytes" -lt 17179869184 ]; then
    warn "Less than 16 GB RAM detected; extended tours may be slow"
  else
    note "Memory: sufficient for extended tours"
  fi
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

note "Running showcase preflight in '${MODE}' mode"

check_command openssl "OpenSSL"
check_docker
check_disk_space
check_memory

if [ -f "$ENV_FILE" ]; then
  note "Env file present: ${ENV_FILE}"
else
  fail "Env file missing: ${ENV_FILE} (run ./scripts/setup-env-jwt-keys.sh first)"
fi

check_env_key "JWT_SECRET" "Hero setup"
check_env_key "INTERNAL_GATEWAY_ADMIN_TOKEN" "Hero setup"
check_env_key "INTERNAL_AI_ORCHESTRATION_TOKEN" "Hero setup"
check_file_from_env "JWT_PRIVATE_KEY_FILE"
check_file_from_env "JWT_PUBLIC_KEY_FILE"

check_port 80 "Gateway"
check_port 443 "Gateway TLS"
check_port 5001 "CloudApp shell"
check_port 5002 "OpenMaps remote"

if [ "$MODE" = "extended" ]; then
  check_port 5003 "Jira remote"
  check_port 5005 "MLOps remote"
  check_port 5006 "Petstore remote"
  check_port 5333 "ChatLLM remote"
  check_port 3001 "Umami analytics"
fi

if [ "$MODE" = "ai-operator" ]; then
  check_port 5010 "AI monitor"
fi

if [ "$MODE" = "extended" ] || [ "$MODE" = "ai-operator" ]; then
  if command -v ollama >/dev/null 2>&1; then
    note "Ollama CLI: found"
  else
    warn "Ollama CLI not found; AI features can still run if Docker profile is used"
  fi
  if [ -n "$(read_env_value "JIRA_API_TOKEN")" ] && [ "$(read_env_value "JIRA_API_TOKEN")" != "CHANGE_ME" ]; then
    note "Jira credentials: configured"
  else
    warn "Jira credentials are not configured; Jira AI refinement will be limited"
  fi
fi

printf '\n'
if [ "$FAILURES" -gt 0 ]; then
  printf 'Preflight finished with %d failure(s) and %d warning(s).\n' "$FAILURES" "$WARNINGS" >&2
  exit 1
fi

printf 'Preflight passed with %d warning(s).\n' "$WARNINGS"
case "$MODE" in
  portfolio)
    printf 'Next step: ./scripts/showcase-up.sh --mode portfolio\n'
    ;;
  extended)
    printf 'Next step: ./scripts/showcase-up.sh --mode extended\n'
    ;;
  ai-operator)
    printf 'Next step: ./scripts/showcase-up.sh --mode ai-operator\n'
    ;;
esac
