# 🚀 MonlyAI Deployment Guide

Panduan deployment MonlyAI menggunakan Docker dengan Nginx sebagai reverse proxy pada port non-standard untuk menghindari konflik dengan Apache/Nginx yang sudah ada.

## 📋 Prerequisites

- Docker & Docker Compose terinstall
- Git terinstall
- Port 8888 tersedia (tidak digunakan aplikasi lain)
- File `.env.production` sudah dikonfigurasi

## 🛠️ Setup Environment

1. **Copy environment file:**
```bash
cp .env.production.example .env.production
```

2. **Edit environment variables:**
```bash
nano .env.production
```

Required variables:
```env
OPENAI_API_KEY=your_openai_api_key
SESSION_SECRET=your_session_secret_min_32_chars
JWT_SECRET=your_jwt_secret_min_32_chars
```

## 🚀 Quick Deployment

### Option 1: Simple HTTP Deployment (Recommended untuk testing)

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

Access app: `http://your-server-ip:8888`

### Option 2: Manual Deployment

```bash
# Stop existing containers
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Build and start
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

## 🔐 SSL Setup (Optional)

Jika ingin menggunakan SSL dengan domain:

1. **Update nginx configuration:**
```bash
# Backup current config
mv nginx/nginx-dev.conf nginx/nginx-dev.conf.bak

# Use SSL config
cp nginx/nginx.conf nginx/nginx-production.conf
```

2. **Update docker-compose.prod.yml untuk SSL:**
```yaml
nginx:
  volumes:
    - ./nginx/nginx-production.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
  ports:
    - "8888:80"
    - "8889:443"
```

3. **Generate SSL certificate:**
```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

## 📊 Monitoring & Logs

### View logs:
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f monlyai-app
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Check container status:
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Resource usage:
```bash
docker stats
```

## 🔧 Configuration Details

### Port Configuration:
- **Port 8888**: HTTP access (no SSL conflicts)
- **Port 8889**: HTTPS access (when SSL enabled)
- **Internal Port 3000**: Application container

### Network Architecture:
```
Internet → Nginx (Port 8888) → MonlyAI App (Port 3000)
```

### Volume Mounts:
- `app_data`: Database dan persistent storage
- `whatsapp_sessions`: WhatsApp Web.js sessions
- `nginx_logs`: Nginx access/error logs
- `backup_data`: Database backups

## 🚨 Troubleshooting

### Container tidak bisa start:
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart specific service
docker-compose -f docker-compose.prod.yml restart monlyai-app
```

### Port sudah digunakan:
```bash
# Check what's using port 8888
sudo netstat -tulpn | grep 8888

# Kill process if needed
sudo kill -9 <PID>
```

### Database issues:
```bash
# Reset database (WARNING: Deletes all data)
docker-compose -f docker-compose.prod.yml down -v
```

### SSL Certificate issues:
```bash
# Remove existing certificates
rm -rf nginx/ssl/*

# Regenerate
./setup-ssl.sh
```

## 🔄 Updates & Maintenance

### Update application:
```bash
# Pull latest code
git pull origin feat-reminder

# Redeploy
./deploy.sh
```

### Database backup:
```bash
# Manual backup
docker exec monlyai-app cp /app/data/database.db /backups/manual-backup-$(date +%Y%m%d).db
```

### Clean unused Docker resources:
```bash
docker system prune -a
```

## 🛡️ Security Considerations

1. **Firewall setup:**
```bash
# Allow only necessary ports
sudo ufw allow 8888/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

2. **Environment variables:**
- Never commit `.env.production` to git
- Use strong secrets (min 32 characters)
- Regularly rotate API keys

3. **Nginx security:**
- Rate limiting enabled
- Security headers configured
- File upload limits set

## 📞 Support

Jika mengalami masalah:

1. Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Verify environment: `cat .env.production`
3. Check port availability: `sudo netstat -tulpn | grep 8888`
4. Restart services: `./deploy.sh`

---

**Created for MonlyAI - Financial Intelligence Platform**
**Port Configuration: HTTP:8888 (No conflicts with existing Apache/Nginx)**
