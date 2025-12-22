#!/bin/bash

# MonlyAI Production Deployment Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 MonlyAI Production Deployment"
echo "================================="

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    echo "📝 Run: ./generate-secrets.sh"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Create required directories
mkdir -p nginx

echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

echo "📦 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull 2>/dev/null || true

echo "🏗️  Building application..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 15

# Check if services are running
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps

if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo ""
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📱 Access: https://${DOMAIN:-monlyai.web.id}"
    echo "📋 Logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "📊 Monitor: ./monitor.sh"
else
    echo -e "${RED}❌ Some services failed to start${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=20
    exit 1
fi
