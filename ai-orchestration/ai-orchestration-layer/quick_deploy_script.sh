#!/bin/bash
# quick-deploy.sh
# One-command deployment script for AI Orchestration Layer with all fixes

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose installed"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_warning "Python 3 not found (optional for local development)"
    else
        print_success "Python 3 installed"
    fi
    
    # Check Node
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found (optional for dashboard development)"
    else
        print_success "Node.js installed"
    fi
}

# Create directory structure
create_directories() {
    print_header "Creating Directory Structure"
    
    mkdir -p backend/ai-orchestration-layer/src/{core,capabilities,tools,ab_testing}
    mkdir -p backend/ai-orchestration-layer/data
    mkdir -p scripts
    mkdir -p logs
    mkdir -p chroma_db
    mkdir -p backups/{redis,mongodb}
    
    print_success "Directories created"
}

# Create environment file
create_env_file() {
    print_header "Creating Environment File"
    
    if [ -f .env ]; then
        print_warning ".env file already exists, backing up to .env.backup"
        cp .env .env.backup
    fi
    
    cat > .env << 'EOF'
# Environment
ENVIRONMENT=development

# LLM Configuration
LLM_MODEL=llama3.2:3b
OLLAMA_URL=http://ollama:11434
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000

# Service URLs
CLOUDAPP_URL=http://cloudapp:8099
PETSTORE_URL=http://petstore:8083
VEHICLES_URL=http://vehicles-api:8880
ML_URL=http://mlops-segmentation:8600
POSTGRES_URL=postgresql://websitemaster:local@postgres:5432/cloudappdb

# Redis Configuration (NEW)
REDIS_URL=redis://redis:6379/0
REDIS_MAX_CONNECTIONS=50

# MongoDB Configuration (NEW)
MONGODB_URL=mongodb://orchestration_user:orchestration_pass@mongodb:27017/ai_orchestration
MONGODB_DATABASE=ai_orchestration

# HTTP Client Configuration (NEW)
HTTP_TIMEOUT=10
HTTP_MAX_CONNECTIONS=100
HTTP_MAX_KEEPALIVE=20

# RAG Configuration
CHROMA_PERSIST_DIR=/data/chroma
CHROMA_COLLECTION=user_documents
RAG_SEARCH_K=3

# Feature Flags
ENABLE_CHECKPOINTING=true
ENABLE_HITL=true
ENABLE_PARALLEL=true
ENABLE_ERROR_HANDLING=true
ENABLE_AB_TESTING=true

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
EOF
    
    print_success "Environment file created"
}

# Start infrastructure services
start_infrastructure() {
    print_header "Starting Infrastructure Services"
    
    docker-compose -f docker-compose-infrastructure.yml up -d
    
    print_success "Infrastructure services started"
    print_warning "Waiting 30 seconds for services to initialize..."
    sleep 30
}

# Verify infrastructure
verify_infrastructure() {
    print_header "Verifying Infrastructure Services"
    
    # Check Redis
    if docker exec redis-cache redis-cli PING &> /dev/null; then
        print_success "Redis is healthy"
    else
        print_error "Redis is not responding"
        exit 1
    fi
    
    # Check MongoDB
    if docker exec mongodb-abtest mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        print_success "MongoDB is healthy"
    else
        print_error "MongoDB is not responding"
        exit 1
    fi
    
    # Check PostgreSQL
    if docker exec postgres-db pg_isready -U websitemaster &> /dev/null; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is not responding"
        exit 1
    fi
    
    # Check Ollama
    if curl -f http://localhost:11434/api/tags &> /dev/null; then
        print_success "Ollama is healthy"
    else
        print_warning "Ollama is not responding (will pull model later)"
    fi
}

# Pull Ollama model
pull_ollama_model() {
    print_header "Pulling Ollama Model"
    
    docker exec ollama ollama pull llama3.2:3b
    
    print_success "Model pulled successfully"
}

# Verify MongoDB initialization
verify_mongodb_setup() {
    print_header "Verifying MongoDB Setup"
    
    # Check collections
    COLLECTIONS=$(docker exec mongodb-abtest mongosh \
        -u orchestration_user \
        -p orchestration_pass \
        --authenticationDatabase ai_orchestration \
        --quiet \
        --eval "db.getCollectionNames()")
    
    if echo "$COLLECTIONS" | grep -q "experiments"; then
        print_success "MongoDB collections initialized"
    else
        print_error "MongoDB collections not found"
        exit 1
    fi
}

# Start application services
start_application() {
    print_header "Starting Application Services"
    
    docker-compose -f docker-compose-app.yml up -d --build
    
    print_success "Application services started"
    print_warning "Waiting 30 seconds for application to initialize..."
    sleep 30
}

# Run verification tests
run_verification_tests() {
    print_header "Running Verification Tests"
    
    # Test 1: Health check
    if curl -f http://localhost:8700/health &> /dev/null; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        exit 1
    fi
    
    # Test 2: Feature status
    if curl -f http://localhost:8700/feature-status &> /dev/null; then
        print_success "Feature status endpoint working"
    else
        print_warning "Feature status endpoint not responding"
    fi
    
    # Test 3: Circuit breaker status
    if curl -f http://localhost:8700/circuit-breakers &> /dev/null; then
        print_success "Circuit breaker endpoint working"
    else
        print_warning "Circuit breaker endpoint not responding"
    fi
    
    # Test 4: A/B experiments
    if curl -f http://localhost:8700/experiments &> /dev/null; then
        print_success "A/B testing endpoint working"
    else
        print_warning "A/B testing endpoint not responding"
    fi
    
    # Test 5: Connection stats
    if curl -f http://localhost:8700/connection-stats &> /dev/null; then
        print_success "Connection pooling endpoint working"
    else
        print_warning "Connection stats endpoint not responding"
    fi
}

# Print access information
print_access_info() {
    print_header "Deployment Complete!"
    
    echo ""
    echo -e "${GREEN}🎉 All services are running!${NC}"
    echo ""
    echo "Access the services at:"
    echo "  • Orchestration API:    http://localhost:8700"
    echo "  • API Documentation:    http://localhost:8700/docs"
    echo "  • Dashboard:            http://localhost:5777"
    echo "  • Redis:                localhost:6379"
    echo "  • MongoDB:              localhost:27017"
    echo "  • PostgreSQL:           localhost:5432"
    echo ""
    echo "Useful commands:"
    echo "  • View logs:            docker-compose -f docker-compose-app.yml logs -f"
    echo "  • Stop services:        docker-compose -f docker-compose-app.yml down"
    echo "  • Restart:              docker-compose -f docker-compose-app.yml restart"
    echo "  • Check status:         docker-compose ps"
    echo ""
    echo "Quick tests:"
    echo "  • curl http://localhost:8700/health"
    echo "  • curl http://localhost:8700/feature-status"
    echo "  • curl http://localhost:8700/experiments"
    echo ""
    echo -e "${YELLOW}⚠️  For production deployment, see deployment-guide.md${NC}"
    echo ""
}

# Print failure information
print_failure_info() {
    print_header "Deployment Failed"
    
    echo ""
    echo -e "${RED}Deployment encountered errors. Check the logs:${NC}"
    echo ""
    echo "  • Infrastructure logs:  docker-compose -f docker-compose-infrastructure.yml logs"
    echo "  • Application logs:     docker-compose -f docker-compose-app.yml logs"
    echo ""
    echo "Common issues:"
    echo "  • Port conflicts:       Check if ports 5432, 6379, 8700, 11434, 27017 are available"
    echo "  • Permission issues:    Run with sudo or add user to docker group"
    echo "  • Resource limits:      Ensure Docker has at least 8GB RAM allocated"
    echo ""
    echo "Cleanup and retry:"
    echo "  docker-compose -f docker-compose-infrastructure.yml down -v"
    echo "  docker-compose -f docker-compose-app.yml down -v"
    echo "  ./quick-deploy.sh"
    echo ""
}

# Cleanup function
cleanup() {
    print_header "Cleaning Up Failed Deployment"
    
    docker-compose -f docker-compose-app.yml down
    docker-compose -f docker-compose-infrastructure.yml down
    
    print_success "Cleanup complete"
}

# Main execution
main() {
    print_header "AI Orchestration Layer - Quick Deploy"
    echo "This script will deploy all services with fixes for:"
    echo "  1. Import Guards (graceful degradation)"
    echo "  2. Redis Circuit Breaker (persistent state)"
    echo "  3. MongoDB A/B Testing (persistent experiments)"
    echo "  4. Thread-Safe RAG (no race conditions)"
    echo "  5. Connection Pooling (optimized HTTP)"
    echo ""
    
    # Trap errors for cleanup
    trap 'print_failure_info' ERR
    
    check_prerequisites
    create_directories
    create_env_file
    start_infrastructure
    verify_infrastructure
    pull_ollama_model
    verify_mongodb_setup
    start_application
    run_verification_tests
    print_access_info
}

# Run main function
main "$@"
