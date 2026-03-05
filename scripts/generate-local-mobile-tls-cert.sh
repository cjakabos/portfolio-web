#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Generate a stable mkcert TLS cert/key for local-network mobile HTTPS.

Usage:
  ./scripts/generate-local-mobile-tls-cert.sh [--force] [--hosts "h1,h2,..."] [extra-host ...]

Examples:
  ./scripts/generate-local-mobile-tls-cert.sh
  ./scripts/generate-local-mobile-tls-cert.sh --force --hosts "192.168.1.42,my-mac.local"
  ./scripts/generate-local-mobile-tls-cert.sh 192.168.1.42 my-mac.local
USAGE
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TLS_DIR="${ROOT_DIR}/secrets/tls"
CERT_FILE="${TLS_DIR}/localhost+3.pem"
KEY_FILE="${TLS_DIR}/localhost+3-key.pem"
CA_FILE="${TLS_DIR}/rootCA.pem"

FORCE=0
EXTRA_HOSTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --hosts)
      if [[ $# -lt 2 ]]; then
        echo "--hosts requires a comma-separated value"
        exit 1
      fi
      IFS=',' read -r -a parsed <<< "$2"
      for h in "${parsed[@]}"; do
        [[ -n "$h" ]] && EXTRA_HOSTS+=("$h")
      done
      shift 2
      ;;
    *)
      EXTRA_HOSTS+=("$1")
      shift
      ;;
  esac
done

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required but not installed."
  echo "Install (macOS): brew install mkcert nss"
  echo "Then run once: mkcert -install"
  exit 1
fi

if [[ -f "$CERT_FILE" || -f "$KEY_FILE" ]]; then
  if [[ "$FORCE" -ne 1 ]]; then
    echo "TLS cert/key already exist. Use --force to overwrite."
    echo "  $CERT_FILE"
    echo "  $KEY_FILE"
    exit 1
  fi
fi

mkdir -p "$TLS_DIR"

# Baseline hosts always present.
HOSTS=("localhost" "127.0.0.1" "::1")

# Add hostname and mDNS form when available.
HOSTNAME_SHORT="$(hostname -s 2>/dev/null || true)"
if [[ -n "$HOSTNAME_SHORT" ]]; then
  HOSTS+=("$HOSTNAME_SHORT" "${HOSTNAME_SHORT}.local")
fi

# Try to auto-detect a LAN IPv4.
LAN_IP=""
if command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
  # macOS path.
  iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "$iface" ]]; then
    LAN_IP="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  fi
fi
if [[ -z "$LAN_IP" ]] && command -v ip >/dev/null 2>&1; then
  # Linux fallback.
  LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
fi
if [[ -n "$LAN_IP" ]]; then
  HOSTS+=("$LAN_IP")
fi

# Merge explicit user hosts.
for h in "${EXTRA_HOSTS[@]}"; do
  HOSTS+=("$h")
done

# De-duplicate hosts preserving order.
UNIQ_HOSTS=()
for h in "${HOSTS[@]}"; do
  skip=0
  for u in "${UNIQ_HOSTS[@]}"; do
    if [[ "$u" == "$h" ]]; then
      skip=1
      break
    fi
  done
  if [[ "$skip" -eq 0 ]]; then
    UNIQ_HOSTS+=("$h")
  fi
done

mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${UNIQ_HOSTS[@]}"

CAROOT="$(mkcert -CAROOT)"
cp "$CAROOT/rootCA.pem" "$CA_FILE"
chmod 644 "$CERT_FILE" "$CA_FILE"
chmod 600 "$KEY_FILE"

echo "Generated mobile TLS assets:"
echo "  Cert:   $CERT_FILE"
echo "  Key:    $KEY_FILE"
echo "  CA:     $CA_FILE"
echo ""
echo "Hosts/SANs included:"
for h in "${UNIQ_HOSTS[@]}"; do
  echo "  - $h"
done
echo ""
echo "If not already done on this laptop: run 'mkcert -install' once."
