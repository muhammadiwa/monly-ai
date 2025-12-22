#!/bin/bash

# MonlyAI Secrets Generator

echo "🔐 Generating secrets for MonlyAI..."
echo ""

SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

cat > .env.production << EOF
# MonlyAI Production Environment
# Generated: $(date)

# Database
DATABASE_URL=file:/app/data/database.sqlite

# Server
NODE_ENV=production
PORT=3000

# Security
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET

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

# Domain
DOMAIN=monlyai.web.id
ACME_EMAIL=admin@monlyai.web.id
EOF

echo "✅ Created .env.production"
echo ""
echo "⚠️  Next steps:"
echo "1. Edit .env.production"
echo "2. Isi OPENAI_API_KEY atau AI provider lainnya"
echo "3. Update DOMAIN dan ACME_EMAIL"
echo "4. Run: ./deploy.sh"
