#!/bin/bash

# MonlyAI Deployment Scripecho "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Access your app at: http://your-server-ip:8888"
echo "📋 To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "⚠️  Important Notes:"
echo "  • Port 8888 = HTTP access (no SSL conflicts)"
echo "  • No conflicts with system Apache/Nginx"
echo "  • Update your domain DNS to point to: your-server-ip:8888"
echo "  • To enable SSL later, use the full nginx.conf and setup-ssl.sh" deployment without SSL conflicts

echo "🚀 MonlyAI Production Deployment"
echo "================================="

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "📝 Please create .env.production with your environment variables"
    echo "💡 You can copy from .env.production.example"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Create nginx directories
mkdir -p nginx

echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down --remove-orphans

echo "🏗️  Building application..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 15

# Check if services are running
echo "📊 Service Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 HTTP Access: http://your-server-ip:8888"
echo "🔒 HTTPS Access: https://your-server-ip:8889 (after SSL setup)"
echo "� To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "🔐 To setup SSL: ./setup-ssl.sh"
echo ""
echo "⚠️  Important Notes:"
echo "  • Port 8888 = HTTP (redirect to HTTPS)"
echo "  • Port 8889 = HTTPS (main access)"
echo "  • No conflicts with system Apache/Nginx"
echo "  • Update your domain DNS to point to: your-server-ip:8889"
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
