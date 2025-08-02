# MonlyAI Production Deployment Guide

## 🚀 Quick Deployment

### Prerequisites
- Ubuntu/Debian server with public IP
- Domain `monlyai.web.id` pointing to your server IP
- Docker and Docker Compose installed

### 1. Install Docker (if not installed)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

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

### 2. Deploy Application
```bash
# Clone or upload your project to server
cd /opt
sudo git clone <your-repo> monlyai
sudo chown -R $USER:$USER monlyai
cd monlyai

# Copy and edit environment file
cp .env.production .env.production.local

# Edit the environment file with your settings
nano .env.production.local

# Make scripts executable
chmod +x deploy.sh monitor.sh

# Deploy the application
./deploy.sh
```

### 3. Post-Deployment

#### Check Status
```bash
# Monitor services
./monitor.sh

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check individual service
docker-compose -f docker-compose.prod.yml logs monlyai-app
```

#### Access Points
- **Main App**: https://monlyai.web.id
- **Traefik Dashboard**: https://traefik.monlyai.web.id (admin/password)
- **API Health**: https://monlyai.web.id/api/debug

### 4. SSL Certificate (Automatic)

Let's Encrypt certificates are automatically:
- ✅ Obtained when first accessed
- ✅ Renewed before expiry (90 days)
- ✅ Applied to all subdomains

### 5. Database & Backups (SQLite)

- **Database**: SQLite file stored in persistent volume at `/app/data/database.db`
- **No External DB**: No need for PostgreSQL/MySQL - SQLite is embedded
- **Backups**: Daily automatic backups in `backup_data` volume
- **WhatsApp Sessions**: Persistent at `whatsapp_sessions` volume
- **Lightweight**: Perfect for small to medium applications

### 6. Maintenance Commands

```bash
# Update application
git pull
./deploy.sh

# View monitoring dashboard
./monitor.sh

# Restart specific service
docker-compose -f docker-compose.prod.yml restart monlyai-app

# Scale application (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale monlyai-app=2

# Backup database manually
docker exec monlyai-app cp /app/data/database.db /app/data/manual-backup-$(date +%Y%m%d).db

# Restore from backup
docker cp backup-file.db monlyai-app:/app/data/database.db
docker-compose -f docker-compose.prod.yml restart monlyai-app
```

### 7. Security Considerations

#### Firewall Setup
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # Traefik Dashboard (optional)
sudo ufw enable
```

#### Environment Variables
Make sure to change these in `.env.production.local`:
- `SESSION_SECRET`: Use strong random string
- `JWT_SECRET`: Use strong random string  
- `ACME_EMAIL`: Your email for Let's Encrypt
- `TRAEFIK_DASHBOARD_AUTH`: Generate with `htpasswd`

#### Generate Basic Auth for Traefik Dashboard
```bash
# Install apache2-utils for htpasswd
sudo apt install apache2-utils

# Generate auth string (replace 'yourpassword')
htpasswd -nb admin yourpassword
```

### 8. Troubleshooting

#### Common Issues

**SSL Not Working:**
```bash
# Check if domain resolves to server
nslookup monlyai.web.id

# Check Traefik logs
docker-compose -f docker-compose.prod.yml logs traefik

# Force SSL certificate renewal
docker exec traefik rm /letsencrypt/acme.json
docker-compose -f docker-compose.prod.yml restart traefik
```

**Application Not Starting:**
```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs monlyai-app

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart application
docker-compose -f docker-compose.prod.yml restart monlyai-app
```

**Database Issues:**
```bash
# Check database permissions
docker exec monlyai-app ls -la /app/data/

# Reset database (CAUTION: This deletes all data)
docker-compose -f docker-compose.prod.yml down
docker volume rm monlyai_app_data
./deploy.sh
```

### 9. Performance Optimization

#### For High Traffic
```bash
# Scale application instances
docker-compose -f docker-compose.prod.yml up -d --scale monlyai-app=3

# Monitor resource usage
docker stats

# Check server resources
htop
df -h
free -m
```

### 10. Monitoring & Alerts

Setup monitoring for:
- SSL certificate expiry
- Application health checks
- Disk space usage
- Memory usage
- Database backup success

Example cron job for daily health checks:
```bash
# Add to crontab
0 9 * * * cd /opt/monlyai && ./monitor.sh > /tmp/monlyai-health.log 2>&1
```

---

## 🎯 Summary

Your MonlyAI application will be:
- ✅ Running on https://monlyai.web.id with automatic SSL
- ✅ Protected by Traefik reverse proxy
- ✅ Database automatically backed up daily
- ✅ WhatsApp sessions persisted
- ✅ SSL certificates auto-renewed
- ✅ Fully containerized and scalable

The setup includes everything needed for a production-ready deployment with enterprise-grade SSL handling!
