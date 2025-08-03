#!/bin/bash

# Quick Production Setup for Monly AI
echo "🔐 Monly AI - Production Environment Setup"
echo "=========================================="
echo ""

# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

echo "✅ Generated secure secrets!"
echo ""

# Create .env.production file
cat > .env.production << EOF
# Monly AI Production Environment
# Generated on $(date)

NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=file:/app/data/database.sqlite

# Security Secrets (Auto-generated - Keep secure!)
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET

# OpenAI API Key - REPLACE WITH YOUR ACTUAL KEY
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here

# Domain Configuration - UPDATE WITH YOUR DOMAIN
DOMAIN=monlyai.web.id
ACME_EMAIL=admin@monlyai.web.id

# Optional Settings
LOG_LEVEL=info
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
TZ=Asia/Jakarta
EOF

echo "📄 Created .env.production file with secure secrets!"
echo ""
echo "⚠️  IMPORTANT: Edit .env.production and update:"
echo "   1. OPENAI_API_KEY - Replace with your actual OpenAI API key"
echo "   2. DOMAIN - Update with your actual domain"
echo "   3. ACME_EMAIL - Update with your email"
echo ""
echo "🚀 After updating, run: ./deploy-prod.sh"
echo ""
echo "Generated secrets:"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "JWT_SECRET: $JWT_SECRET"
