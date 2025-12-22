#!/bin/bash

# MonlyAI Monitoring Script

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📊 MonlyAI Production Monitor"
echo "=============================="

# Check Docker services
echo ""
echo "🐳 Docker Services:"
docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "No services running"

# Check container resource usage
echo ""
echo "📈 Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || echo "No containers"

# Check disk usage
echo ""
echo "💾 Disk Usage:"
df -h / | tail -1

# Check memory
echo ""
echo "🧠 Memory:"
free -h | head -2

# Application health check
echo ""
echo "🏥 Health Check:"
if curl -s -f http://localhost:3000/api/debug >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API: Healthy${NC}"
else
    echo -e "${RED}❌ API: Unhealthy${NC}"
fi

echo ""
echo "=============================="
echo "📋 Commands:"
echo "   Logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   Restart: docker-compose -f docker-compose.prod.yml restart"
