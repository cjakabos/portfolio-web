# backend/ai-orchestration-layer/src/core/config.py

"""
Configuration Manager - UPDATED
Added Redis and MongoDB configuration
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

# Disable ChromaDB telemetry before it gets imported anywhere
os.environ["ANONYMIZED_TELEMETRY"] = "False"


class Environment(Enum):
    """Application environment"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class LLMConfiguration:
    """LLM configuration"""
    model: str = "not-added"
    base_url: str = "http://localhost:11434"
    temperature: float = 0.7
    max_tokens: int = 2000
    streaming: bool = False
    timeout: int = 30

    @classmethod
    def from_env(cls) -> 'LLMConfiguration':
        """Create configuration from environment variables"""
        return cls(
            model=os.getenv("LLM_MODEL", "not-added"),
            base_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "2000")),
            streaming=os.getenv("LLM_STREAMING", "false").lower() == "true",
            timeout=int(os.getenv("LLM_TIMEOUT", "30"))
        )


@dataclass
class ServiceConfiguration:
    """External service configuration"""
    cloudapp_url: str = "http://next-nginx-jwt:80/cloudapp"
    petstore_url: str = "http://next-nginx-jwt:80/petstore"
    vehicles_url: str = "http://next-nginx-jwt:80/vehicles"
    ml_url: str = "http://next-nginx-jwt:80/mlops-segmentation"
    postgres_url: str = "postgresql://websitemaster:local@postgres:5432/cloudappdb"

    # HTTP client settings
    http_timeout: int = 10
    ml_timeout: int = 30
    http_max_connections: int = 100
    http_max_keepalive: int = 20

    # Retry configuration
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_backoff: float = 2.0

    @classmethod
    def from_env(cls) -> 'ServiceConfiguration':
        """Create configuration from environment variables"""
        return cls(
            cloudapp_url=os.getenv("CLOUDAPP_URL", "http://next-nginx-jwt:80/cloudapp"),
            petstore_url=os.getenv("PETSTORE_URL", "http://next-nginx-jwt:80/petstore"),
            vehicles_url=os.getenv("VEHICLES_URL", "http://next-nginx-jwt:80/vehicles"),
            ml_url=os.getenv("ML_URL", "http://mlops-segmentation:80/mlops-segmentation"),
            postgres_url=os.getenv("POSTGRES_URL", "postgresql://websitemaster:local@postgres:5432/cloudappdb"),
            http_timeout=int(os.getenv("HTTP_TIMEOUT", "10")),
            ml_timeout=int(os.getenv("ML_TIMEOUT", "30")),
            http_max_connections=int(os.getenv("HTTP_MAX_CONNECTIONS", "100")),
            http_max_keepalive=int(os.getenv("HTTP_MAX_KEEPALIVE", "20")),
            max_retries=int(os.getenv("MAX_RETRIES", "3")),
            retry_delay=float(os.getenv("RETRY_DELAY", "1.0")),
            retry_backoff=float(os.getenv("RETRY_BACKOFF", "2.0"))
        )


@dataclass
class RedisConfiguration:
    """Redis configuration for circuit breaker state (NEW)"""
    url: str = "redis://redis:6379/0"
    max_connections: int = 50
    socket_timeout: int = 5
    socket_connect_timeout: int = 5
    retry_on_timeout: bool = True
    health_check_interval: int = 30

    @classmethod
    def from_env(cls) -> 'RedisConfiguration':
        """Create configuration from environment variables"""
        return cls(
            url=os.getenv("REDIS_URL", "redis://redis:6379/0"),
            max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "50")),
            socket_timeout=int(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
            socket_connect_timeout=int(os.getenv("REDIS_CONNECT_TIMEOUT", "5")),
            retry_on_timeout=os.getenv("REDIS_RETRY_ON_TIMEOUT", "true").lower() == "true",
            health_check_interval=int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30"))
        )


@dataclass
class MongoDBConfiguration:
    """MongoDB configuration for A/B testing (NEW)"""
    url: str = "mongodb://mongodb-abtest:27019"
    database: str = "ai_orchestration"
    experiments_collection: str = "experiments"
    assignments_collection: str = "user_assignments"
    max_pool_size: int = 50
    min_pool_size: int = 10
    server_selection_timeout_ms: int = 5000

    @classmethod
    def from_env(cls) -> 'MongoDBConfiguration':
        """Create configuration from environment variables"""
        return cls(
            url=os.getenv("MONGODB_URL", "mongodb://mongodb-abtest:27019"),
            database=os.getenv("MONGODB_DATABASE", "ai_orchestration"),
            experiments_collection=os.getenv("MONGODB_EXPERIMENTS_COLLECTION", "experiments"),
            assignments_collection=os.getenv("MONGODB_ASSIGNMENTS_COLLECTION", "user_assignments"),
            max_pool_size=int(os.getenv("MONGODB_MAX_POOL_SIZE", "50")),
            min_pool_size=int(os.getenv("MONGODB_MIN_POOL_SIZE", "10")),
            server_selection_timeout_ms=int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT", "5000"))
        )


@dataclass
class RAGConfiguration:
    """RAG engine configuration"""
    persist_directory: str = "./chroma_db"
    collection_name: str = "user_documents"
    embedding_model: str = "not-added"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    search_k: int = 3
    similarity_threshold: float = 0.7

    @classmethod
    def from_env(cls) -> 'RAGConfiguration':
        """Create configuration from environment variables"""
        return cls(
            persist_directory=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"),
            collection_name=os.getenv("CHROMA_COLLECTION", "user_documents"),
            embedding_model=os.getenv("EMBEDDING_MODEL", "not-added"),
            chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1000")),
            chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
            search_k=int(os.getenv("RAG_SEARCH_K", "3")),
            similarity_threshold=float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.7"))
        )


@dataclass
class CacheConfiguration:
    """Caching configuration"""
    enabled: bool = True
    ttl: int = 3600
    max_size: int = 1000
    llm_cache_enabled: bool = True
    embeddings_cache_enabled: bool = True
    tool_cache_enabled: bool = True

    @classmethod
    def from_env(cls) -> 'CacheConfiguration':
        """Create configuration from environment variables"""
        return cls(
            enabled=os.getenv("CACHE_ENABLED", "true").lower() == "true",
            ttl=int(os.getenv("CACHE_TTL", "3600")),
            max_size=int(os.getenv("CACHE_MAX_SIZE", "1000")),
            llm_cache_enabled=os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true",
            embeddings_cache_enabled=os.getenv("EMBEDDINGS_CACHE_ENABLED", "true").lower() == "true",
            tool_cache_enabled=os.getenv("TOOL_CACHE_ENABLED", "true").lower() == "true"
        )


@dataclass
class OrchestrationConfiguration:
    """Orchestration feature flags"""
    enable_checkpointing: bool = True
    enable_hitl: bool = True
    enable_parallel: bool = True
    enable_streaming: bool = False
    enable_error_handling: bool = True
    enable_ab_testing: bool = True  # NEW
    max_parallel_workers: int = 10
    max_conversation_history: int = 20
    checkpoint_db_path: str = "data/orchestration_checkpoints.db"

    @classmethod
    def from_env(cls) -> 'OrchestrationConfiguration':
        """Create configuration from environment variables"""
        return cls(
            enable_checkpointing=os.getenv("ENABLE_CHECKPOINTING", "true").lower() == "true",
            enable_hitl=os.getenv("ENABLE_HITL", "true").lower() == "true",
            enable_parallel=os.getenv("ENABLE_PARALLEL", "true").lower() == "true",
            enable_streaming=os.getenv("ENABLE_STREAMING", "false").lower() == "true",
            enable_error_handling=os.getenv("ENABLE_ERROR_HANDLING", "true").lower() == "true",
            enable_ab_testing=os.getenv("ENABLE_AB_TESTING", "true").lower() == "true",
            max_parallel_workers=int(os.getenv("MAX_PARALLEL_WORKERS", "10")),
            max_conversation_history=int(os.getenv("MAX_CONVERSATION_HISTORY", "20")),
            checkpoint_db_path=os.getenv("CHECKPOINT_DB_PATH", "data/orchestration_checkpoints.db")
        )


@dataclass
class LoggingConfiguration:
    """Logging configuration"""
    level: str = "INFO"
    format: str = "json"
    enable_file_logging: bool = True
    log_file: str = "logs/orchestration.log"
    max_file_size: int = 10485760  # 10MB
    backup_count: int = 5

    @classmethod
    def from_env(cls) -> 'LoggingConfiguration':
        """Create configuration from environment variables"""
        return cls(
            level=os.getenv("LOG_LEVEL", "INFO").upper(),
            format=os.getenv("LOG_FORMAT", "json"),
            enable_file_logging=os.getenv("ENABLE_FILE_LOGGING", "true").lower() == "true",
            log_file=os.getenv("LOG_FILE", "logs/orchestration.log"),
            max_file_size=int(os.getenv("LOG_MAX_FILE_SIZE", "10485760")),
            backup_count=int(os.getenv("LOG_BACKUP_COUNT", "5"))
        )


@dataclass
class Configuration:
    """Complete application configuration"""
    environment: Environment
    llm: LLMConfiguration
    services: ServiceConfiguration
    redis: RedisConfiguration  # NEW
    mongodb: MongoDBConfiguration  # NEW
    rag: RAGConfiguration
    cache: CacheConfiguration
    orchestration: OrchestrationConfiguration
    logging: LoggingConfiguration

    @classmethod
    def from_env(cls) -> 'Configuration':
        """Create complete configuration from environment"""
        env = os.getenv("ENVIRONMENT", "development").lower()

        return cls(
            environment=Environment(env),
            llm=LLMConfiguration.from_env(),
            services=ServiceConfiguration.from_env(),
            redis=RedisConfiguration.from_env(),
            mongodb=MongoDBConfiguration.from_env(),
            rag=RAGConfiguration.from_env(),
            cache=CacheConfiguration.from_env(),
            orchestration=OrchestrationConfiguration.from_env(),
            logging=LoggingConfiguration.from_env()
        )

    def validate(self) -> bool:
        """Validate configuration"""
        required_vars = [
            "OLLAMA_URL",
            "CLOUDAPP_URL",
            "PETSTORE_URL",
            "VEHICLES_URL",
            "ML_URL",
            "POSTGRES_URL"
        ]

        # Redis and MongoDB are optional (will fallback to memory)
        optional_vars = [
            "REDIS_URL",
            "MONGODB_URL"
        ]

        missing = []
        for var in required_vars:
            if not os.getenv(var):
                missing.append(var)

        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

        # Warn about optional vars
        for var in optional_vars:
            if not os.getenv(var):
                print(f"⚠️  {var} not set - using fallback storage")

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            "environment": self.environment.value,
            "llm": {
                "model": self.llm.model,
                "base_url": self.llm.base_url,
                "temperature": self.llm.temperature
            },
            "services": {
                "cloudapp_url": self.services.cloudapp_url,
                "petstore_url": self.services.petstore_url,
                "vehicles_url": self.services.vehicles_url,
                "ml_url": self.services.ml_url
            },
            "redis": {
                "url": self.redis.url,
                "max_connections": self.redis.max_connections
            },
            "mongodb": {
                "url": self.mongodb.url,
                "database": self.mongodb.database
            },
            "features": {
                "checkpointing": self.orchestration.enable_checkpointing,
                "hitl": self.orchestration.enable_hitl,
                "parallel": self.orchestration.enable_parallel,
                "streaming": self.orchestration.enable_streaming,
                "error_handling": self.orchestration.enable_error_handling,
                "ab_testing": self.orchestration.enable_ab_testing
            }
        }


# Singleton instance
_config_instance: Optional[Configuration] = None


def get_config() -> Configuration:
    """Get singleton configuration instance"""
    global _config_instance
    if _config_instance is None:
        _config_instance = Configuration.from_env()
        _config_instance.validate()
    return _config_instance


def reload_config():
    """Reload configuration from environment"""
    global _config_instance
    _config_instance = None
    return get_config()