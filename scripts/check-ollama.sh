#!/usr/bin/env bash
# ===========================================================================
# check-ollama.sh — Verify Ollama is reachable before starting AI services
#
# FIX 4.6: Ollama is an implicit external dependency (runs natively on macOS
# for GPU acceleration). This script validates it's available and has the
# required models pulled.
#
# Usage:
#   ./scripts/check-ollama.sh
#   ./scripts/check-ollama.sh --host host.docker.internal --port 11434
# ===========================================================================
set -euo pipefail

OLLAMA_HOST="${1:-${OLLAMA_HOST:-localhost}}"
OLLAMA_PORT="${2:-${OLLAMA_PORT:-11434}}"
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"

REQUIRED_MODELS=("${LLM_MODEL:-qwen3:1.7b}" "${LLM_MODEL_EMBEDDING:-qwen3-embedding:4b}")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================="
echo " Ollama Availability Check"
echo " Target: ${OLLAMA_URL}"
echo "============================================="

# 1. Check if Ollama is reachable
echo -n "Checking Ollama connectivity... "
if curl -sf --max-time 5 "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo ""
    echo -e "${RED}Ollama is not reachable at ${OLLAMA_URL}${NC}"
    echo ""
    echo "To fix this, either:"
    echo "  1. Install and run Ollama natively (recommended for GPU):"
    echo "       brew install ollama"
    echo "       ollama serve"
    echo ""
    echo "  2. Or start the containerized version (no GPU):"
    echo "       docker compose --profile ollama -f docker-compose-infrastructure.yml up -d ollama"
    echo ""
    exit 1
fi

# 2. Check for required models
AVAILABLE_MODELS=$(curl -sf "${OLLAMA_URL}/api/tags" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in data.get('models', []):
    print(m['name'])
" 2>/dev/null || echo "")

MISSING=()
for model in "${REQUIRED_MODELS[@]}"; do
    echo -n "Checking model '${model}'... "
    if echo "${AVAILABLE_MODELS}" | grep -q "^${model}$"; then
        echo -e "${GREEN}available${NC}"
    else
        echo -e "${YELLOW}MISSING${NC}"
        MISSING+=("${model}")
    fi
done

# 3. Report
echo ""
if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}All required models are available. Ready to start.${NC}"
    exit 0
else
    echo -e "${YELLOW}Missing models detected. Pull them with:${NC}"
    for model in "${MISSING[@]}"; do
        echo "  ollama pull ${model}"
    done
    echo ""
    echo "Services will still start but LLM features may fail."
    exit 0  # Non-fatal — services have their own error handling
fi
