"""
Experiments Router - A/B Testing and Experimentation Platform

FIXES APPLIED:
1. @validator → @field_validator (Pydantic v2)
2. .dict() → .model_dump() (Pydantic v2)
3. Removed @router.on_event("startup") - exported initialize_experiments() instead
"""

import logging
import os
import uuid
import hashlib
import math
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/experiments", tags=["A/B Testing"])


# =============================================================================
# Enums
# =============================================================================

class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    COMPLETED = "completed"


class VariantType(str, Enum):
    CONTROL = "control"
    TREATMENT = "treatment"


# =============================================================================
# Pydantic Models
# =============================================================================

class VariantConfig(BaseModel):
    name: str
    type: VariantType
    traffic_percentage: float = Field(ge=0, le=100)
    config: Dict[str, Any] = Field(default_factory=dict)


class VariantMetrics(BaseModel):
    name: str
    type: VariantType
    traffic_percentage: float
    impressions: int = 0
    conversions: int = 0
    conversion_rate: float = 0.0
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    total_latency_ms: float = 0.0
    error_count: int = 0
    lift_percentage: Optional[float] = None


class ExperimentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=1000)
    hypothesis: str = Field(max_length=500)
    metric: str = Field(default="conversion_rate")
    user_percentage: float = Field(default=100, ge=0, le=100)
    variants: List[VariantConfig]
    
    @field_validator('variants')
    @classmethod
    def validate_variants(cls, v: List[VariantConfig]) -> List[VariantConfig]:
        if len(v) < 2:
            raise ValueError("At least 2 variants required")
        
        has_control = any(var.type == VariantType.CONTROL for var in v)
        if not has_control:
            raise ValueError("At least one control variant required")
        
        total_traffic = sum(var.traffic_percentage for var in v)
        if abs(total_traffic - 100) > 0.01:
            raise ValueError(f"Traffic percentages must sum to 100 (got {total_traffic})")
        
        names = [var.name for var in v]
        if len(names) != len(set(names)):
            raise ValueError("Variant names must be unique")
        
        return v


class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hypothesis: Optional[str] = None


class Experiment(BaseModel):
    id: str
    name: str
    description: str
    hypothesis: str
    status: ExperimentStatus
    metric: str
    user_percentage: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    winner: Optional[str] = None
    statistical_significance: Optional[float] = None
    variants: Dict[str, VariantMetrics]
    created_at: str
    updated_at: str


class ExperimentListItem(BaseModel):
    id: str
    name: str
    description: str
    status: ExperimentStatus
    variants: int
    created_at: str


class VariantAssignment(BaseModel):
    experiment_id: str
    variant_name: str
    variant_config: Dict[str, Any]
    assigned: bool = True


class ConversionTrack(BaseModel):
    user_id: int


class LatencyTrack(BaseModel):
    user_id: int
    latency_ms: float


class ExperimentStats(BaseModel):
    total_experiments: int
    running: int
    completed: int
    draft: int
    total_impressions: int
    total_conversions: int
    avg_lift: float

class ImpressionTrack(BaseModel):
    """Request body for tracking impressions"""
    user_id: int


# =============================================================================
# Experiment Storage
# =============================================================================

class ExperimentStorage:
    """Experiment storage with optional MongoDB persistence."""
    
    def __init__(self):
        self._experiments: Dict[str, dict] = {}
        self._user_assignments: Dict[str, Dict[str, str]] = {}
        self._mongo_client = None
        self._use_mongo = False
        self._initialized = False
    
    async def initialize(self):
        """Initialize MongoDB connection if available."""
        if self._initialized:
            return
            
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            
            mongo_url = os.getenv("MONGODB_URL", "mongodb://mongodb-abtest:27017")
            max_pool_size = int(os.getenv("MONGODB_MAX_POOL_SIZE", "50"))
            min_pool_size = int(os.getenv("MONGODB_MIN_POOL_SIZE", "10"))
            server_selection_timeout = int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT", "5000"))
            self._mongo_client = AsyncIOMotorClient(
                mongo_url,
                maxPoolSize=max_pool_size,
                minPoolSize=min_pool_size,
                serverSelectionTimeoutMS=server_selection_timeout,
            )
            await self._mongo_client.admin.command('ping')
            self._db = self._mongo_client.ai_orchestration
            self._use_mongo = True
            
            # Load existing experiments
            async for exp in self._db.experiments.find():
                exp_id = exp.pop("_id")
                self._experiments[str(exp_id)] = exp
            
            logger.info(f"Experiment storage using MongoDB, loaded {len(self._experiments)} experiments")
        except Exception as e:
            logger.warning(f"MongoDB unavailable, using in-memory storage: {e}")
            self._use_mongo = False
        
        self._initialized = True
    
    async def create(self, experiment: dict) -> str:
        """Create a new experiment."""
        exp_id = f"exp_{uuid.uuid4().hex[:8]}"
        experiment["id"] = exp_id
        
        if self._use_mongo:
            await self._db.experiments.insert_one({"_id": exp_id, **experiment})
        
        self._experiments[exp_id] = experiment
        return exp_id
    
    async def get(self, exp_id: str) -> Optional[dict]:
        """Get an experiment by ID."""
        return self._experiments.get(exp_id)
    
    async def update(self, exp_id: str, updates: dict):
        """Update an experiment."""
        if exp_id not in self._experiments:
            return False
        
        self._experiments[exp_id].update(updates)
        self._experiments[exp_id]["updated_at"] = datetime.utcnow().isoformat() + "Z"
        
        if self._use_mongo:
            await self._db.experiments.update_one(
                {"_id": exp_id},
                {"$set": updates}
            )
        
        return True
    
    async def delete(self, exp_id: str) -> bool:
        """Delete an experiment."""
        if exp_id not in self._experiments:
            return False
        
        del self._experiments[exp_id]
        
        if self._use_mongo:
            await self._db.experiments.delete_one({"_id": exp_id})
        
        return True
    
    async def list_all(self) -> List[dict]:
        """List all experiments."""
        return list(self._experiments.values())
    
    def get_user_assignment(self, user_id: int, exp_id: str) -> Optional[str]:
        """Get user's variant assignment for an experiment."""
        user_key = str(user_id)
        return self._user_assignments.get(user_key, {}).get(exp_id)
    
    def set_user_assignment(self, user_id: int, exp_id: str, variant: str):
        """Set user's variant assignment."""
        user_key = str(user_id)
        if user_key not in self._user_assignments:
            self._user_assignments[user_key] = {}
        self._user_assignments[user_key][exp_id] = variant


# Global storage instance
storage = ExperimentStorage()


# =============================================================================
# Initialization Function (called from main.py lifespan)
# =============================================================================

async def initialize_experiments():
    """Initialize experiment storage. Called from main.py lifespan."""
    await storage.initialize()


# =============================================================================
# Statistical Functions
# =============================================================================

def calculate_statistical_significance(control: VariantMetrics, treatment: VariantMetrics) -> float:
    """Calculate statistical significance using z-test for proportions."""
    if control.impressions < 30 or treatment.impressions < 30:
        return 1.0
    
    p1 = control.conversion_rate / 100 if control.conversion_rate else 0
    p2 = treatment.conversion_rate / 100 if treatment.conversion_rate else 0
    n1 = control.impressions
    n2 = treatment.impressions
    
    if p1 == 0 and p2 == 0:
        return 1.0
    
    p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)
    
    if p_pool == 0 or p_pool == 1:
        return 1.0
    
    se = math.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
    
    if se == 0:
        return 1.0
    
    z = abs(p2 - p1) / se
    p_value = 2 * (1 - _norm_cdf(z))
    
    return round(p_value, 4)


def _norm_cdf(x: float) -> float:
    """Approximate normal CDF."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def calculate_lift(control_rate: float, treatment_rate: float) -> Optional[float]:
    """Calculate lift percentage."""
    if control_rate == 0:
        return None
    return round((treatment_rate - control_rate) / control_rate * 100, 2)


# =============================================================================
# Helper to ensure initialization
# =============================================================================

async def _ensure_initialized():
    """Ensure storage is initialized before operations."""
    if not storage._initialized:
        await storage.initialize()


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("", response_model=Experiment)
async def create_experiment(request: ExperimentCreate):
    """Create a new experiment."""
    await _ensure_initialized()
    
    now = datetime.utcnow().isoformat() + "Z"
    
    variants = {}
    for var in request.variants:
        variants[var.name] = VariantMetrics(
            name=var.name,
            type=var.type,
            traffic_percentage=var.traffic_percentage,
            impressions=0,
            conversions=0,
            conversion_rate=0.0,
            avg_latency_ms=0.0,
            error_rate=0.0
        ).model_dump()
        variants[var.name]["config"] = var.config
    
    experiment = {
        "name": request.name,
        "description": request.description,
        "hypothesis": request.hypothesis,
        "status": ExperimentStatus.DRAFT.value,
        "metric": request.metric,
        "user_percentage": request.user_percentage,
        "start_date": None,
        "end_date": None,
        "winner": None,
        "statistical_significance": None,
        "variants": variants,
        "created_at": now,
        "updated_at": now
    }
    
    exp_id = await storage.create(experiment)
    experiment["id"] = exp_id
    
    return Experiment(**experiment)


@router.get("", response_model=List[ExperimentListItem])
async def list_experiments(
    status: Optional[ExperimentStatus] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """List all experiments."""
    await _ensure_initialized()
        
    experiments = await storage.list_all()
    
    if status:
        experiments = [e for e in experiments if e["status"] == status.value]
    
    experiments.sort(key=lambda x: x["created_at"], reverse=True)
    
    return [
        ExperimentListItem(
            id=e["id"],
            name=e["name"],
            description=e["description"],
            status=e["status"],
            variants=len(e["variants"]),
            created_at=e["created_at"]
        )
        for e in experiments[:limit]
    ]


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str):
    """Get experiment details."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return Experiment(**experiment)


@router.put("/{experiment_id}", response_model=Experiment)
async def update_experiment(experiment_id: str, request: ExperimentUpdate):
    """Update experiment metadata."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] not in [ExperimentStatus.DRAFT.value]:
        raise HTTPException(
            status_code=400,
            detail="Can only update experiments in draft status"
        )
    
    updates = request.model_dump(exclude_unset=True)
    await storage.update(experiment_id, updates)
    
    experiment = await storage.get(experiment_id)
    return Experiment(**experiment)


@router.delete("/{experiment_id}")
async def delete_experiment(experiment_id: str):
    """Delete an experiment."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] == ExperimentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete running experiment. Stop it first."
        )
    
    await storage.delete(experiment_id)
    return {"status": "success", "message": f"Experiment {experiment_id} deleted"}


# =============================================================================
# Lifecycle Endpoints
# =============================================================================

@router.post("/{experiment_id}/start", response_model=Experiment)
async def start_experiment(experiment_id: str):
    """Start an experiment."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] not in [ExperimentStatus.DRAFT.value, ExperimentStatus.PAUSED.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start experiment in {experiment['status']} status"
        )
    
    updates = {
        "status": ExperimentStatus.RUNNING.value,
        "start_date": experiment.get("start_date") or datetime.utcnow().isoformat() + "Z"
    }
    await storage.update(experiment_id, updates)
    
    experiment = await storage.get(experiment_id)
    return Experiment(**experiment)


@router.post("/{experiment_id}/pause", response_model=Experiment)
async def pause_experiment(experiment_id: str):
    """Pause an experiment."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] != ExperimentStatus.RUNNING.value:
        raise HTTPException(
            status_code=400,
            detail="Can only pause running experiments"
        )
    
    await storage.update(experiment_id, {"status": ExperimentStatus.PAUSED.value})
    
    experiment = await storage.get(experiment_id)
    return Experiment(**experiment)


@router.post("/{experiment_id}/stop", response_model=Experiment)
async def stop_experiment(experiment_id: str):
    """Stop an experiment and determine winner."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] not in [ExperimentStatus.RUNNING.value, ExperimentStatus.PAUSED.value]:
        raise HTTPException(
            status_code=400,
            detail="Can only stop running or paused experiments"
        )
    
    variants = experiment["variants"]
    control = None
    best_treatment = None
    best_rate = -1
    
    for name, var in variants.items():
        if var["type"] == VariantType.CONTROL.value:
            control = VariantMetrics(**var)
        elif var["conversion_rate"] > best_rate:
            best_rate = var["conversion_rate"]
            best_treatment = VariantMetrics(**var)
    
    winner = None
    significance = None
    
    if control and best_treatment:
        significance = calculate_statistical_significance(control, best_treatment)
        if significance < 0.05 and best_treatment.conversion_rate > control.conversion_rate:
            winner = best_treatment.name
        elif significance < 0.05:
            winner = control.name
    
    updates = {
        "status": ExperimentStatus.COMPLETED.value,
        "end_date": datetime.utcnow().isoformat() + "Z",
        "winner": winner,
        "statistical_significance": significance
    }
    await storage.update(experiment_id, updates)
    
    experiment = await storage.get(experiment_id)
    return Experiment(**experiment)


# =============================================================================
# Variant Assignment
# =============================================================================

@router.get("/{experiment_id}/variant/{user_id}", response_model=VariantAssignment)
async def get_variant(experiment_id: str, user_id: int):
    """Get variant assignment for a user."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment["status"] != ExperimentStatus.RUNNING.value:
        return VariantAssignment(
            experiment_id=experiment_id,
            variant_name="",
            variant_config={},
            assigned=False
        )
    
    existing = storage.get_user_assignment(user_id, experiment_id)
    if existing and existing in experiment["variants"]:
        variant = experiment["variants"][existing]
        return VariantAssignment(
            experiment_id=experiment_id,
            variant_name=existing,
            variant_config=variant.get("config", {}),
            assigned=True
        )
    
    user_hash = int(hashlib.md5(f"{experiment_id}:{user_id}".encode()).hexdigest(), 16)
    if (user_hash % 100) >= experiment["user_percentage"]:
        return VariantAssignment(
            experiment_id=experiment_id,
            variant_name="",
            variant_config={},
            assigned=False
        )
    
    random_value = (user_hash % 10000) / 100
    cumulative = 0.0
    assigned_variant = None
    
    for name, var in experiment["variants"].items():
        cumulative += var["traffic_percentage"]
        if random_value < cumulative:
            assigned_variant = name
            break
    
    if not assigned_variant:
        assigned_variant = list(experiment["variants"].keys())[0]
    
    storage.set_user_assignment(user_id, experiment_id, assigned_variant)
    
    experiment["variants"][assigned_variant]["impressions"] += 1
    await storage.update(experiment_id, {"variants": experiment["variants"]})
    
    variant = experiment["variants"][assigned_variant]
    return VariantAssignment(
        experiment_id=experiment_id,
        variant_name=assigned_variant,
        variant_config=variant.get("config", {}),
        assigned=True
    )


# =============================================================================
# Tracking Endpoints
# =============================================================================

@router.post("/{experiment_id}/track/conversion")
async def track_conversion(experiment_id: str, request: ConversionTrack):
    """Track a conversion for a user."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    variant_name = storage.get_user_assignment(request.user_id, experiment_id)
    if not variant_name:
        return {"tracked": False, "reason": "User not assigned to variant"}
    
    variant = experiment["variants"][variant_name]
    variant["conversions"] += 1
    
    if variant["impressions"] > 0:
        variant["conversion_rate"] = round(
            variant["conversions"] / variant["impressions"] * 100, 2
        )
    
    control_variant = None
    for name, var in experiment["variants"].items():
        if var["type"] == VariantType.CONTROL.value:
            control_variant = var
            break
    
    if control_variant and variant["type"] == VariantType.TREATMENT.value:
        variant["lift_percentage"] = calculate_lift(
            control_variant["conversion_rate"],
            variant["conversion_rate"]
        )
    
    await storage.update(experiment_id, {"variants": experiment["variants"]})
    
    return {"tracked": True, "variant": variant_name}


@router.post("/{experiment_id}/track/latency")
async def track_latency(experiment_id: str, request: LatencyTrack):
    """Track latency for a user."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    variant_name = storage.get_user_assignment(request.user_id, experiment_id)
    if not variant_name:
        return {"tracked": False, "reason": "User not assigned to variant"}
    
    variant = experiment["variants"][variant_name]
    variant["total_latency_ms"] = variant.get("total_latency_ms", 0) + request.latency_ms
    
    if variant["impressions"] > 0:
        variant["avg_latency_ms"] = round(
            variant["total_latency_ms"] / variant["impressions"], 2
        )
    
    await storage.update(experiment_id, {"variants": experiment["variants"]})
    
    return {"tracked": True, "variant": variant_name}


@router.post("/{experiment_id}/track/error")
async def track_error(experiment_id: str, request: ConversionTrack):
    """Track an error for a user."""
    await _ensure_initialized()
        
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    variant_name = storage.get_user_assignment(request.user_id, experiment_id)
    if not variant_name:
        return {"tracked": False, "reason": "User not assigned to variant"}
    
    variant = experiment["variants"][variant_name]
    variant["error_count"] = variant.get("error_count", 0) + 1
    
    if variant["impressions"] > 0:
        variant["error_rate"] = round(
            variant["error_count"] / variant["impressions"] * 100, 2
        )
    
    await storage.update(experiment_id, {"variants": experiment["variants"]})
    
    return {"tracked": True, "variant": variant_name}

@router.post("/{experiment_id}/track/impression")
async def track_impression(experiment_id: str, request: ImpressionTrack):
    """
    Track an impression for a user in an experiment.
    
    This endpoint is used to record when a user sees an experiment variant,
    separate from variant assignment. Useful for tracking actual exposure
    vs just assignment.
    
    Args:
        experiment_id: The experiment identifier
        request: Contains the user_id to track
    
    Returns:
        Tracking confirmation with variant information
    """
    await _ensure_initialized()
    
    experiment = await storage.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Check if experiment is running
    if experiment["status"] != ExperimentStatus.RUNNING.value:
        return {
            "tracked": False,
            "reason": f"Experiment is not running (status: {experiment['status']})"
        }
    
    # Get the user's variant assignment
    variant_name = storage.get_user_assignment(request.user_id, experiment_id)
    if not variant_name:
        return {
            "tracked": False,
            "reason": "User not assigned to any variant"
        }
    
    # Verify variant exists
    if variant_name not in experiment["variants"]:
        return {
            "tracked": False,
            "reason": f"Variant '{variant_name}' not found in experiment"
        }
    
    # Increment impression count
    variant = experiment["variants"][variant_name]
    variant["impressions"] += 1
    
    # Recalculate conversion rate
    if variant["impressions"] > 0:
        variant["conversion_rate"] = round(
            variant["conversions"] / variant["impressions"] * 100, 2
        )
    
    # Recalculate lift for treatment variants
    control_variant = None
    for name, var in experiment["variants"].items():
        if var["type"] == VariantType.CONTROL.value:
            control_variant = var
            break
    
    if control_variant and variant["type"] == VariantType.TREATMENT.value:
        variant["lift_percentage"] = calculate_lift(
            control_variant["conversion_rate"],
            variant["conversion_rate"]
        )
    
    # Persist the update
    await storage.update(experiment_id, {"variants": experiment["variants"]})
    
    return {
        "tracked": True,
        "variant": variant_name,
        "impressions": variant["impressions"],
        "conversion_rate": variant["conversion_rate"]
    }


# =============================================================================
# Statistics Endpoint
# =============================================================================

@router.get("/stats/summary", response_model=ExperimentStats)
async def get_experiment_stats():
    """Get overall experiment statistics."""
    await _ensure_initialized()
        
    experiments = await storage.list_all()
    
    total_impressions = 0
    total_conversions = 0
    lifts = []
    
    status_counts = {s.value: 0 for s in ExperimentStatus}
    
    for exp in experiments:
        status_counts[exp["status"]] += 1
        
        for var in exp["variants"].values():
            total_impressions += var.get("impressions", 0)
            total_conversions += var.get("conversions", 0)
            if var.get("lift_percentage") is not None:
                lifts.append(var["lift_percentage"])
    
    return ExperimentStats(
        total_experiments=len(experiments),
        running=status_counts[ExperimentStatus.RUNNING.value],
        completed=status_counts[ExperimentStatus.COMPLETED.value],
        draft=status_counts[ExperimentStatus.DRAFT.value],
        total_impressions=total_impressions,
        total_conversions=total_conversions,
        avg_lift=round(sum(lifts) / len(lifts), 2) if lifts else 0
    )


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check():
    """Check experiments system health."""
    await _ensure_initialized()
        
    experiments = await storage.list_all()
    running = sum(1 for e in experiments if e["status"] == ExperimentStatus.RUNNING.value)
    
    return {
        "status": "healthy",
        "service": "experiments",
        "storage": "mongodb" if storage._use_mongo else "memory",
        "total_experiments": len(experiments),
        "running_experiments": running
    }
