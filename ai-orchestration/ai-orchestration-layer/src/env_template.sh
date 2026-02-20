# AI Orchestration Layer - Environment Configuration Template
# Copy this to .env and update values as needed

# ============================================================================
# ENVIRONMENT
# ============================================================================
ENVIRONMENT=development  # Options: development, staging, production

# ============================================================================
# LLM CONFIGURATION
# ============================================================================
LLM_MODEL=qwen3:1.7b
OLLAMA_URL=http://localhost:11434
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000
LLM_STREAMING=false
LLM_TIMEOUT=30

# ============================================================================
# SERVICE URLS
# ============================================================================
CLOUDAPP_URL=http://localhost:8099
PETSTORE_URL=http://localhost:8083
VEHICLES_URL=http://localhost:8880
ML_URL=http://localhost:8600
POSTGRES_URL=postgresql://<user>:<password>@localhost:5432/cloudappdb

# ============================================================================
# HTTP CLIENT CONFIGURATION
# ============================================================================
HTTP_TIMEOUT=10
ML_TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=1.0
RETRY_BACKOFF=2.0

# ============================================================================
# RAG CONFIGURATION
# ============================================================================
CHROMA_PERSIST_DIR=./chroma_db
CHROMA_COLLECTION=user_documents
EMBEDDING_MODEL=qwen3:1.7b
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_SEARCH_K=3
RAG_SIMILARITY_THRESHOLD=0.7

# ============================================================================
# CACHING CONFIGURATION
# ============================================================================
CACHE_ENABLED=true
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
LLM_CACHE_ENABLED=true
EMBEDDINGS_CACHE_ENABLED=true
TOOL_CACHE_ENABLED=true

# ============================================================================
# ORCHESTRATION FEATURES
# ============================================================================
ENABLE_CHECKPOINTING=true
ENABLE_HITL=true
ENABLE_PARALLEL=true
ENABLE_STREAMING=false
ENABLE_ERROR_HANDLING=true
MAX_PARALLEL_WORKERS=10
MAX_CONVERSATION_HISTORY=20
FALLBACK_ENABLED=true
FALLBACK_RETRY_COUNT=2

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================
LOG_LEVEL=INFO  # Options: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT=json  # Options: json, text
ENABLE_FILE_LOGGING=true
LOG_FILE=logs/orchestration.log
LOG_MAX_FILE_SIZE=10485760  # 10MB
LOG_BACKUP_COUNT=5

# ============================================================================
# DEVELOPMENT ONLY (Remove in production)
# ============================================================================
DEBUG=false
RELOAD=true
