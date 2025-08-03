#!/bin/bash

# Monly AI Production Secrets Generator
# This script generates secure random secrets for production deployment

echo "🔐 Generating secure secrets for Monly AI Production..."
echo ""

# Function to generate a random string
generate_secret() {
    openssl rand -hex 32
}

# Generate secrets
SESSION_SECRET=$(generate_secret)
JWT_SECRET=$(generate_secret)

echo "🔑 Generated Secrets:"
echo "===================="
echo ""
echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Create .env.production file
cat > .env.production << EOF
# Monly AI Production Environment Variables
# Generated on $(date)

# Database Configuration
DATABASE_URL=file:/app/data/database.sqlite

# OpenAI Configuration - REPLACE WITH YOUR ACTUAL API KEY
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here

# Security Secrets - Generated $(date)
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET

# Production Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# Domain Configuration
DOMAIN=monlyai.web.id

# Email for Let's Encrypt SSL certificates
ACME_EMAIL=admin@monlyai.web.id

# Optional: Basic Auth for monitoring
MONITOR_AUTH=admin:$(openssl passwd -apr1 "monitor123")
EOF

echo "✅ Production environment file created: .env.production"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Edit .env.production and replace OPENAI_API_KEY with your actual key"
echo "2. Update DOMAIN and ACME_EMAIL with your actual values"
echo "3. Keep these secrets secure and never commit them to git"
echo ""
echo "🚀 You can now run: ./deploy-prod.sh"
