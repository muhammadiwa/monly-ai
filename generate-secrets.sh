#!/bin/bash

# MonlyAI Secrets Generator
# Usage: ./generate-secrets.sh [output-file]
# Default output: .env

OUTPUT_FILE="${1:-.env}"

echo "🔐 Generating secrets for MonlyAI..."
echo "📝 Output file: $OUTPUT_FILE"
echo ""

# Generate random secrets
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Check if .env already exists
if [ -f "$OUTPUT_FILE" ]; then
    echo "⚠️  $OUTPUT_FILE already exists!"
    read -p "Do you want to update SESSION_SECRET and JWT_SECRET? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled. No changes made."
        exit 0
    fi
    
    # Update existing .env file
    if grep -q "^SESSION_SECRET=" "$OUTPUT_FILE"; then
        sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" "$OUTPUT_FILE"
        echo "✅ Updated SESSION_SECRET"
    else
        echo "SESSION_SECRET=$SESSION_SECRET" >> "$OUTPUT_FILE"
        echo "✅ Added SESSION_SECRET"
    fi
    
    if grep -q "^JWT_SECRET=" "$OUTPUT_FILE"; then
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$OUTPUT_FILE"
        echo "✅ Updated JWT_SECRET"
    else
        echo "JWT_SECRET=$JWT_SECRET" >> "$OUTPUT_FILE"
        echo "✅ Added JWT_SECRET"
    fi
    
    rm -f "$OUTPUT_FILE.bak"
    echo ""
    echo "✅ Secrets updated in $OUTPUT_FILE"
else
    # Create new .env file from template
    if [ -f ".env.production.example" ]; then
        cp .env.production.example "$OUTPUT_FILE"
        echo "✅ Copied from .env.production.example"
    else
        # Create minimal .env
        cat > "$OUTPUT_FILE" << EOF
# MonlyAI Environment Configuration
# Generated: $(date)

# Database
DATABASE_URL=file:./database.sqlite

# Server
NODE_ENV=production
PORT=5000

# Security
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET

# Admin Credentials (CHANGE THESE!)
ADMIN_EMAIL=admin@monly.com
ADMIN_PASSWORD=change-this-password

# AI Provider (pilih: openai, openrouter, atau megallm)
AI_PROVIDER=openai

# OpenAI - GANTI DENGAN API KEY ANDA
OPENAI_API_KEY=sk-xxx

# OpenRouter (optional)
# OPENROUTER_API_KEY=sk-or-v1-xxx

# MegaLLM (optional)
# MEGALLM_API_KEY=your-key
# MEGALLM_BASE_URL=https://api.megallm.app/v1

# AI Models
AI_MODEL_CHAT=gpt-4o-mini
AI_MODEL_ANALYSIS=gpt-4o-mini
AI_MODEL_VISION=gpt-4o-mini
AI_MODEL_FALLBACK=gpt-3.5-turbo

# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false

# Google OAuth (optional)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Email (optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# EMAIL_FROM=noreply@monly.com
EOF
        echo "✅ Created new $OUTPUT_FILE"
    fi
    
    # Update secrets in the new file
    sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" "$OUTPUT_FILE"
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$OUTPUT_FILE"
    rm -f "$OUTPUT_FILE.bak"
fi

echo ""
echo "🔑 Generated Secrets:"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "⚠️  IMPORTANT: Keep these secrets safe and never commit them to git!"
echo ""
echo "📋 Next steps:"
echo "1. Edit $OUTPUT_FILE and fill in required values:"
echo "   - ADMIN_EMAIL and ADMIN_PASSWORD"
echo "   - OPENAI_API_KEY (or other AI provider)"
echo "   - MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY"
echo "2. Run: npm run migrate (to create database)"
echo "3. Run: npm run seed:admin (to create admin user)"
echo "4. Run: npm run seed:plans (to create subscription plans)"
echo "5. Start app: npm run start"
echo ""
