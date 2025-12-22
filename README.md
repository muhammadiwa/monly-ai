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


## WhatsApp Integration Management

### Health Monitoring

Check WhatsApp bot health status:
```bash
npm run whatsapp:health

# Or directly:
curl http://localhost:5000/api/system/whatsapp-health
```

### Version Management

Current WhatsApp Web.js version is **locked at 1.34.2** to prevent breaking changes.

**Why version locking?**
- WhatsApp Web.js frequently updates
- Updates can introduce breaking changes
- Locked version ensures stability in production

### Rollback to Stable Version

If WhatsApp bot stops working after an update:

```bash
# Windows
npm run whatsapp:rollback

# Mac/Linux
npm run whatsapp:rollback:unix
```

This will:
1. Stop the application
2. Backup current WhatsApp session
3. Clear cache
4. Install stable version (1.34.2)
5. Restart application

### Update Strategy

See [WHATSAPP_UPDATE_STRATEGY.md](./WHATSAPP_UPDATE_STRATEGY.md) for complete guide on:
- Monitoring for updates
- Testing new versions
- Safe update process
- Automated health checks
- CI/CD integration

### Health Monitoring Features

The app includes automatic health monitoring:
- ✅ Checks WhatsApp connection every 5 minutes
- ✅ Auto-recovery after 3 failed checks
- ✅ Detailed health status endpoint
- ✅ System metrics and AI provider info

**Health Status Endpoint:**
```bash
GET /api/system/whatsapp-health

Response:
{
  "success": true,
  "timestamp": "2025-12-22T10:00:00.000Z",
  "whatsapp": {
    "version": "1.34.2",
    "status": "ready",
    "connected": true
  },
  "healthMonitor": {
    "connected": true,
    "failureCount": 0,
    "lastCheck": "2025-12-22T10:00:00.000Z"
  },
  "aiProvider": {
    "provider": "openrouter",
    "models": {...}
  },
  "system": {
    "uptime": 3600,
    "memory": {...}
  }
}
```

## Troubleshooting

### WhatsApp Bot Not Responding

1. Check health status:
   ```bash
   npm run whatsapp:health
   ```

2. Check logs for errors:
   ```bash
   pm2 logs monly-ai  # Production
   # Or check console in development
   ```

3. If bot is disconnected, try rollback:
   ```bash
   npm run whatsapp:rollback
   ```

4. Clear session and restart:
   ```bash
   # Stop app
   pm2 stop monly-ai
   
   # Clear WhatsApp session
   rm -rf .wwebjs_auth .wwebjs_cache
   
   # Restart
   pm2 restart monly-ai
   ```

### After WhatsApp Web.js Update

If you manually updated WhatsApp Web.js and things broke:

1. **Immediate rollback:**
   ```bash
   npm run whatsapp:rollback
   ```

2. **Check what changed:**
   - Review [WhatsApp Web.js changelog](https://github.com/pedroslopez/whatsapp-web.js/releases)
   - Check for breaking changes
   - Test in staging first

3. **Update safely:**
   - Test in development first
   - Monitor health endpoint
   - Keep backup of working version
   - Update version lock in rollback script

### Health Monitor Not Working

If automatic recovery isn't working:

1. Check if health monitor is running:
   ```bash
   curl http://localhost:5000/api/system/whatsapp-health
   ```

2. Restart application:
   ```bash
   pm2 restart monly-ai
   ```

3. Check server logs for health monitor messages:
   ```bash
   pm2 logs monly-ai | grep "Health"
   ```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete production deployment guide.

**Important for Production:**
- ✅ WhatsApp Web.js version is locked
- ✅ Health monitoring is automatic
- ✅ Rollback script is ready
- ✅ Session backups are created
- ✅ Monitor `/api/system/whatsapp-health` endpoint

