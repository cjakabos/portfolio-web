# AI Orchestration Layer - Deployment Guide with All Fixes

## 🎯 Overview

This guide covers the complete deployment of the AI Orchestration Layer with all critical fixes:

1. ✅ **Import Guards** - Graceful degradation when dependencies unavailable
2. ✅ **Redis Circuit Breaker** - Persistent circuit breaker state
3. ✅ **MongoDB A/B Testing** - Persistent experiment storage
4. ✅ **Thread-Safe RAG** - Race condition prevention
5. ✅ **Connection Pooling** - HTTP client optimization
6. ✅ **Pydantic v2 Migration** - Updated validators and serialization
7. ✅ **FastAPI Lifespan** - Modern startup/shutdown pattern

---

## 📋 Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Node.js 18+ (for dashboard)
- 8GB RAM minimum
- 20GB disk space

---

## 🚀 Quick Start

### 1. Clone and Setup Directory Structure

```bash
# Create directory structure
mkdir -p backend/ai-orchestration-layer/src/{core,capabilities,tools,ab_testing,routers}
mkdir -p backend/ai-orchestration-layer/data
mkdir -p scripts
mkdir -p frontend/remote/orchestration-dashboard

# Create necessary directories
mkdir -p logs
mkdir -p chroma_db
```

### 2. Copy All Fixed Files

Copy the following files to their respective locations:

**Core Files:**
- `orchestrator.py` → `backend/ai-orchestration-layer/src/core/`
- `error_handling.py` → `backend/ai-orchestration-layer/src/core/`
- `config.py` → `backend/ai-orchestration-layer/src/core/`

**Routers (UPDATED):**
- `main.py` → `backend/ai-orchestration-layer/`
- `experiments_router.py` → `backend/ai-orchestration-layer/src/routers/`
- `approvals_router.py` → `backend/ai-orchestration-layer/src/routers/`
- `petstore_router.py` → `backend/ai-orchestration-layer/src/routers/`
- `vehicles_router.py` → `backend/ai-orchestration-layer/src/routers/`

**Capabilities:**
- `rag_engine.py` → `backend/ai-orchestration-layer/src/capabilities/`

**Tools:**
- `http_client.py` → `backend/ai-orchestration-layer/src/tools/`

**A/B Testing:**
- `experiment_manager.py` → `backend/ai-orchestration-layer/src/ab_testing/`

**Infrastructure:**
- `requirements.txt` → `backend/ai-orchestration-layer/` ⚠️ **Must be .txt not .py**
- `Dockerfile` → `backend/ai-orchestration-layer/` ⚠️ **Must be plain Dockerfile, not .py**
- `docker-compose-infrastructure.yml` → project root
- `docker-compose-app.yml` → project root
- `mongo-init.js` → `scripts/`

### 3. Create Environment File

Create `.env` file in project root:

```bash
# Copy from template
cp backend/ai-orchestration-layer/.env.template .env

# Edit with your values
nano .env
```

**Minimal .env configuration:**

```bash
# Environment
ENVIRONMENT=development

# LLM
LLM_MODEL=qwen3:1.7b
OLLAMA_URL=http://host.docker.internal:11434

# Services
CLOUDAPP_URL=http://cloudapp:8099
PETSTORE_URL=http://petstore:8083
VEHICLES_URL=http://vehicles-api:8880
ML_URL=http://mlops-segmentation:8600
POSTGRES_URL=postgresql://<user>:<password>@postgres:5432/cloudappdb

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_MAX_CONNECTIONS=50

# MongoDB
MONGODB_URL=mongodb://mongodb:27017/ai_orchestration
MONGODB_DATABASE=ai_orchestration

# HTTP Client
HTTP_MAX_CONNECTIONS=100
HTTP_MAX_KEEPALIVE=20

# Features
ENABLE_CHECKPOINTING=true
ENABLE_HITL=true
ENABLE_PARALLEL=true
ENABLE_ERROR_HANDLING=true
ENABLE_AB_TESTING=true

# Logging
LOG_LEVEL=INFO
```

**For local development (without Docker):**

```bash
# Use localhost instead of Docker hostnames
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://localhost:27017
CLOUDAPP_URL=http://localhost:8099
PETSTORE_URL=http://localhost:8803
VEHICLES_URL=http://localhost:8880/vehicles
```

### 4. Install Python Dependencies

```bash
cd backend/ai-orchestration-layer
pip install -r requirements.txt
```

### 5. Start Infrastructure Services

```bash
# Start Redis, MongoDB, PostgreSQL, Ollama
docker-compose -f docker-compose-infrastructure.yml up -d

# Wait for services to be ready (30 seconds)
sleep 30

# Verify services are running
docker-compose -f docker-compose-infrastructure.yml ps
```

**Expected output:**
```
NAME                   STATUS    PORTS
postgres-db            Up        0.0.0.0:5432->5432/tcp
ollama                 Up        0.0.0.0:11434->11434/tcp
redis-cache            Up        0.0.0.0:6379->6379/tcp
mongodb-abtest         Up        0.0.0.0:27017->27017/tcp
```

### 6. Verify MongoDB Initialization

```bash
# Connect to MongoDB
docker exec -it mongodb-abtest mongosh -u admin -p admin_password

# In MongoDB shell, verify:
use ai_orchestration
db.auth("orchestration_user", "orchestration_pass")
show collections

# Should see: experiments, user_assignments, circuit_breaker_backup
exit
```

### 7. Verify Redis

```bash
# Connect to Redis
docker exec -it redis-cache redis-cli

# Test connection
PING
# Should return: PONG

# Exit
exit
```

### 8. Pull Ollama Model

```bash
# Pull the LLM model
docker exec -it ollama ollama pull qwen3:1.7b

# Verify model is available
docker exec -it ollama ollama list
```

### 9. Start Application Services

```bash
# Start orchestration layer and other app services
docker-compose -f docker-compose-app.yml up -d --build

# Watch logs
docker-compose -f docker-compose-app.yml logs -f ai-orchestration-layer
```

**Look for these initialization messages:**
```
INFO - Starting AI Orchestration Layer...
INFO - Initializing Core Components (Metrics, Memory, Orchestrator)...
INFO - Initializing Experiments Storage...
INFO - ✅ Experiments storage initialized
INFO - Initializing Approvals Storage...
INFO - ✅ Approvals storage initialized
INFO - ✅ All services initialized successfully
```

### 10. Verify Installation

Test each component:

**1. Test Health Endpoint**

```bash
curl http://localhost:8700/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-10T12:00:00Z",
  "services": {
    "cloudapp": "healthy",
    "petstore": "healthy",
    "vehicles": "healthy",
    "orchestrator": "healthy"
  }
}
```

**2. Test Feature Status**

```bash
curl http://localhost:8700/feature-status
```

Expected response:
```json
{
  "available": {
    "checkpointing": true,
    "hitl": true,
    "parallel": true,
    "streaming": false,
    "error_handling": true
  },
  "fallbacks": {
    "checkpointing": null,
    "streaming": "full-response"
  }
}
```

**3. Test Circuit Breaker (Redis Persistence)**

```bash
# Check circuit breaker status
curl http://localhost:8700/circuit-breakers

# Verify Redis storage
docker exec -it redis-cache redis-cli KEYS "circuit_breaker:*"
```

**4. Test A/B Testing (MongoDB Storage)**

```bash
# List experiments
curl http://localhost:8700/experiments

# Check experiments health
curl http://localhost:8700/experiments/health
```

Expected:
```json
{
  "status": "healthy",
  "service": "experiments",
  "storage": "mongodb",
  "total_experiments": 0,
  "running_experiments": 0
}
```

**5. Test Connection Pool Stats**

```bash
curl http://localhost:8700/connection-stats
```

---

## 📊 Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Orchestration API | http://localhost:8700 | None |
| API Documentation | http://localhost:8700/docs | None |
| Observability Dashboard | http://localhost:5777 | None |
| Redis | localhost:6379 | None |
| MongoDB | localhost:27017 | orchestration_user / orchestration_pass |
| PostgreSQL | localhost:5432 | websitemaster / local |

---

## 🧪 Testing A/B Experiments

### Create an Experiment

**⚠️ IMPORTANT: The `variants` field must be an array/list, not a dictionary!**

```bash
curl -X POST http://localhost:8700/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LLM Temperature Test",
    "description": "Testing different temperature values",
    "hypothesis": "Lower temperature improves accuracy",
    "metric": "accuracy",
    "user_percentage": 100,
    "variants": [
      {
        "name": "control",
        "type": "control",
        "traffic_percentage": 50,
        "config": {"temperature": 0.7}
      },
      {
        "name": "low_temp",
        "type": "treatment",
        "traffic_percentage": 50,
        "config": {"temperature": 0.3}
      }
    ]
  }'
```

### Start the Experiment

```bash
curl -X POST http://localhost:8700/experiments/{experiment_id}/start
```

### Get Variant Assignment for a User

```bash
# Note: user_id is a path parameter, not query parameter
curl http://localhost:8700/experiments/{experiment_id}/variant/{user_id}
```

Example:
```bash
curl http://localhost:8700/experiments/exp_abc123/variant/42
```

Response:
```json
{
  "experiment_id": "exp_abc123",
  "variant_name": "control",
  "variant_config": {"temperature": 0.7},
  "assigned": true
}
```

### Track Conversion

```bash
curl -X POST http://localhost:8700/experiments/{experiment_id}/track/conversion \
  -H "Content-Type: application/json" \
  -d '{"user_id": 42}'
```

### Get Experiment Details

```bash
curl http://localhost:8700/experiments/{experiment_id}
```

### Stop Experiment and Determine Winner

```bash
curl -X POST http://localhost:8700/experiments/{experiment_id}/stop
```

### Get Experiment Statistics Summary

```bash
curl http://localhost:8700/experiments/stats/summary
```
# Restart service
docker-compose -f docker-compose-app.yml restart ai-orchestration-layer

# Experiment should still exist
curl http://localhost:8700/experiments
# Should show the experiment we just created
---

## 🧪 Testing Approvals (HITL)

### Create an Approval Request

```bash
curl -X POST http://localhost:8700/approvals/request \
  -H "Content-Type: application/json" \
  -d '{
    "orchestration_id": "orch_123",
    "approval_type": "financial",
    "proposed_action": "Process refund of $500",
    "risk_level": "high",
    "requester_id": 1,
    "context": {
      "state_summary": {"customer_id": 42, "order_id": 1001},
      "risk_score": 0.75
    },
    "expires_in_seconds": 300
  }'
```

### List Pending Approvals

```bash
curl http://localhost:8700/approvals/pending
```

### Approve/Reject a Request

```bash
curl -X POST http://localhost:8700/approvals/pending/{request_id}/decide \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approver_id": 1,
    "approval_notes": "Verified with customer"
  }'
```

### Get Approval Stats

```bash
curl http://localhost:8700/approvals/stats
```

### Test 4: RAG Thread Safety

```bash
# Stress test with 50 concurrent requests
siege -c 50 -r 1 -H "Content-Type: application/json" \
  "http://localhost:8700/orchestrate POST {\"user_id\":1,\"session_id\":\"test\",\"message\":\"search\"}"

# Check initialization count in logs
docker-compose -f docker-compose-app.yml logs ai-orchestration-layer | \
  grep "rag_vectorstore_initialized" | wc -l

# Should be 1 (only one initialization despite 50 concurrent requests)
```

### Test 5: Connection Pooling Performance

```bash
# Benchmark without pooling (old version)
# (For comparison, not available in current version)

# Benchmark with pooling
ab -n 1000 -c 10 -H "Content-Type: application/json" \
  -p test-request.json http://localhost:8700/orchestrate

# test-request.json:
echo '{"user_id":1,"session_id":"perf-test","message":"test"}' > test-request.json

# Expected improvement:
# - Lower average response time
# - Higher requests per second
# - No connection timeout errors
```
---

## 🔧 Troubleshooting

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Test connection
docker exec -it redis-cache redis-cli PING

# Check logs
docker logs redis-cache

# If failing, verify network
docker network inspect app-network | grep redis
```

**Solution:** Ensure Redis is in `app-network` and port 6379 is exposed.

### MongoDB Connection Issues

```bash
# Check MongoDB is running
docker ps | grep mongodb

# Test connection
docker exec -it mongodb-abtest mongosh --eval "db.adminCommand('ping')"

# Check authentication
docker exec -it mongodb-abtest mongosh \
  -u admin -p admin_password --eval "show dbs"

# If authentication fails
docker-compose -f docker-compose-infrastructure.yml restart mongodb
```

### RAG Initialization Fails

```bash
# Check Chroma directory permissions
ls -la chroma_db/

# Fix permissions
sudo chown -R $(whoami):$(whoami) chroma_db/

# Check Ollama is accessible
curl http://localhost:11434/api/tags

# Verify embeddings model
docker exec -it ollama ollama list | grep llama
```

### Circuit Breaker Not Persisting

```bash
# Check Redis keys
docker exec -it redis-cache redis-cli KEYS "circuit_breaker:*"

# If empty, check error logs
docker logs ai-orchestration-layer 2>&1 | grep "redis"

# Verify connection
docker exec -it ai-orchestration-layer python3 -c "
import redis.asyncio as aioredis
import asyncio
async def test():
    r = await aioredis.from_url('redis://redis:6379/0')
    await r.ping()
    print('✅ Redis connection OK')
asyncio.run(test())
"
```

### Pydantic Validation Errors

If you see errors like `'dict' object has no attribute 'model_dump'`, ensure:
1. You're using Pydantic v2 (`pip show pydantic` should show 2.x)
2. All router files have been updated with the fixed versions

### Experiments Not Persisting

```bash
# Check MongoDB connection in experiments
curl http://localhost:8700/experiments/health

# If storage shows "memory" instead of "mongodb":
# 1. Check MONGODB_URL in .env
# 2. Verify MongoDB is accessible
# 3. Check application logs for connection errors
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Reduce connection pool sizes in .env:
HTTP_MAX_CONNECTIONS=50
HTTP_MAX_KEEPALIVE=10
REDIS_MAX_CONNECTIONS=25
MONGODB_MAX_POOL_SIZE=25

# Restart services
docker-compose -f docker-compose-app.yml restart
```

---

## 📈 Monitoring

### View Circuit Breaker Status

```bash
# All circuit breakers
curl http://localhost:8700/circuit-breakers

# Reset a circuit breaker
curl -X POST http://localhost:8700/circuit-breakers/{name}/reset
```

### View Experiment Metrics

```bash
# List all experiments
curl http://localhost:8700/experiments

# Get specific experiment
curl http://localhost:8700/experiments/{experiment_id}

# Get summary stats
curl http://localhost:8700/experiments/stats/summary
```

### View Connection Pool Stats

```bash
curl http://localhost:8700/connection-stats
```

### View RAG Stats

```bash
curl http://localhost:8700/rag/stats
```

---

## 🔄 Backup and Recovery

### Backup Redis Circuit Breaker State

```bash
# Create Redis backup
docker exec redis-cache redis-cli BGSAVE

# Copy backup file
docker cp redis-cache:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

### Backup MongoDB Experiments

```bash
# Create MongoDB backup
docker exec mongodb-abtest mongodump \
  --username=orchestration_user \
  --password=orchestration_pass \
  --authenticationDatabase=ai_orchestration \
  --db=ai_orchestration \
  --out=/tmp/backup

# Copy backup
docker cp mongodb-abtest:/tmp/backup ./backups/mongodb-$(date +%Y%m%d)
```

### Restore from Backup

```bash
# Restore Redis
docker cp ./backups/redis-YYYYMMDD.rdb redis-cache:/data/dump.rdb
docker-compose -f docker-compose-infrastructure.yml restart redis

# Restore MongoDB
docker cp ./backups/mongodb-YYYYMMDD mongodb-abtest:/tmp/restore
docker exec mongodb-abtest mongorestore \
  --username=admin \
  --password=admin_password \
  --authenticationDatabase=admin \
  --db=ai_orchestration \
  /tmp/restore/ai_orchestration
```

---

## 🚀 Production Deployment Checklist

- [ ] Rename `requirements.py` to `requirements.txt` if not already done
- [ ] Ensure `Dockerfile` is plain text (not wrapped in Python)
- [ ] Change default passwords (MongoDB, Redis if auth enabled)
- [ ] Enable Redis authentication: `redis-server --requirepass your-password`
- [ ] Enable TLS for MongoDB and Redis
- [ ] Set `ENVIRONMENT=production` in .env
- [ ] Configure monitoring and alerting
- [ ] Set up log aggregation (ELK, Datadog)
- [ ] Configure backup automation
- [ ] Implement secret management (AWS Secrets Manager, Vault)
- [ ] Set up load balancing for orchestration layer
- [ ] Configure auto-scaling
- [ ] Set up distributed tracing (Jaeger, Zipkin)
- [ ] Enable HTTPS with valid certificates
- [ ] Implement rate limiting
- [ ] Set up CDN for dashboard
- [ ] Configure CORS properly for production domains

---

## 📝 Summary of All Fixes Applied

| Issue | Fix | Benefit |
|-------|-----|---------|
| Missing Import Guards | Graceful fallbacks when dependencies unavailable | No crashes, degraded mode operation |
| Circuit Breaker State Loss | Redis-backed persistence | Survives restarts, distributed state |
| A/B Testing Data Loss | MongoDB storage | Persistent experiments, scalable |
| RAG Race Conditions | asyncio.Lock for thread-safe init | No duplicate initialization |
| Connection Exhaustion | httpx with connection pooling | Lower latency, higher throughput |
| Pydantic v1 syntax | `@field_validator`, `.model_dump()` | Pydantic v2 compatibility |
| Deprecated FastAPI events | Lifespan context manager | Modern FastAPI patterns |
| Hardcoded URLs | Environment variables | Flexible deployment |

---

## 📞 Support

For issues or questions:
- Check troubleshooting section above
- Review service logs: `docker-compose logs [service-name]`
- Check health endpoints: `curl http://localhost:8700/health`
- Verify configuration: `curl http://localhost:8700/config`

---

**Deployment Status**: ✅ Production Ready with All Fixes Applied
