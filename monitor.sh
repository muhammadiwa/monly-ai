#!/bin/bash

# MonlyAI Monitoring Script
# Use this to monitor your production deployment

set -e

echo "📊 MonlyAI Production Monitoring Dashboard"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service health
check_service_health() {
    local service_name=$1
    local container_name=$2
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        echo -e "${GREEN}✅ $service_name: Running${NC}"
    else
        echo -e "${RED}❌ $service_name: Not Running${NC}"
    fi
}

# Check Docker services
echo "🐳 Docker Services Status:"
check_service_health "MonlyAI App" "monlyai-app"
check_service_health "Traefik Proxy" "traefik"
check_service_health "Backup Service" "monlyai-backup"

echo ""

# Check SSL certificates
echo "🔒 SSL Certificate Status:"
if docker exec traefik ls /letsencrypt/acme.json >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SSL Certificate: Present${NC}"
    # Check certificate expiry
    if command -v openssl &> /dev/null; then
        CERT_EXPIRY=$(echo | openssl s_client -connect monlyai.web.id:443 -servername monlyai.web.id 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ ! -z "$CERT_EXPIRY" ]; then
            echo -e "${YELLOW}📅 Certificate expires: $CERT_EXPIRY${NC}"
        fi
    fi
else
    echo -e "${RED}❌ SSL Certificate: Not Found${NC}"
fi

echo ""

# Check disk usage
echo "💾 Disk Usage:"
df -h | grep -E '(Filesystem|/dev/)' | head -2

echo ""

# Check memory usage
echo "🧠 Memory Usage:"
free -h

echo ""

# Check container resource usage
echo "📈 Container Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""

# Check recent logs for errors
echo "📝 Recent Error Logs (last 10 lines):"
docker-compose -f docker-compose.prod.yml logs --tail=10 | grep -i error || echo "No recent errors found"

echo ""

# Check backup status
echo "💾 Backup Status:"
if docker exec monlyai-backup ls /backups/*.db >/dev/null 2>&1; then
    BACKUP_COUNT=$(docker exec monlyai-backup ls /backups/*.db 2>/dev/null | wc -l)
    LATEST_BACKUP=$(docker exec monlyai-backup ls -lt /backups/*.db 2>/dev/null | head -1 | awk '{print $9}')
    echo -e "${GREEN}✅ Database Backups: $BACKUP_COUNT files${NC}"
    echo -e "${YELLOW}📅 Latest backup: $LATEST_BACKUP${NC}"
else
    echo -e "${RED}❌ No database backups found${NC}"
fi

echo ""

# Application health check
echo "🏥 Application Health Check:"
if curl -s -f http://localhost:3000/api/debug >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Application API: Healthy${NC}"
else
    echo -e "${RED}❌ Application API: Unhealthy${NC}"
fi

# Check if HTTPS is working
if curl -s -f https://monlyai.web.id/api/debug >/dev/null 2>&1; then
    echo -e "${GREEN}✅ HTTPS Access: Working${NC}"
else
    echo -e "${RED}❌ HTTPS Access: Not Working${NC}"
fi

echo ""
echo "========================================"
echo "💡 Useful Commands:"
echo "   View live logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   Restart all: docker-compose -f docker-compose.prod.yml restart"
echo "   Update app: ./deploy.sh"
echo "   Check SSL: curl -I https://monlyai.web.id"
echo "========================================"
