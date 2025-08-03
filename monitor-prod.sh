#!/bin/bash

# ===========================================
# Monly AI Production Monitoring Script
# ===========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}    MONLY AI PRODUCTION MONITORING${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_section() {
    echo -e "\n${YELLOW}📊 $1${NC}"
    echo "----------------------------------------"
}

print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

clear
print_header

# Check if containers are running
print_section "Container Status"
if docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "monlyai-prod"; then
    print_status "Main application is running"
else
    print_error "Main application is not running"
fi

if docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "nginx-prod"; then
    print_status "Nginx proxy is running"
else
    print_warning "Nginx proxy is not running (optional)"
fi

# Container health status
print_section "Health Checks"
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' monlyai-production 2>/dev/null || echo "not-found")
case $HEALTH_STATUS in
    "healthy")
        print_status "Application health check: HEALTHY"
        ;;
    "unhealthy")
        print_error "Application health check: UNHEALTHY"
        ;;
    "starting")
        print_warning "Application health check: STARTING"
        ;;
    *)
        print_warning "Application health check: UNKNOWN"
        ;;
esac

# Resource usage
print_section "Resource Usage"
if command -v docker >/dev/null 2>&1; then
    CONTAINER_STATS=$(docker stats monlyai-production --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null | tail -n 1)
    if [ ! -z "$CONTAINER_STATS" ]; then
        echo "CPU Usage: $(echo $CONTAINER_STATS | awk '{print $1}')"
        echo "Memory Usage: $(echo $CONTAINER_STATS | awk '{print $2}')"
        echo "Memory Percentage: $(echo $CONTAINER_STATS | awk '{print $3}')"
    else
        print_warning "Could not retrieve container stats"
    fi
fi

# Disk usage
print_section "Storage Information"
if [ -d "data" ]; then
    DATA_SIZE=$(du -sh data 2>/dev/null | cut -f1)
    echo "Data directory size: $DATA_SIZE"
fi

if [ -d "logs" ]; then
    LOGS_SIZE=$(du -sh logs 2>/dev/null | cut -f1)
    echo "Logs directory size: $LOGS_SIZE"
fi

if [ -f "data/database.sqlite" ]; then
    DB_SIZE=$(du -sh data/database.sqlite 2>/dev/null | cut -f1)
    echo "Database size: $DB_SIZE"
    print_status "Database file exists"
else
    print_error "Database file not found"
fi

# Application connectivity
print_section "Connectivity Tests"
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    print_status "Local API endpoint is responding"
else
    print_error "Local API endpoint is not responding"
fi

# Check environment configuration
print_section "Configuration Status"
if [ -f ".env.production" ]; then
    print_status "Production environment file exists"
    
    # Check for placeholder values
    if grep -q "your-actual" .env.production; then
        print_warning "Found placeholder values in .env.production"
    fi
    
    if grep -q "your-domain.com" .env.production; then
        print_warning "Default domain found in .env.production"
    fi
else
    print_error "Production environment file missing"
fi

# Recent logs
print_section "Recent Application Logs (Last 10 lines)"
docker-compose -f docker-compose.prod.yml logs --tail=10 monlyai-prod 2>/dev/null || print_warning "Could not retrieve logs"

# Process count
print_section "Process Information"
CONTAINER_PID=$(docker inspect --format='{{.State.Pid}}' monlyai-production 2>/dev/null)
if [ ! -z "$CONTAINER_PID" ] && [ "$CONTAINER_PID" != "0" ]; then
    print_status "Container PID: $CONTAINER_PID"
else
    print_warning "Container PID not found"
fi

# Network information
print_section "Network Status"
CONTAINER_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' monlyai-production 2>/dev/null)
if [ ! -z "$CONTAINER_IP" ]; then
    echo "Container IP: $CONTAINER_IP"
else
    print_warning "Container IP not found"
fi

# Uptime
print_section "Uptime Information"
CONTAINER_STARTED=$(docker inspect --format='{{.State.StartedAt}}' monlyai-production 2>/dev/null)
if [ ! -z "$CONTAINER_STARTED" ]; then
    echo "Container started: $CONTAINER_STARTED"
else
    print_warning "Container start time not found"
fi

echo ""
print_section "Quick Commands"
echo "View live logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo "Restart service:    docker-compose -f docker-compose.prod.yml restart"
echo "Stop service:       docker-compose -f docker-compose.prod.yml down"
echo "Update service:     ./deploy-prod.sh"
echo "Container shell:    docker-compose -f docker-compose.prod.yml exec monlyai-prod sh"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Monitoring completed at $(date)${NC}"
echo -e "${BLUE}================================================${NC}"
