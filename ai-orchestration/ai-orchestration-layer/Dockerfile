# =============================================================================
# AI Orchestration Layer - Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
# Runtime configuration is handled via docker-compose environment section
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies for native packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies to a target directory
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --target=/build/deps -r requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS production

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# Copy installed packages from builder
COPY --from=builder /build/deps /usr/local/lib/python3.12/site-packages/

# Copy application code
COPY ./src /app/src
COPY ./requirements.txt /app/

# Verify files are copied (will show in build output)
RUN echo "=== Verifying copied files ===" && \
    ls -la /app && \
    ls -la /app/src && \
    echo "=== Files verified ==="

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash --uid 1000 appuser && \
    chown -R appuser:appuser /app

# Create directories for persistent data and logs
RUN mkdir -p /data/chroma /app/logs /app/data && \
    chown -R appuser:appuser /data /app/logs /app/data

# Switch to non-root user
USER appuser

# -----------------------------------------------------------------------------
# Build-time configuration (only what's needed for the build)
# Runtime configuration comes from docker-compose environment section
# -----------------------------------------------------------------------------
ENV PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8700

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8700/health || exit 1

# Run application
# With PYTHONPATH=/app/src, uvicorn finds main.py directly
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8700"]

# -----------------------------------------------------------------------------
# Stage 3: Development - Includes dev tools
# -----------------------------------------------------------------------------
FROM production AS development

USER root

# Install development dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Install dev Python packages
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    black \
    isort \
    mypy

USER appuser

# Run with hot reload for development
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8700", "--reload"]