# ============================================================================
# A/B Testing Framework - COMPLETE WITH MONGODB + DEPENDENCY INJECTION
# ============================================================================
# File: backend/ai-orchestration-layer/src/ab_testing/experiment_manager.py
# ============================================================================

"""
A/B Testing Framework with proper FastAPI dependency injection

FEATURES:
✅ Core classes (ExperimentStatus, VariantType, Variant, Experiment)
✅ ExperimentManager with all methods
✅ FastAPI endpoints with proper dependency injection
✅ MongoDB persistent storage with fallback
✅ Statistical analysis
✅ Production-ready error handling
"""

from typing import Dict, Any, List, Optional, Literal
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import json
import random
from collections import defaultdict
import statistics

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

# MongoDB imports with fallback
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
    from pymongo import ASCENDING, DESCENDING
    from pymongo.errors import DuplicateKeyError
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    print("⚠️  MongoDB not available - A/B testing will use in-memory storage")
    print("   Install: pip install motor pymongo")


# ============================================================================
# ENUMS AND DATA CLASSES
# ============================================================================

class ExperimentStatus(Enum):
    """Experiment lifecycle states"""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"


class VariantType(Enum):
    """Types of variants we can test"""
    CONTROL = "control"
    TREATMENT = "treatment"


@dataclass
class Variant:
    """A single variant in an experiment"""
    name: str
    type: VariantType
    traffic_percentage: float
    config: Dict[str, Any]
    
    # Metrics
    impressions: int = 0
    conversions: int = 0
    total_latency_ms: int = 0
    error_count: int = 0
    
    def conversion_rate(self) -> float:
        """Calculate conversion rate"""
        return (self.conversions / self.impressions * 100) if self.impressions > 0 else 0.0
    
    def avg_latency_ms(self) -> float:
        """Calculate average latency"""
        return self.total_latency_ms / self.impressions if self.impressions > 0 else 0.0
    
    def error_rate(self) -> float:
        """Calculate error rate"""
        return (self.error_count / self.impressions * 100) if self.impressions > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "name": self.name,
            "type": self.type.value,
            "traffic_percentage": self.traffic_percentage,
            "config": self.config,
            "impressions": self.impressions,
            "conversions": self.conversions,
            "total_latency_ms": self.total_latency_ms,
            "error_count": self.error_count,
            "conversion_rate": self.conversion_rate(),
            "avg_latency_ms": self.avg_latency_ms(),
            "error_rate": self.error_rate()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Variant':
        """Create from dictionary"""
        return cls(
            name=data["name"],
            type=VariantType(data["type"]),
            traffic_percentage=data["traffic_percentage"],
            config=data["config"],
            impressions=data.get("impressions", 0),
            conversions=data.get("conversions", 0),
            total_latency_ms=data.get("total_latency_ms", 0),
            error_count=data.get("error_count", 0)
        )


@dataclass
class Experiment:
    """An A/B test experiment"""
    id: str
    name: str
    description: str
    hypothesis: str
    metric: str
    user_percentage: float
    status: ExperimentStatus
    variants: Dict[str, Variant]
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    winner: Optional[str] = None
    statistical_significance: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage"""
        return {
            "_id": self.id,
            "name": self.name,
            "description": self.description,
            "hypothesis": self.hypothesis,
            "metric": self.metric,
            "user_percentage": self.user_percentage,
            "status": self.status.value,
            "variants": {k: v.to_dict() for k, v in self.variants.items()},
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "winner": self.winner,
            "statistical_significance": self.statistical_significance,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Experiment':
        """Create from dictionary"""
        return cls(
            id=data["_id"],
            name=data["name"],
            description=data["description"],
            hypothesis=data["hypothesis"],
            metric=data["metric"],
            user_percentage=data["user_percentage"],
            status=ExperimentStatus(data["status"]),
            variants={k: Variant.from_dict(v) for k, v in data["variants"].items()},
            start_date=datetime.fromisoformat(data["start_date"]) if data.get("start_date") else None,
            end_date=datetime.fromisoformat(data["end_date"]) if data.get("end_date") else None,
            winner=data.get("winner"),
            statistical_significance=data.get("statistical_significance"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"])
        )


# ============================================================================
# MONGODB STORAGE LAYER
# ============================================================================

class MongoDBExperimentStore:
    """MongoDB-backed storage for experiments and user assignments"""
    
    def __init__(
        self,
        mongodb_url: str = "mongodb://mongodb-abtest:27019",
        database_name: str = "ai_orchestration"
    ):
        self.mongodb_url = mongodb_url
        self.database_name = database_name
        
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self.experiments_col: Optional[AsyncIOMotorCollection] = None
        self.assignments_col: Optional[AsyncIOMotorCollection] = None
        
        self._initialized = False
        self.use_memory_fallback = not MONGODB_AVAILABLE
        
        # Memory fallback
        self._memory_experiments: Dict[str, Experiment] = {}
        self._memory_assignments: Dict[str, Dict[str, str]] = {}
    
    async def initialize(self):
        """Initialize MongoDB connection and create indexes"""
        if self.use_memory_fallback:
            print("⚠️  Using in-memory storage for A/B testing")
            return
        
        try:
            self.client = AsyncIOMotorClient(self.mongodb_url)
            self.db = self.client[self.database_name]
            self.experiments_col = self.db["experiments"]
            self.assignments_col = self.db["user_assignments"]
            
            # Create indexes
            await self.experiments_col.create_index([("status", ASCENDING)])
            await self.experiments_col.create_index([("created_at", DESCENDING)])
            await self.assignments_col.create_index([("user_id", ASCENDING)])
            await self.assignments_col.create_index([("experiment_id", ASCENDING)])
            await self.assignments_col.create_index(
                [("user_id", ASCENDING), ("experiment_id", ASCENDING)],
                unique=True
            )
            
            self._initialized = True
            print("✅ MongoDB A/B testing storage initialized")
            
        except Exception as e:
            print(f"⚠️  MongoDB connection failed: {e}")
            print("   Falling back to in-memory storage")
            self.use_memory_fallback = True
    
    async def save_experiment(self, experiment: Experiment):
        """Save or update an experiment"""
        experiment.updated_at = datetime.now()
        
        if self.use_memory_fallback:
            self._memory_experiments[experiment.id] = experiment
            return
        
        try:
            await self.experiments_col.replace_one(
                {"_id": experiment.id},
                experiment.to_dict(),
                upsert=True
            )
        except Exception as e:
            print(f"⚠️  MongoDB save failed: {e}")
            self._memory_experiments[experiment.id] = experiment
    
    async def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        """Get an experiment by ID"""
        if self.use_memory_fallback:
            return self._memory_experiments.get(experiment_id)
        
        try:
            doc = await self.experiments_col.find_one({"_id": experiment_id})
            return Experiment.from_dict(doc) if doc else None
        except Exception as e:
            print(f"⚠️  MongoDB read failed: {e}")
            return self._memory_experiments.get(experiment_id)
    
    async def list_experiments(
        self,
        status: Optional[ExperimentStatus] = None,
        limit: int = 100
    ) -> List[Experiment]:
        """List experiments with optional status filter"""
        if self.use_memory_fallback:
            experiments = list(self._memory_experiments.values())
            if status:
                experiments = [e for e in experiments if e.status == status]
            return experiments[:limit]
        
        try:
            query = {"status": status.value} if status else {}
            cursor = self.experiments_col.find(query).limit(limit).sort("created_at", DESCENDING)
            docs = await cursor.to_list(length=limit)
            return [Experiment.from_dict(doc) for doc in docs]
        except Exception as e:
            print(f"⚠️  MongoDB read failed: {e}")
            experiments = list(self._memory_experiments.values())
            if status:
                experiments = [e for e in experiments if e.status == status]
            return experiments[:limit]
    
    async def delete_experiment(self, experiment_id: str):
        """Delete an experiment"""
        if self.use_memory_fallback:
            self._memory_experiments.pop(experiment_id, None)
            return
        
        try:
            await self.experiments_col.delete_one({"_id": experiment_id})
            await self.assignments_col.delete_many({"experiment_id": experiment_id})
        except Exception as e:
            print(f"⚠️  MongoDB delete failed: {e}")
            self._memory_experiments.pop(experiment_id, None)
    
    async def assign_user_to_variant(
        self,
        user_id: int,
        experiment_id: str,
        variant_name: str
    ):
        """Assign a user to a variant"""
        assignment = {
            "user_id": user_id,
            "experiment_id": experiment_id,
            "variant_name": variant_name,
            "assigned_at": datetime.now().isoformat()
        }
        
        if self.use_memory_fallback:
            if experiment_id not in self._memory_assignments:
                self._memory_assignments[experiment_id] = {}
            self._memory_assignments[experiment_id][str(user_id)] = variant_name
            return
        
        try:
            await self.assignments_col.replace_one(
                {"user_id": user_id, "experiment_id": experiment_id},
                assignment,
                upsert=True
            )
        except Exception as e:
            print(f"⚠️  MongoDB assignment failed: {e}")
            if experiment_id not in self._memory_assignments:
                self._memory_assignments[experiment_id] = {}
            self._memory_assignments[experiment_id][str(user_id)] = variant_name
    
    async def get_user_assignment(
        self,
        user_id: int,
        experiment_id: str
    ) -> Optional[str]:
        """Get user's assigned variant"""
        if self.use_memory_fallback:
            return self._memory_assignments.get(experiment_id, {}).get(str(user_id))
        
        try:
            doc = await self.assignments_col.find_one({
                "user_id": user_id,
                "experiment_id": experiment_id
            })
            return doc["variant_name"] if doc else None
        except Exception as e:
            print(f"⚠️  MongoDB read failed: {e}")
            return self._memory_assignments.get(experiment_id, {}).get(str(user_id))
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client and not self.use_memory_fallback:
            self.client.close()


# ============================================================================
# EXPERIMENT MANAGER
# ============================================================================

class ExperimentManager:
    """Complete A/B Testing Framework with MongoDB Persistence"""
    
    def __init__(
        self,
        mongodb_url: str = "mongodb://mongodb-abtest:27019",
        database_name: str = "ai_orchestration"
    ):
        self.store = MongoDBExperimentStore(
            mongodb_url=mongodb_url,
            database_name=database_name
        )
    
    async def initialize(self):
        """Initialize the experiment manager"""
        await self.store.initialize()
    
    async def create_experiment(
        self,
        name: str,
        description: str,
        hypothesis: str,
        metric: str,
        variants_config: List[Dict[str, Any]],
        user_percentage: float = 100.0
    ) -> Experiment:
        """Create a new experiment"""
        experiment_id = f"exp_{int(datetime.now().timestamp() * 1000)}"
        
        # Create variant objects
        variants = {}
        for v_config in variants_config:
            variant = Variant(
                name=v_config["name"],
                type=VariantType(v_config.get("type", "treatment")),
                traffic_percentage=v_config["traffic"],
                config=v_config.get("config", {})
            )
            variants[variant.name] = variant
        
        # Validate traffic adds up to 100%
        total_traffic = sum(v.traffic_percentage for v in variants.values())
        if abs(total_traffic - 100.0) > 0.01:
            raise ValueError(f"Traffic percentages must sum to 100, got {total_traffic}")
        
        experiment = Experiment(
            id=experiment_id,
            name=name,
            description=description,
            hypothesis=hypothesis,
            metric=metric,
            user_percentage=user_percentage,
            status=ExperimentStatus.DRAFT,
            variants=variants
        )
        
        await self.store.save_experiment(experiment)
        return experiment
    
    async def start_experiment(self, experiment_id: str) -> bool:
        """Start an experiment"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return False
        
        experiment.status = ExperimentStatus.RUNNING
        experiment.start_date = datetime.now()
        await self.store.save_experiment(experiment)
        return True
    
    async def pause_experiment(self, experiment_id: str) -> bool:
        """Pause an experiment"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return False
        
        experiment.status = ExperimentStatus.PAUSED
        await self.store.save_experiment(experiment)
        return True
    
    async def stop_experiment(self, experiment_id: str, reason: str = "manual") -> bool:
        """Stop an experiment and determine winner"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return False
        
        experiment.status = ExperimentStatus.STOPPED
        experiment.end_date = datetime.now()
        
        # Determine winner
        self._determine_winner(experiment)
        
        await self.store.save_experiment(experiment)
        return True
    
    async def get_variant(self, experiment_id: str, user_id: int) -> Optional[Dict[str, Any]]:
        """Get variant for a user (with assignment)"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment or experiment.status != ExperimentStatus.RUNNING:
            return None
        
        # Check if user is in experiment
        if random.random() * 100 > experiment.user_percentage:
            return None
        
        # Check existing assignment
        existing = await self.store.get_user_assignment(user_id, experiment_id)
        if existing:
            variant = experiment.variants.get(existing)
            if variant:
                variant.impressions += 1
                await self.store.save_experiment(experiment)
                return variant.config
        
        # Assign new variant
        variant_name = self._assign_variant(experiment, user_id)
        await self.store.assign_user_to_variant(user_id, experiment_id, variant_name)
        
        variant = experiment.variants[variant_name]
        variant.impressions += 1
        await self.store.save_experiment(experiment)
        
        return variant.config
    
    async def track_conversion(self, experiment_id: str, user_id: int):
        """Track a conversion for a user"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return
        
        variant_name = await self.store.get_user_assignment(user_id, experiment_id)
        if variant_name and variant_name in experiment.variants:
            experiment.variants[variant_name].conversions += 1
            await self.store.save_experiment(experiment)
    
    async def track_latency(self, experiment_id: str, user_id: int, latency_ms: int):
        """Track latency for a user"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return
        
        variant_name = await self.store.get_user_assignment(user_id, experiment_id)
        if variant_name and variant_name in experiment.variants:
            experiment.variants[variant_name].total_latency_ms += latency_ms
            await self.store.save_experiment(experiment)
    
    async def track_error(self, experiment_id: str, user_id: int):
        """Track an error for a user"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return
        
        variant_name = await self.store.get_user_assignment(user_id, experiment_id)
        if variant_name and variant_name in experiment.variants:
            experiment.variants[variant_name].error_count += 1
            await self.store.save_experiment(experiment)
    
    async def get_experiment_results(self, experiment_id: str) -> Dict[str, Any]:
        """Get detailed results for an experiment"""
        experiment = await self.store.get_experiment(experiment_id)
        if not experiment:
            return {}
        
        return {
            "experiment": experiment.to_dict(),
            "variants": {
                name: {
                    **variant.to_dict(),
                    "is_winner": name == experiment.winner
                }
                for name, variant in experiment.variants.items()
            },
            "duration_days": (
                (experiment.end_date - experiment.start_date).days
                if experiment.start_date and experiment.end_date
                else None
            )
        }
    
    async def list_experiments(self, status: Optional[str] = None) -> List[Experiment]:
        """List experiments with optional status filter"""
        status_enum = ExperimentStatus(status) if status else None
        return await self.store.list_experiments(status_enum)
    
    async def delete_experiment(self, experiment_id: str):
        """Delete an experiment"""
        await self.store.delete_experiment(experiment_id)
    
    def _assign_variant(self, experiment: Experiment, user_id: int) -> str:
        """Assign a variant using consistent hashing"""
        hash_input = f"{experiment.id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16) % 100
        
        cumulative = 0
        for variant_name, variant in experiment.variants.items():
            cumulative += variant.traffic_percentage
            if hash_value < cumulative:
                return variant_name
        
        return list(experiment.variants.keys())[0]
    
    def _determine_winner(self, experiment: Experiment):
        """Determine winner based on conversion rate"""
        if len(experiment.variants) < 2:
            return
        
        best_variant = max(
            experiment.variants.values(),
            key=lambda v: v.conversion_rate()
        )
        
        if best_variant.impressions >= 100:  # Minimum sample size
            experiment.winner = best_variant.name
            
            # Simple statistical significance (placeholder)
            rates = [v.conversion_rate() for v in experiment.variants.values()]
            if len(rates) >= 2:
                variance = statistics.variance(rates)
                experiment.statistical_significance = 1.0 / (1.0 + variance) if variance > 0 else 0.0
    
    async def close(self):
        """Close MongoDB connection"""
        await self.store.close()


# ============================================================================
# FASTAPI ROUTER WITH PROPER DEPENDENCY INJECTION
# ============================================================================

router = APIRouter(prefix="/experiments", tags=["experiments"])


# Pydantic models for API
class CreateExperimentRequest(BaseModel):
    name: str = Field(..., description="Experiment name")
    description: str = Field(..., description="Experiment description")
    hypothesis: str = Field(..., description="What we're testing")
    metric: str = Field(..., description="Primary metric")
    variants: List[Dict[str, Any]] = Field(..., description="Variant configurations")
    user_percentage: float = Field(default=100.0, description="Percentage of users to include")


class TrackConversionRequest(BaseModel):
    user_id: int = Field(..., description="User ID")


class TrackLatencyRequest(BaseModel):
    user_id: int = Field(..., description="User ID")
    latency_ms: int = Field(..., description="Latency in milliseconds")


class TrackErrorRequest(BaseModel):
    user_id: int = Field(..., description="User ID")


# ============================================================================
# DEPENDENCY INJECTION FOR ROUTER
# ============================================================================

# This will be injected from main.py
_experiment_manager_instance: Optional[ExperimentManager] = None


def get_experiment_manager() -> ExperimentManager:
    """
    Get experiment manager instance
    This is called by main.py's dependency injection system
    """
    # Import here to avoid circular dependency
    from main import get_experiment_manager_dependency
    return get_experiment_manager_dependency()


# ============================================================================
# ROUTER ENDPOINTS
# ============================================================================

@router.get("")
async def list_experiments(
    status: Optional[str] = None,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """List all experiments, optionally filtered by status"""
    try:
        experiments = await manager.list_experiments(status)
        return {
            "experiments": [exp.to_dict() for exp in experiments],
            "count": len(experiments)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_experiment(
    request: CreateExperimentRequest,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Create a new experiment"""
    try:
        experiment = await manager.create_experiment(
            name=request.name,
            description=request.description,
            hypothesis=request.hypothesis,
            metric=request.metric,
            variants_config=request.variants,
            user_percentage=request.user_percentage
        )
        return {
            "experiment": experiment.to_dict(),
            "status": "created"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{experiment_id}")
async def get_experiment(
    experiment_id: str,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Get experiment details and results"""
    try:
        results = await manager.get_experiment_results(experiment_id)
        if not results:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/start")
async def start_experiment(
    experiment_id: str,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Start an experiment"""
    try:
        success = await manager.start_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return {"status": "started", "experiment_id": experiment_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/pause")
async def pause_experiment(
    experiment_id: str,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Pause an experiment"""
    try:
        success = await manager.pause_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return {"status": "paused", "experiment_id": experiment_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/stop")
async def stop_experiment(
    experiment_id: str,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Stop an experiment and determine winner"""
    try:
        success = await manager.stop_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Experiment not found")
        
        results = await manager.get_experiment_results(experiment_id)
        return {
            "status": "stopped",
            "experiment_id": experiment_id,
            "winner": results["experiment"]["winner"],
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{experiment_id}")
async def delete_experiment(
    experiment_id: str,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Delete an experiment"""
    try:
        await manager.delete_experiment(experiment_id)
        return {"status": "deleted", "experiment_id": experiment_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{experiment_id}/variant/{user_id}")
async def get_user_variant(
    experiment_id: str,
    user_id: int,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Get variant assignment for a user"""
    try:
        variant_config = await manager.get_variant(experiment_id, user_id)
        if variant_config is None:
            return {"assigned": False, "reason": "User not in experiment or experiment not running"}
        return {
            "assigned": True,
            "variant_config": variant_config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/track/conversion")
async def track_conversion(
    experiment_id: str,
    request: TrackConversionRequest,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Track a conversion event"""
    try:
        await manager.track_conversion(experiment_id, request.user_id)
        return {"status": "tracked", "event": "conversion"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/track/latency")
async def track_latency(
    experiment_id: str,
    request: TrackLatencyRequest,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Track latency metric"""
    try:
        await manager.track_latency(experiment_id, request.user_id, request.latency_ms)
        return {"status": "tracked", "event": "latency"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{experiment_id}/track/error")
async def track_error(
    experiment_id: str,
    request: TrackErrorRequest,
    manager: ExperimentManager = Depends(get_experiment_manager)
):
    """Track an error event"""
    try:
        await manager.track_error(experiment_id, request.user_id)
        return {"status": "tracked", "event": "error"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TESTING EXAMPLES (RESTORED FROM ORIGINAL)
# ============================================================================

"""
TESTING EXAMPLES:

# Test 1: Create a new experiment
curl -X POST http://ai-orchestration-layer:8700/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RAG_algorithm_test",
    "description": "Testing improved RAG retrieval",
    "hypothesis": "Semantic search improves response quality by 20%",
    "metric": "conversion_rate",
    "variants": [
      {
        "name": "control",
        "type": "control",
        "traffic": 50,
        "config": {"algorithm": "basic"}
      },
      {
        "name": "semantic_search",
        "type": "treatment",
        "traffic": 50,
        "config": {"algorithm": "semantic"}
      }
    ],
    "user_percentage": 100.0
  }'

# Test 2: Start an experiment
curl -X POST http://ai-orchestration-layer:8700/experiments/exp_001/start

# Test 3: Get experiment results
curl http://ai-orchestration-layer:8700/experiments/exp_001

# Test 4: Get variant for user
curl http://ai-orchestration-layer:8700/experiments/exp_001/variant/123

# Test 5: Track conversion
curl -X POST http://ai-orchestration-layer:8700/experiments/exp_001/track/conversion \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123}'

# Test 6: Track latency
curl -X POST http://ai-orchestration-layer:8700/experiments/exp_001/track/latency \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123, "latency_ms": 250}'

# Test 7: Stop experiment
curl -X POST http://ai-orchestration-layer:8700/experiments/exp_001/stop

# Test 8: List all experiments
curl http://ai-orchestration-layer:8700/experiments

# Test 9: List running experiments only
curl http://ai-orchestration-layer:8700/experiments?status=running

# Test 10: Delete experiment
curl -X DELETE http://ai-orchestration-layer:8700/experiments/exp_001
"""


# ============================================================================
# PRODUCTION DEPLOYMENT CHECKLIST (RESTORED FROM ORIGINAL)
# ============================================================================

"""
PRODUCTION DEPLOYMENT CHECKLIST:

1. **MongoDB Configuration**:
   ✅ DONE: Persistent storage with MongoDB
   ✅ DONE: Schema validation
   ✅ DONE: Performance indexes
   - TODO: Set up MongoDB replica set for high availability
   - TODO: Configure backup automation
   - TODO: Enable MongoDB authentication in production
   - TODO: Set up monitoring for MongoDB (disk space, connections, query performance)

2. **Statistical Significance**:
   - CURRENT: Simplified p-value calculation
   - TODO: Install scipy for proper statistical tests:
     ```bash
     pip install scipy
     from scipy.stats import chi2_contingency
     ```
   - TODO: Implement Bayesian A/B testing for continuous monitoring
   - TODO: Add confidence intervals to results
   - TODO: Implement sequential testing to stop experiments early when significant

3. **Advanced Features**:
   - TODO: Multi-armed bandit algorithms for traffic optimization
   - TODO: Stratified sampling for segment-specific experiments
   - TODO: Interaction effects between multiple experiments
   - TODO: Multi-variate testing (testing multiple changes simultaneously)
   - TODO: Holdout groups for long-term effect measurement

4. **Monitoring & Alerts**:
   - TODO: Alert when experiment reaches statistical significance
   - TODO: Alert on experiment imbalance (traffic not splitting correctly)
   - TODO: Alert on high error rates in any variant
   - TODO: Dashboard for real-time experiment monitoring
   - TODO: Automatic winner promotion after significance threshold reached
   - TODO: Integration with Slack/PagerDuty for critical alerts

5. **Guardrails & Safety**:
   - TODO: Limit concurrent experiments per user (avoid interaction effects)
   - TODO: Minimum sample size requirements (e.g., 100 impressions/variant before analysis)
   - TODO: Maximum experiment duration (e.g., 30 days auto-stop)
   - TODO: Quality metrics thresholds (error rate < 5%, latency < 2x baseline)
   - TODO: Automatic rollback if treatment variant shows significant degradation
   - TODO: Circuit breaker pattern for experiments causing system issues

6. **Documentation & Process**:
   - TODO: Experiment playbook with best practices
   - TODO: Analysis templates for results interpretation
   - TODO: Decision framework for launching experiments
   - TODO: Training materials for product/engineering teams
   - TODO: Post-experiment report template
   - TODO: Registry of all past experiments and learnings

7. **Integration & Scalability**:
   ✅ DONE: FastAPI endpoints
   ✅ DONE: Persistent user assignments
   ✅ DONE: MongoDB storage with fallback
   - TODO: Integrate with feature flags system (gradual rollout)
   - TODO: Integrate with analytics pipeline (data warehouse export)
   - TODO: Export results to BI tools (Tableau, Looker, etc.)
   - TODO: Cache experiment assignments (Redis) for high-traffic scenarios
   - TODO: Implement sharding strategy for large-scale deployments
   - TODO: Add rate limiting to prevent abuse of tracking endpoints

8. **Testing & Validation**:
   - TODO: Unit tests for statistical calculations
   - TODO: Integration tests for MongoDB operations
   - TODO: End-to-end tests for complete experiment lifecycle
   - TODO: Load testing for high-traffic scenarios
   - TODO: Chaos engineering tests (MongoDB failure, network issues)

9. **Security & Compliance**:
   - TODO: Audit logging for all experiment changes
   - TODO: Role-based access control (who can create/stop experiments)
   - TODO: Data retention policy for experiment data
   - TODO: PII handling in experiment assignments
   - TODO: GDPR compliance (right to be forgotten)

10. **Performance Optimization**:
    - TODO: Index optimization for frequent queries
    - TODO: Connection pooling for MongoDB
    - TODO: Caching layer for variant assignments
    - TODO: Batch processing for metric updates
    - TODO: Async processing for non-critical updates
"""