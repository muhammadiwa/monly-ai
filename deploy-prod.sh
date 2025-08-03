#!/bin/bash

# ===========================================
# Monly AI Production Deployment Script
# ===========================================

set -e  # Exit on any error

echo "🚀 Starting Monly AI Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose >/dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install it and try again."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p data
mkdir -p data/whatsapp_sessions
mkdir -p logs
mkdir -p logs/nginx
mkdir -p nginx/ssl

# Set proper permissions
chmod 755 data
chmod 755 logs
chmod 700 data/whatsapp_sessions

print_success "Directories created successfully!"

# Check if production environment file exists
if [ ! -f ".env.production" ]; then
    print_warning "Production environment file not found!"
    print_status "Copying template..."
    cp .env.production.template .env.production
    print_warning "⚠️  IMPORTANT: Please edit .env.production with your actual values before proceeding!"
    print_warning "⚠️  Required: OPENAI_API_KEY, SESSION_SECRET, JWT_SECRET, DOMAIN"
    echo ""
    read -p "Have you configured .env.production? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Please configure .env.production first, then run this script again."
        exit 1
    fi
fi

# Load environment variables
if [ -f ".env.production" ]; then
    print_status "Loading production environment variables..."
    export $(grep -v '^#' .env.production | xargs)
fi

# Validate required environment variables
print_status "Validating environment variables..."
required_vars=("OPENAI_API_KEY" "SESSION_SECRET" "JWT_SECRET" "DOMAIN")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" = "your-actual-value-here" ] || [[ "${!var}" == *"your-"* ]]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing or invalid required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_error "Please update .env.production with actual values."
    exit 1
fi

print_success "Environment validation passed!"

# Check if database exists, if not copy from development
if [ ! -f "data/database.sqlite" ]; then
    if [ -f "database.sqlite" ]; then
        print_status "Copying development database to production..."
        cp database.sqlite data/database.sqlite
        chmod 644 data/database.sqlite
        print_success "Database copied successfully!"
    else
        print_warning "No database found. A new one will be created."
    fi
fi

# Build and start production containers
print_status "Building production Docker image..."
docker-compose -f docker-compose.prod.yml build --no-cache

print_status "Starting production containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check if main service is healthy
print_status "Checking service health..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy\|running"; then
    print_success "Services are running!"
else
    print_error "Services failed to start properly. Check logs:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Run database migrations
print_status "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T monlyai-prod npm run migrate

# Display deployment information
echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📊 Service Information:"
echo "  - Application URL: http://localhost:3000"
if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "your-domain.com" ]; then
    echo "  - Production URL: https://$DOMAIN"
fi
echo "  - Container Name: monlyai-production"
echo "  - Database: data/database.sqlite"
echo "  - Logs: logs/"
echo ""
echo "🔧 Useful Commands:"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  - Restart services: docker-compose -f docker-compose.prod.yml restart"
echo "  - Update application: ./deploy-prod.sh"
echo ""
echo "🔍 Health Check:"
curl -s http://localhost:3000/api/health >/dev/null 2>&1 && echo "  ✅ Application is healthy" || echo "  ❌ Application is not responding"
echo ""
print_success "Deployment completed! 🚀"
