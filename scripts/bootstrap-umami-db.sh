#!/usr/bin/env bash
# ===========================================================================
# bootstrap-umami-db.sh — Create the dedicated Umami PostgreSQL role/database
#
# Usage:
#   ./scripts/bootstrap-umami-db.sh
#   ./scripts/bootstrap-umami-db.sh --env-file ./custom.env
#   ./scripts/bootstrap-umami-db.sh --compose-file ./docker-compose-infra.yml
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose-infrastructure.yml"

usage() {
  cat <<'EOF'
Create or update the dedicated PostgreSQL role/database used by Umami.

Options:
  --env-file <path>      Path to env file (default: ./.env)
  --compose-file <path>  Path to compose file (default: ./docker-compose-infrastructure.yml)
  -h, --help             Show this help
EOF
}

validate_identifier() {
  local label="$1"
  local value="$2"

  if [[ ! "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "${label} must match ^[A-Za-z_][A-Za-z0-9_]*$ (received: ${value})" >&2
    exit 1
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file)
      [ $# -ge 2 ] || {
        echo "Missing value for --env-file" >&2
        exit 1
      }
      ENV_FILE="$2"
      shift 2
      ;;
    --compose-file)
      [ $# -ge 2 ] || {
        echo "Missing value for --compose-file" >&2
        exit 1
      }
      COMPOSE_FILE="$2"
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

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?Set POSTGRES_USER in ${ENV_FILE}}"
: "${UMAMI_DB_NAME:?Set UMAMI_DB_NAME in ${ENV_FILE}}"
: "${UMAMI_DB_USER:?Set UMAMI_DB_USER in ${ENV_FILE}}"
: "${UMAMI_DB_PASSWORD:?Set UMAMI_DB_PASSWORD in ${ENV_FILE}}"

validate_identifier "POSTGRES_USER" "$POSTGRES_USER"
validate_identifier "UMAMI_DB_NAME" "$UMAMI_DB_NAME"
validate_identifier "UMAMI_DB_USER" "$UMAMI_DB_USER"

ESCAPED_UMAMI_DB_PASSWORD="${UMAMI_DB_PASSWORD//\'/\'\'}"

echo "Starting PostgreSQL if needed..."
docker compose -f "$COMPOSE_FILE" up -d postgres >/dev/null

echo "Waiting for PostgreSQL to accept connections..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_isready -U "$POSTGRES_USER" -d postgres >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready in time." >&2
  exit 1
fi

echo "Bootstrapping Umami database '${UMAMI_DB_NAME}' and role '${UMAMI_DB_USER}'..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${UMAMI_DB_USER}') THEN
    CREATE ROLE "${UMAMI_DB_USER}" LOGIN PASSWORD '${ESCAPED_UMAMI_DB_PASSWORD}';
  ELSE
    ALTER ROLE "${UMAMI_DB_USER}" WITH LOGIN PASSWORD '${ESCAPED_UMAMI_DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE "${UMAMI_DB_NAME}" OWNER "${UMAMI_DB_USER}"'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${UMAMI_DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE "${UMAMI_DB_NAME}" TO "${UMAMI_DB_USER}";
SQL

echo "Umami database bootstrap complete."
echo "Next step:"
echo "  docker compose -f ${COMPOSE_FILE} up -d umami"
