# =============================================================================
# AI Orchestration Dashboard - Dockerfile
# =============================================================================
# Multi-stage build for Vite + React frontend (Node-based Production)
# =============================================================================

# Stage 1: Build
#
# Prefer the Debian-based image here. Vite/Rollup native optional packages are
# more reliable on glibc than on musl during CI and nightly container builds.
FROM node:20-slim AS builder

WORKDIR /workspace

# Copy the monorepo workspace manifests first so local @portfolio/* packages
# resolve from the root lockfile instead of the public npm registry.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/api-clients/package.json ./packages/api-clients/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY ai-orchestration/ai-orchestration-monitor/package.json ./ai-orchestration/ai-orchestration-monitor/package.json

# Install dependencies deterministically when a lockfile is present.
# npm intermittently misses Rollup's optional native package in containers, so
# install the matching Linux native binding explicitly if the loader is absent.
RUN APP_DIR=ai-orchestration/ai-orchestration-monitor \
 && npm ci --workspace "$APP_DIR" --include-workspace-root=false --include=optional \
 && case "$(node -p "process.arch")" in \
      arm64) ROLLUP_PACKAGE='@rollup/rollup-linux-arm64-gnu' ;; \
      x64) ROLLUP_PACKAGE='@rollup/rollup-linux-x64-gnu' ;; \
      *) ROLLUP_PACKAGE='' ;; \
    esac \
 && if [ -z "$ROLLUP_PACKAGE" ]; then \
      echo "Unsupported architecture for Rollup native fallback: $(node -p "process.arch")" >&2; \
      exit 1; \
    fi \
 && if [ ! -d "$APP_DIR/node_modules/${ROLLUP_PACKAGE}" ]; then \
      ROLLUP_VERSION="$(node -p "require('./${APP_DIR}/node_modules/rollup/package.json').version")"; \
      echo "Installing missing Rollup native package: ${ROLLUP_PACKAGE}@${ROLLUP_VERSION}"; \
      cd "$APP_DIR" && npm install --no-save "${ROLLUP_PACKAGE}@${ROLLUP_VERSION}" && cd /workspace; \
    fi \
 && node -e "require('./${APP_DIR}/node_modules/rollup/dist/native.js')"

# Copy shared workspace sources plus the monitor app after dependency restore.
COPY packages/contracts ./packages/contracts
COPY packages/api-clients ./packages/api-clients
COPY packages/auth ./packages/auth
COPY packages/ui ./packages/ui
COPY ai-orchestration/ai-orchestration-monitor ./ai-orchestration/ai-orchestration-monitor

# Build arguments for API URL
ARG VITE_API_URL
ARG VITE_AI_BASE_URL
ARG VITE_AI_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_BASE_URL=$VITE_AI_BASE_URL
ENV VITE_AI_WS_URL=$VITE_AI_WS_URL

# Build the application
WORKDIR /workspace/ai-orchestration/ai-orchestration-monitor
RUN npm run build

# =============================================================================
# Stage 2: Production (Node.js + serve)
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Install 'serve', a static file serving handler for Node.js
RUN npm install -g serve

# Copy built files from the builder stage
COPY --from=builder /workspace/ai-orchestration/ai-orchestration-monitor/dist ./dist

# Expose port (Serve defaults to 8700)
EXPOSE 5010

# Health check (Checks if root returns 200 OK)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:5010/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the server
# -s: Single-page application (rewrites 404s to index.html)
# dist: The folder to serve
# -l 5010: Listen on port 5010
CMD ["serve", "-s", "dist", "-l", "5010"]
