# MonlyAI - Personal Finance Manager

Aplikasi manajemen keuangan pribadi dengan fitur AI untuk tracking pengeluaran, budget, dan goals.

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env dan isi API keys

# 3. Run development server
npm run dev          # Windows
npm run dev:unix     # Mac/Linux
```

Aplikasi akan berjalan di `http://localhost:5000`

## Environment Variables

```bash
# Required
DATABASE_URL=file:./database.sqlite
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# AI Provider (pilih salah satu)
AI_PROVIDER=openai              # atau "openrouter" atau "megallm"

# OpenAI
OPENAI_API_KEY=sk-xxx

# OpenRouter (100+ models)
OPENROUTER_API_KEY=sk-or-v1-xxx

# MegaLLM
MEGALLM_API_KEY=your-key
MEGALLM_BASE_URL=https://api.megallm.app/v1

# Model per task (optional)
AI_MODEL_CHAT=gpt-4o-mini
AI_MODEL_ANALYSIS=gpt-4o-mini
AI_MODEL_VISION=gpt-4o-mini
AI_MODEL_FALLBACK=gpt-3.5-turbo
```

## Available Commands

```bash
# Development
npm run dev              # Start dev server (Windows)
npm run dev:unix         # Start dev server (Unix)

# Production
npm run build            # Build for production
npm run start            # Start production server (Windows)
npm run start:unix       # Start production server (Unix)

# Database
npm run db:push          # Push schema changes
npm run migrate          # Run migrations
npm run migrate:status   # Check migration status

# Type checking
npm run check            # Run TypeScript compiler
```

## Production Deployment

Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) untuk panduan lengkap deployment dengan Docker.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Express.js, SQLite, Drizzle ORM
- **AI**: OpenAI / OpenRouter / MegaLLM
- **Integrations**: WhatsApp Web.js, node-cron

## Features

- Transaction tracking dengan AI categorization
- Budget management dengan alerts
- Financial goals dengan savings plans
- Receipt OCR scanning
- AI chat assistant
- WhatsApp notifications
- Multi-currency & multi-language support
