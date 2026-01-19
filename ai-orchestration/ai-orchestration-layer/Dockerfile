# =============================================================================
# AI Orchestration Layer - Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
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

# Copy application code - IMPORTANT: This copies the src folder
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
# Environment Configuration
# -----------------------------------------------------------------------------
ENV PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Application defaults
    ENVIRONMENT=production \
    HOST=0.0.0.0 \
    PORT=8700 \
    DEBUG=false \
    # LLM Configuration
    LLM_MODEL=llama3.2:3b \
    OLLAMA_URL=http://ollama:11434 \
    LLM_TEMPERATURE=0.7 \
    LLM_MAX_TOKENS=2000 \
    # Service URLs (default to Docker service names)
    CLOUDAPP_URL=http://cloudapp:8099/cloudapp \
    PETSTORE_URL=http://petstore:8803/petstore \
    VEHICLES_URL=http://vehicles-api:8880/vehicles \
    ML_PIPELINE_URL=http://ml-pipeline:8000 \
    # Storage
    REDIS_URL=redis://redis:6379/0 \
    MONGODB_URL=mongodb://mongodb-abtest:27019 \
    # RAG
    CHROMA_PERSIST_DIR=/data/chroma \
    # Logging
    LOG_LEVEL=INFO \
    LOG_FORMAT=json

# Expose port
EXPOSE 8700

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8700/health || exit 1

# Run application
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

# Development settings
ENV DEBUG=true \
    LOG_LEVEL=DEBUG \
    ENVIRONMENT=development

# Run with hot reload for development
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8700", "--reload"]