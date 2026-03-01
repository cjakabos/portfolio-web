"""
AI Orchestration Layer - Main Application
Integrates all service routers for the AI Orchestration Monitor.

FIXED:
- Added experiments_router initialization in lifespan
- Added approvals_router.set_orchestration_deps() for HITL frontend sync
"""

import logging
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# =============================================================================
# Core Logic Imports (Restored from old main.py)
# =============================================================================
from core.orchestrator import AIOrchestrationLayer
from core.config import get_config as get_core_config
from observability.metrics_collector import MetricsCollector
from observability.tracer import RequestTracer
from memory.memory_manager import MemoryManager
from memory.context_store import ContextStore
from tools.tool_manager import ToolManager
from observability.audit_service import AuditService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# Import Routers
# =============================================================================
from routers import (
    approvals_router,
    metrics_router,
    experiments_router,
    orchestration_router,
    system_router,
    tools_router,
    conversation_sync,
    rag_router,
    llm_router
)

# =============================================================================
# Configuration
# =============================================================================

class Settings:
    """Application runtime settings (service URLs come from shared core.config)."""

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8700"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://ai-orchestration-monitor:5010").split(",")

    def __init__(self):
        self._services = None

    @property
    def services(self):
        if self._services is None:
            self._services = get_core_config().services
        return self._services

    @property
    def CLOUDAPP_URL(self) -> str:
        return self.services.cloudapp_url

    @property
    def PETSTORE_URL(self) -> str:
        return self.services.petstore_url

    @property
    def VEHICLES_URL(self) -> str:
        return self.services.vehicles_url

    @property
    def ML_URL(self) -> str:
        return self.services.ml_url

settings = Settings()

# =============================================================================
# Application Lifecycle
# =============================================================================

# Global references to hold state if needed directly in main (optional)
orchestrator = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    global orchestrator

    logger.info("Starting AI Orchestration Layer...")
    logger.info(f"Environment: {settings.DEBUG and 'DEBUG' or 'PROD'}")

    # -------------------------------------------------------------------------
    # 1. Initialize Core AI Components
    # -------------------------------------------------------------------------
    logger.info("Initializing Core Components (Metrics, Memory, Orchestrator)...")

    metrics_collector = MetricsCollector()
    tracer = RequestTracer()
    memory_manager = MemoryManager()
    context_store = ContextStore()

    # Initialize Orchestrator (resilient to Ollama being offline)
    try:
        orchestrator = AIOrchestrationLayer(
            enable_checkpointing=True,
            enable_hitl=True,
            hitl_wait_mode="risk_based",
            enable_parallel=True,
            enable_streaming=False
        )
    except Exception as e:
        logger.warning(
            f"⚠️ Orchestrator initialization failed (server will start in degraded mode): {e}"
        )
        orchestrator = None

    # Initialize Tool Manager
    logger.info("Initializing Tool Manager...")
    tool_manager = ToolManager()
    tools_router.set_tool_manager(tool_manager)
    logger.info(f"Tool Manager initialized with {len(tool_manager.all_tools)} tools")

    # -------------------------------------------------------------------------
    # 2. Initialize Experiments Storage (MongoDB)
    # -------------------------------------------------------------------------
    logger.info("Initializing Experiments Storage...")
    try:
        await experiments_router.initialize_experiments()
        logger.info("✅ Experiments storage initialized")
    except Exception as e:
        logger.warning(f"⚠️ Experiments storage initialization failed (will use fallback): {e}")

    # -------------------------------------------------------------------------
    # 2a-bis. Initialize Audit Trail (MongoDB)
    # -------------------------------------------------------------------------
    logger.info("Initializing Audit Trail...")
    core_config = get_core_config()
    audit_service = AuditService(
        mongodb_url=core_config.mongodb.url,
        database=core_config.mongodb.database,
        collection=core_config.audit.collection,
    )
    try:
        await audit_service.initialize(mongo_config=core_config.mongodb)
        logger.info("✅ Audit trail initialized")
    except Exception as e:
        logger.warning(f"⚠️ Audit trail initialization failed (non-fatal): {e}")

    # -------------------------------------------------------------------------
    # 2b. Initialize Approvals Storage (Redis)
    # -------------------------------------------------------------------------
    logger.info("Initializing Approvals Storage...")
    try:
        if orchestrator:
            # Connect approvals router to orchestrator's hitl_manager
            approvals_router.set_approvals_hitl_manager(
                hitl_manager=orchestrator.hitl_manager,
                orchestrator=orchestrator
            )
        await approvals_router.initialize_approvals()
        logger.info("✅ Approvals storage initialized")
    except Exception as e:
        logger.warning(f"⚠️ Approvals storage initialization failed (will use fallback): {e}")

    # -------------------------------------------------------------------------
    # 2c. Initialize Conversation Sync (Redis)
    # -------------------------------------------------------------------------
    logger.info("Initializing Conversation Sync...")
    try:
        await conversation_sync.init_redis()
        logger.info("✅ Conversation sync initialized")
    except Exception as e:
        logger.warning(f"⚠️ Conversation sync initialization failed: {e}")

    # -------------------------------------------------------------------------
    # 3. Inject Dependencies into Routers
    # -------------------------------------------------------------------------
    if orchestrator:
        # Inject into the new Orchestration Router (for WebSocket streaming)
        orchestration_router.set_orchestration_deps(
            orchestrator=orchestrator,
            memory_manager=memory_manager,
            context_store=context_store
        )
        orchestration_router.set_audit_service(audit_service)

        # =========================================================================
        # CRITICAL FIX: Inject into Approvals Router for HITL frontend sync
        # This connects the orchestrator's HITL manager to the approvals storage
        # so pending approvals appear in the frontend!
        # =========================================================================
        approvals_router.set_orchestration_deps(
            orchestrator=orchestrator,
            memory_manager=memory_manager,
            context_store=context_store
        )
        logger.info("✅ Approvals router connected to orchestrator")

        # Inject into System Router (from old main.py logic)
        system_router.set_orchestrator(orchestrator)
        if hasattr(orchestrator, 'error_handler') and orchestrator.error_handler:
            system_router.set_error_handler(orchestrator.error_handler)
    else:
        logger.warning("⚠️ Orchestrator unavailable — routers running in degraded mode")

    # -------------------------------------------------------------------------
    # 4. Log Service Connections
    # -------------------------------------------------------------------------
    logger.info(f"Backend Services Configured:")
    logger.info(f"  - CloudApp: {settings.CLOUDAPP_URL}")
    logger.info(f"  - Petstore: {settings.PETSTORE_URL}")
    logger.info(f"  - Vehicles: {settings.VEHICLES_URL}")
    logger.info("✅ All services initialized successfully")

    # -------------------------------------------------------------------------
    # 5. RAG
    # -------------------------------------------------------------------------
    try:
        await rag_router.initialize_rag()
        logger.info("✅ RAG system initialized")
    except Exception as e:
        logger.warning(f"⚠️ RAG initialization warning: {e}")

    yield

    # -------------------------------------------------------------------------
    # Shutdown
    # -------------------------------------------------------------------------
    logger.info("Shutting down AI Orchestration Layer...")

    # Cleanup approvals background task
    try:
        await approvals_router.shutdown_approvals()
    except Exception as e:
        logger.warning(f"Approvals shutdown error: {e}")

    try:
        await audit_service.close()
    except Exception as e:
        logger.warning(f"Audit service shutdown error: {e}")

    if orchestrator:
        await orchestrator.cleanup()
    logger.info("✅ Shutdown complete")

# =============================================================================
# Create Application
# =============================================================================

app = FastAPI(
    title="AI Orchestration Layer",
    description="""
    Backend API for the AI Orchestration Monitor dashboard.

    Features:
    - Multi-model Orchestration (LangGraph)
    - Service Proxies (CloudApp, Petstore, Vehicles)
    - HITL Approvals
    - Observability & Metrics
    - Circuit Breakers & A/B Testing
    """,
    version="2.0.0",
    lifespan=lifespan,
    root_path="/ai"
)

# --- OpenTelemetry (opt-in via OTEL_ENABLED env var) ---
from observability.otel_setup import init_telemetry
init_telemetry(app)

# =============================================================================
# Middleware
# =============================================================================

# CORS
allowed_cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add request timing to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
    return response

# Error handling middleware
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred",
            "path": str(request.url)
        }
    )

# =============================================================================
# Include Routers
# =============================================================================

# 1. The Core AI Logic (Restored)
app.include_router(orchestration_router.router)


# 2. Operational/System Features
app.include_router(approvals_router.router)
app.include_router(metrics_router.router)
app.include_router(experiments_router.router)
app.include_router(system_router.router, prefix="/system")
app.include_router(tools_router.router)
app.include_router(conversation_sync.router)
app.include_router(rag_router.router)
app.include_router(llm_router.router)

# =============================================================================
# Root Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "AI Orchestration Layer",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "orchestrate": "/orchestrate",
            "cloudapp": "/cloudapp",
            "petstore": "/petstore",
            "vehicles": "/vehicles",
            "approvals": "/approvals",
            "metrics": "/metrics",
            "experiments": "/experiments"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import httpx

    services = {}

    # Check backend services
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in [
            ("cloudapp", settings.CLOUDAPP_URL),
            ("petstore", settings.PETSTORE_URL),
            ("vehicles", settings.VEHICLES_URL)
        ]:
            try:
                response = await client.get(f"{url}/actuator/health")
                if response.status_code == 200:
                    services[name] = "healthy"
                else:
                    services[name] = "degraded"
            except Exception:
                services[name] = "unavailable"

    # Check AI Core Health
    if orchestrator:
        services["orchestrator"] = "healthy"
    else:
        services["orchestrator"] = "initializing"

    # Overall status
    all_healthy = all(s == "healthy" for s in services.values())
    any_available = any(s != "unavailable" for s in services.values())

    return {
        "status": "healthy" if all_healthy else ("degraded" if any_available else "unhealthy"),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "services": services
    }

@app.get("/config")
async def get_config():
    """Get current configuration (non-sensitive)."""
    return {
        "debug": settings.DEBUG,
        "services": {
            "cloudapp": settings.CLOUDAPP_URL,
            "petstore": settings.PETSTORE_URL,
            "vehicles": settings.VEHICLES_URL,
            "ml_pipeline": settings.ML_URL
        },
        "cors_origins": settings.CORS_ORIGINS
    }
