# CI/CD Setup Guide

Panduan setup CI/CD untuk auto-deploy MonlyAI ke VPS menggunakan GitHub Actions.

## Arsitektur

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Developer │───▶│   GitHub    │───▶│   GitHub    │───▶│    VPS      │
│   Push      │    │   (main)    │    │   Actions   │    │  Production │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
                                    ┌───────────────┐
                                    │ 1. npm ci     │
                                    │ 2. npm check  │
                                    │ 3. npm build  │
                                    │ 4. SSH Deploy │
                                    └───────────────┘
```

## Prerequisites

1. Repository di GitHub
2. VPS dengan akses SSH
3. PM2 sudah terinstall di VPS
4. Project sudah di-clone di VPS

## Setup GitHub Secrets

Buka repository GitHub → Settings → Secrets and variables → Actions → New repository secret

Tambahkan secrets berikut:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `VPS_HOST` | IP atau domain VPS | `123.456.789.0` atau `monlyai.web.id` |
| `VPS_USERNAME` | Username SSH | `ubuntu` atau `root` |
| `VPS_SSH_KEY` | Private SSH key | (isi dengan private key) |
| `VPS_PORT` | Port SSH (optional) | `22` |
| `APP_PATH` | Path aplikasi di VPS | `/var/www/monly-ai` |

### Generate SSH Key (jika belum ada)

```bash
# Di local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key ke VPS
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-vps-ip

# Copy private key untuk GitHub Secret
cat ~/.ssh/id_ed25519
# Copy seluruh output (termasuk -----BEGIN dan -----END)
```

## Setup VPS (One-time)

### 1. Clone Repository

```bash
cd /var/www
git clone https://github.com/your-username/monly-ai.git
cd monly-ai
```

### 2. Setup Environment

```bash
cp .env.production.example .env.production
nano .env.production
# Edit sesuai kebutuhan
```

### 3. Initial Deploy

```bash
# Install dependencies
npm ci

# Build
npm run build

# Setup database
npm run db:push

# Start dengan PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 4. Setup Nginx (jika belum)

```bash
# Jalankan script deployment
chmod +x deploy-no-docker.sh
./deploy-no-docker.sh
```

## Workflow

### Automatic Deploy (Push to main)

1. Developer push ke branch `main`
2. GitHub Actions trigger workflow
3. Build & test di GitHub runner
4. Jika sukses, SSH ke VPS dan deploy
5. Health check untuk verifikasi

### Manual Deploy

Jika perlu deploy manual:

```bash
# SSH ke VPS
ssh user@your-vps-ip

# Navigate ke project
cd /var/www/monly-ai

# Pull & deploy
git pull origin main
npm ci
npm run build
npm run db:push
pm2 restart monly-ai
```

## Monitoring

### Check Deployment Status

- Buka GitHub → Actions tab
- Lihat status workflow terbaru

### Check Application Status

```bash
# SSH ke VPS
ssh user@your-vps-ip

# Check PM2 status
pm2 status

# Check logs
pm2 logs monly-ai

# Health check
curl http://localhost:5000/api/system/status
```

## Troubleshooting

### Build Failed

```bash
# Check GitHub Actions logs
# Biasanya karena:
# - TypeScript error
# - Missing dependencies
# - Test failure
```

### Deploy Failed

```bash
# SSH ke VPS dan check:
pm2 logs monly-ai --lines 50

# Check disk space
df -h

# Check memory
free -h
```

### SSH Connection Failed

```bash
# Verify SSH key
ssh -i ~/.ssh/id_ed25519 user@vps-ip

# Check VPS firewall
sudo ufw status

# Ensure port 22 is open
sudo ufw allow 22/tcp
```

## Advanced: Docker Deployment

Jika prefer Docker, ubah deploy step di `.github/workflows/deploy.yml`:

```yaml
script: |
  cd ${{ secrets.APP_PATH }}
  git pull origin main
  docker compose -f docker-compose.prod.yml down
  docker compose -f docker-compose.prod.yml build --no-cache
  docker compose -f docker-compose.prod.yml up -d
```

## Security Best Practices

1. **Jangan commit secrets** - Gunakan GitHub Secrets
2. **Gunakan SSH key** - Jangan password
3. **Limit SSH access** - Hanya dari GitHub Actions IP jika memungkinkan
4. **Regular updates** - Update dependencies secara berkala
5. **Backup database** - Sebelum deploy major changes

## Rollback

Jika deployment bermasalah:

```bash
# SSH ke VPS
ssh user@your-vps-ip
cd /var/www/monly-ai

# Rollback ke commit sebelumnya
git log --oneline -5  # Lihat commit history
git checkout <previous-commit-hash>

# Rebuild & restart
npm ci
npm run build
pm2 restart monly-ai
```
