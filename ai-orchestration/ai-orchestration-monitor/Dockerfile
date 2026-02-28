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

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies deterministically when a lockfile is present.
# npm intermittently misses Rollup's optional native package in containers, so
# install the matching Linux native binding explicitly if the loader is absent.
RUN if [ -f package-lock.json ]; then npm ci --include=optional; else npm install --include=optional; fi \
 && case "$(node -p "process.arch")" in \
      arm64) ROLLUP_PACKAGE='@rollup/rollup-linux-arm64-gnu' ;; \
      x64) ROLLUP_PACKAGE='@rollup/rollup-linux-x64-gnu' ;; \
      *) ROLLUP_PACKAGE='' ;; \
    esac \
 && if [ -z "$ROLLUP_PACKAGE" ]; then \
      echo "Unsupported architecture for Rollup native fallback: $(node -p "process.arch")" >&2; \
      exit 1; \
    fi \
 && if [ ! -d "node_modules/${ROLLUP_PACKAGE}" ]; then \
      ROLLUP_VERSION="$(node -p "require('./node_modules/rollup/package.json').version")"; \
      echo "Installing missing Rollup native package: ${ROLLUP_PACKAGE}@${ROLLUP_VERSION}"; \
      npm install --no-save "${ROLLUP_PACKAGE}@${ROLLUP_VERSION}"; \
    fi \
 && node -e "require('rollup/dist/native.js')"

# Copy source files
COPY . .

# Build arguments for API URL
ARG VITE_API_URL
ARG VITE_AI_BASE_URL
ARG VITE_AI_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_BASE_URL=$VITE_AI_BASE_URL
ENV VITE_AI_WS_URL=$VITE_AI_WS_URL

# Build the application
RUN npm run build

# =============================================================================
# Stage 2: Production (Node.js + serve)
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Install 'serve', a static file serving handler for Node.js
RUN npm install -g serve

# Copy built files from the builder stage
COPY --from=builder /app/dist ./dist

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
