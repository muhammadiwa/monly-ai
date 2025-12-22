# Production Deployment Guide

## Prerequisites

- Ubuntu/Debian server dengan public IP
- Domain pointing ke server IP
- Docker & Docker Compose installed

## Quick Deploy

```bash
# 1. Clone project ke server
cd /opt
git clone <your-repo> monlyai
cd monlyai

# 2. Generate secrets
./generate-secrets.sh

# 3. Edit environment file
nano .env.production
# - Isi OPENAI_API_KEY atau AI provider lainnya
# - Update DOMAIN dan ACME_EMAIL

# 4. Deploy
./deploy.sh
```

## Install Docker (jika belum)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

## Environment Variables

Copy `.env.production.example` ke `.env.production` dan update:

```bash
# Required
DATABASE_URL=file:/app/data/database.sqlite
SESSION_SECRET=<generated-by-script>
JWT_SECRET=<generated-by-script>

# AI Provider
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx

# Domain
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

## Useful Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Monitor status
./monitor.sh

# Update & redeploy
git pull
./deploy.sh
```

## Database Backup

```bash
# Manual backup
docker exec monlyai-app cp /app/data/database.db /app/data/backup-$(date +%Y%m%d).db

# Restore from backup
docker cp backup-file.db monlyai-app:/app/data/database.db
docker-compose -f docker-compose.prod.yml restart monlyai-app
```

## Firewall Setup

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Troubleshooting

**SSL tidak bekerja:**
```bash
nslookup yourdomain.com
docker-compose -f docker-compose.prod.yml logs traefik
```

**App tidak start:**
```bash
docker-compose -f docker-compose.prod.yml logs monlyai-app
docker-compose -f docker-compose.prod.yml ps
```

**Database issues:**
```bash
docker exec monlyai-app ls -la /app/data/
```
