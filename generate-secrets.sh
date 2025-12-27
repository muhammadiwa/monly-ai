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
    # Create new .env file with all variables
    cat > "$OUTPUT_FILE" << 'EOF'
# =============================================================================
# MONLY AI - Environment Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# -----------------------------------------------------------------------------
DATABASE_URL=file:./database.sqlite

# -----------------------------------------------------------------------------
# AI PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------
# Pilih provider AI: "openai", "openrouter", atau "megallm"
AI_PROVIDER=openrouter

# OpenAI Configuration (jika AI_PROVIDER=openai)
# Dapatkan API key di: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxx

# OpenRouter Configuration (jika AI_PROVIDER=openrouter)
# Dapatkan API key di: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# MegaLLM Configuration (jika AI_PROVIDER=megallm)
# Dapatkan API key di: https://megallm.app atau https://ai.megallm.io
MEGALLM_API_KEY=sk-mega-xxx
MEGALLM_BASE_URL=https://ai.megallm.io/v1

# Model per task (sesuaikan format dengan provider yang dipilih)
# OpenRouter: gunakan format "provider/model" (e.g., openai/gpt-4o-mini)
# MegaLLM/OpenAI: gunakan nama model langsung (e.g., gpt-4o-mini)
AI_MODEL_CHAT=xiaomi/mimo-v2-flash:free
AI_MODEL_ANALYSIS=xiaomi/mimo-v2-flash:free
AI_MODEL_VISION=openai/gpt-4o-mini
AI_MODEL_FALLBACK=xiaomi/mimo-v2-flash:free

# -----------------------------------------------------------------------------
# AUTHENTICATION & SECURITY
# -----------------------------------------------------------------------------
SESSION_SECRET=PLACEHOLDER_SESSION_SECRET
JWT_SECRET=PLACEHOLDER_JWT_SECRET

# -----------------------------------------------------------------------------
# SERVER CONFIGURATION
# -----------------------------------------------------------------------------
NODE_ENV=production
PORT=5000
TZ=Asia/Jakarta

# Domain untuk production
DOMAIN=http://your-domain.com

# CORS Configuration
CORS_ORIGIN=http://your-domain.com

# -----------------------------------------------------------------------------
# OPTIONAL: WHATSAPP INTEGRATION
# -----------------------------------------------------------------------------
WHATSAPP_ENABLED=false
WHATSAPP_AUTO_INIT=true

# -----------------------------------------------------------------------------
# OPTIONAL: RATE LIMITING
# -----------------------------------------------------------------------------
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# -----------------------------------------------------------------------------
# OPTIONAL: LOGGING
# -----------------------------------------------------------------------------
LOG_LEVEL=info

# -----------------------------------------------------------------------------
# MIDTRANS PAYMENT GATEWAY
# -----------------------------------------------------------------------------
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_WEBHOOK_URL=http://your-domain.com/api/webhooks/midtrans

# -----------------------------------------------------------------------------
# GOOGLE OAUTH (OPTIONAL)
# -----------------------------------------------------------------------------
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
# GOOGLE_CALLBACK_URL=http://your-domain.com/api/auth/google/callback
EOF
    
    # Replace placeholders with generated secrets
    sed -i.bak "s/PLACEHOLDER_SESSION_SECRET/$SESSION_SECRET/" "$OUTPUT_FILE"
    sed -i.bak "s/PLACEHOLDER_JWT_SECRET/$JWT_SECRET/" "$OUTPUT_FILE"
    rm -f "$OUTPUT_FILE.bak"
    
    echo "✅ Created new $OUTPUT_FILE with generated secrets"
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
echo "   - AI_PROVIDER (openai, openrouter, atau megallm)"
echo "   - API keys untuk provider yang dipilih"
echo "   - MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY"
echo "   - DOMAIN (your production domain)"
echo "2. Run: npm run migrate (to create database)"
echo "3. Run: npm run seed:admin (to create admin user)"
echo "4. Run: npm run seed:plans (to create subscription plans)"
echo "5. Start app: npm run start"
echo ""
