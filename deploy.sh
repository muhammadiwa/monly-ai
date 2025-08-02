#!/bin/bash

# MonlyAI Production Deployment Script
# This script sets up and deploys the MonlyAI application with automatic SSL

set -e

echo "🚀 Starting MonlyAI Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p ./data
mkdir -p ./backups
mkdir -p ./letsencrypt

# Set proper permissions
echo "🔐 Setting permissions..."
chmod 600 .env.production
chmod -R 755 ./data
chmod -R 755 ./backups

# Copy environment file
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}⚠️ .env.production not found. Please create it from .env.production.example${NC}"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans || true

# Pull latest images
echo "📦 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull || true

# Build and start services
echo "🏗️ Building and starting services..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Services are running successfully!${NC}"
else
    echo -e "${RED}❌ Some services failed to start. Check logs:${NC}"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Show service status
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps

# Show logs
echo "📝 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📍 Your application is now available at:"
echo "   🌐 Main App: https://monlyai.web.id"
echo "   🔧 Traefik Dashboard: https://traefik.monlyai.web.id"
echo ""
echo "📋 Useful commands:"
echo "   📊 View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   🔄 Restart: docker-compose -f docker-compose.prod.yml restart"
echo "   🛑 Stop: docker-compose -f docker-compose.prod.yml down"
echo "   📈 Monitor: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo -e "${YELLOW}🔒 SSL certificates will be automatically obtained and renewed by Let's Encrypt${NC}"
echo -e "${YELLOW}⚠️ Make sure your domain DNS is pointing to this server's IP address${NC}"
