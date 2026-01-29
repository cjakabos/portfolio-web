# =============================================================================
# AI Orchestration Dashboard - Dockerfile
# =============================================================================
# Multi-stage build for Vite + React frontend (Node-based Production)
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build arguments for API URL
ARG VITE_API_URL=http://localhost:80
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# =============================================================================
# Stage 2: Production (Node.js + serve)
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install 'serve', a static file serving handler for Node.js
RUN npm install -g serve

# Copy built files from the builder stage
COPY --from=builder /app/dist ./dist

# Expose port (Serve defaults to 8700)
EXPOSE 5010

# Health check (Checks if root returns 200 OK)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8700/ || exit 1

# Start the server
# -s: Single-page application (rewrites 404s to index.html)
# dist: The folder to serve
# -l 5010: Listen on port 5010
CMD ["serve", "-s", "dist", "-l", "5010"]