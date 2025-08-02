#!/bin/bash

# MonlyAI SSL Certificate Setup Script
# This script will generate SSL certificates for monlyai.web.id

echo "🔐 MonlyAI SSL Certificate Setup"
echo "================================"

# Create necessary directories
mkdir -p nginx/ssl
mkdir -p nginx/certbot-webroot

# Stop any existing containers
echo "📦 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Start only nginx first (without SSL) for certificate generation
echo "🚀 Starting nginx for certificate generation..."
docker-compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx to be ready
sleep 10

# Generate certificate
echo "📜 Generating SSL certificate..."
docker run --rm \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@monlyai.web.id \
  --agree-tos \
  --no-eff-email \
  --staging \
  -d monlyai.web.id

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate generated successfully!"
    echo "🔄 Restarting all services with SSL..."
    
    # Stop and restart all services
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d
    
    echo "🎉 MonlyAI is now running with SSL!"
    echo "📱 Access your app at: https://monlyai.web.id:8889"
    echo "📊 Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
else
    echo "❌ Certificate generation failed. Check the logs above."
    echo "💡 Make sure your domain points to this server and ports 8888/8889 are open."
fi
