#!/usr/bin/env bash
# ===========================================================================
# setup-env-jwt-keys.sh — Generate JWT RSA keys and wire absolute paths into .env
#
# Usage:
#   ./scripts/setup-env-jwt-keys.sh
#   ./scripts/setup-env-jwt-keys.sh --force
#   ./scripts/setup-env-jwt-keys.sh --env-file ./custom.env --keys-dir ./secrets
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${PROJECT_ROOT}/.env"
KEYS_DIR="${PROJECT_ROOT}/secrets"
FORCE=0

usage() {
  cat <<'EOF'
Generate JWT keypair and configure absolute key paths in .env.

Options:
  --env-file <path>   Path to env file (default: ./.env)
  --keys-dir <path>   Directory to store generated key files (default: ./secrets)
  --force             Regenerate keys even if they already exist
  -h, --help          Show this help
EOF
}

to_abs_path() {
  local target="$1"
  if [ -d "$target" ]; then
    (
      cd "$target"
      pwd -P
    )
    return
  fi

  local dir
  local base
  dir="$(dirname "$target")"
  base="$(basename "$target")"
  (
    cd "$dir"
    printf '%s/%s\n' "$(pwd -P)" "$base"
  )
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp "${TMPDIR:-/tmp}/env-upsert.XXXXXX")"

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
    --keys-dir)
      [ $# -ge 2 ] || {
        echo "Missing value for --keys-dir" >&2
        exit 1
      }
      KEYS_DIR="$2"
      shift 2
      ;;
    --force)
      FORCE=1
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

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required but was not found in PATH." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "${PROJECT_ROOT}/env.example" ] && [ "$ENV_FILE" = "${PROJECT_ROOT}/.env" ]; then
    cp "${PROJECT_ROOT}/env.example" "$ENV_FILE"
    echo "Created ${ENV_FILE} from env.example"
  else
    touch "$ENV_FILE"
    echo "Created empty env file at ${ENV_FILE}"
  fi
fi

mkdir -p "$KEYS_DIR"

PRIVATE_KEY_FILE="${KEYS_DIR}/jwt-private-key.pem"
PUBLIC_KEY_FILE="${KEYS_DIR}/jwt-public-key.pub"

if [ "$FORCE" -eq 1 ] || [ ! -s "$PRIVATE_KEY_FILE" ] || [ ! -s "$PUBLIC_KEY_FILE" ]; then
  openssl genpkey -algorithm RSA -out "$PRIVATE_KEY_FILE" -pkeyopt rsa_keygen_bits:2048 >/dev/null 2>&1
  openssl rsa -in "$PRIVATE_KEY_FILE" -pubout -out "$PUBLIC_KEY_FILE" >/dev/null 2>&1
  chmod 600 "$PRIVATE_KEY_FILE"
  chmod 644 "$PUBLIC_KEY_FILE"
  echo "Generated JWT keypair in ${KEYS_DIR}"
else
  echo "JWT keypair already exists in ${KEYS_DIR} (use --force to regenerate)"
fi

PRIVATE_KEY_ABS="$(to_abs_path "$PRIVATE_KEY_FILE")"
PUBLIC_KEY_ABS="$(to_abs_path "$PUBLIC_KEY_FILE")"

upsert_env_var "JWT_PRIVATE_KEY_FILE" "$PRIVATE_KEY_ABS" "$ENV_FILE"
upsert_env_var "JWT_PUBLIC_KEY_FILE" "$PUBLIC_KEY_ABS" "$ENV_FILE"

CURRENT_SECRET="$(grep -E '^[[:space:]]*JWT_SECRET=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)"
if [ -z "$CURRENT_SECRET" ] || echo "$CURRENT_SECRET" | grep -Eq '^(CHANGE_ME|CHANGE_ME_.*)$'; then
  GENERATED_SECRET="$(openssl rand -base64 48)"
  upsert_env_var "JWT_SECRET" "$GENERATED_SECRET" "$ENV_FILE"
  echo "Set JWT_SECRET in ${ENV_FILE}"
fi

echo "Updated ${ENV_FILE}:"
echo "  JWT_PRIVATE_KEY_FILE=${PRIVATE_KEY_ABS}"
echo "  JWT_PUBLIC_KEY_FILE=${PUBLIC_KEY_ABS}"
echo ""
echo "Next step:"
echo "  docker compose -f docker-compose-app.yml up -d --build"
