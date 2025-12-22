# Production Deployment Guide (No Docker)

Panduan lengkap deploy MonlyAI di VPS Ubuntu tanpa Docker, menggunakan PM2 + Nginx + SSL.

## Prerequisites

- Ubuntu 20.04/22.04 VPS
- Domain pointing ke server IP (A record)
- Root/sudo access

## Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install build tools (for native modules)
sudo apt install -y build-essential python3 git
```

## Step 2: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

## Step 3: Clone & Setup Application

```bash
# Create directory
sudo mkdir -p /var/www/html
cd /var/www/html

# Clone repository
sudo git clone https://github.com/muhammadiwa/monly-ai.git
cd monly-ai

# Set ownership
sudo chown -R $USER:$USER /var/www/html/monly-ai

# Install dependencies
npm install

# Build application
npm run build
```

## Step 4: Configure Environment

```bash
# Create production environment file
cp .env.example .env.production

# Edit environment variables
nano .env.production
```

**Required variables:**
```bash
# Database
DATABASE_URL=file:./database.sqlite

# Security (generate with: openssl rand -hex 32)
SESSION_SECRET=your-session-secret-here
JWT_SECRET=your-jwt-secret-here

# AI Provider
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
AI_MODEL_CHAT=xiaomi/mimo-v2-flash:free
AI_MODEL_ANALYSIS=xiaomi/mimo-v2-flash:free
AI_MODEL_VISION=openai/gpt-4o-mini
AI_MODEL_FALLBACK=xiaomi/mimo-v2-flash:free

# Server
NODE_ENV=production
PORT=5000
TZ=Asia/Jakarta
DOMAIN=https://monlyai.web.id

# CORS
CORS_ORIGIN=https://monlyai.web.id
```

**Generate secrets:**
```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -hex 32
```

## Step 5: Initialize Database

```bash
# Push database schema
npm run db:push

# Verify database created
ls -la database.sqlite
```

## Step 6: Setup PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'monly-ai',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
}
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command output to complete setup

# Check status
pm2 status
pm2 logs monly-ai --lines 50
```

## Step 7: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/monlyai
```

**Paste this configuration:**
```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name monlyai.web.id;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name monlyai.web.id;

    # SSL certificates (will be configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/monlyai.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monlyai.web.id/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/monlyai-access.log;
    error_log /var/log/nginx/monlyai-error.log;

    # Client max body size (for file uploads)
    client_max_body_size 10M;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /api/system/status {
        proxy_pass http://localhost:5000;
        access_log off;
    }
}
```

**Enable site:**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/monlyai /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

## Step 8: Install SSL Certificate (Certbot)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d monlyai.web.id

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Verify auto-renewal
sudo certbot renew --dry-run

# Check certificate
sudo certbot certificates
```

**Certbot will automatically:**
- Get SSL certificate from Let's Encrypt
- Update Nginx configuration
- Setup auto-renewal (runs twice daily)

## Step 9: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 10: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check PM2 logs
pm2 logs monly-ai --lines 50

# Check Nginx status
sudo systemctl status nginx

# Check application health
curl http://localhost:5000/api/system/status

# Check from outside
curl https://monlyai.web.id/api/system/status
```

**Expected output:**
```json
{
  "success": true,
  "status": "operational",
  "services": {
    "api": "operational",
    "whatsapp": "degraded",
    "database": "operational"
  }
}
```

## Step 11: Access Application

Open browser and visit:
```
https://monlyai.web.id
```

You should see the MonlyAI login page with a valid SSL certificate (green padlock).

---

## Management Commands

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs monly-ai
pm2 logs monly-ai --lines 100

# Restart application
pm2 restart monly-ai

# Stop application
pm2 stop monly-ai

# Start application
pm2 start monly-ai

# Monitor resources
pm2 monit

# View detailed info
pm2 info monly-ai
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/monlyai-access.log
sudo tail -f /var/log/nginx/monlyai-error.log
```

### Application Updates

```bash
cd /var/www/html/monly-ai

# Pull latest code
git pull origin master

# Install dependencies (if package.json changed)
npm install

# Rebuild application
npm run build

# Restart PM2
pm2 restart monly-ai

# Check logs
pm2 logs monly-ai --lines 50
```

### Database Management

```bash
cd /var/www/html/monly-ai

# Backup database
cp database.sqlite database.sqlite.backup-$(date +%Y%m%d-%H%M%S)

# Push schema changes
npm run db:push

# Run migrations
npm run migrate
```

---

## Monitoring & Maintenance

### Setup Monitoring Script

```bash
# Create monitoring script
cat > /var/www/html/monly-ai/monitor-prod.sh << 'EOF'
#!/bin/bash

echo "📊 MonlyAI Production Monitor"
echo "=============================="

# PM2 Status
echo ""
echo "🚀 PM2 Status:"
pm2 status

# System Resources
echo ""
echo "💾 Disk Usage:"
df -h / | tail -1

echo ""
echo "🧠 Memory:"
free -h | head -2

# Application Health
echo ""
echo "🏥 Health Check:"
if curl -s -f http://localhost:5000/api/system/status >/dev/null 2>&1; then
    echo "✅ API: Healthy"
else
    echo "❌ API: Unhealthy"
fi

# Nginx Status
echo ""
echo "🌐 Nginx:"
sudo systemctl is-active nginx

# SSL Certificate
echo ""
echo "🔒 SSL Certificate:"
sudo certbot certificates 2>/dev/null | grep "Expiry Date" | head -1

echo ""
echo "=============================="
echo "📋 Quick Commands:"
echo "   Logs: pm2 logs monly-ai"
echo "   Restart: pm2 restart monly-ai"
echo "   Nginx logs: sudo tail -f /var/log/nginx/monlyai-error.log"
EOF

chmod +x /var/www/html/monly-ai/monitor-prod.sh

# Run monitor
./monitor-prod.sh
```

### Setup Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/monlyai
```

**Paste:**
```
/var/www/html/monly-ai/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 ubuntu ubuntu
}
```

### Setup Automated Backups

```bash
# Create backup script
cat > /var/www/html/monly-ai/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/www/html/monly-ai/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/html/monly-ai/database.sqlite $BACKUP_DIR/database-$DATE.sqlite

# Backup WhatsApp sessions
tar -czf $BACKUP_DIR/whatsapp-$DATE.tar.gz /var/www/html/monly-ai/.wwebjs_auth 2>/dev/null || true

# Keep only last 7 days
find $BACKUP_DIR -name "database-*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "whatsapp-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/html/monly-ai/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/html/monly-ai/backup.sh >> /var/www/html/monly-ai/logs/backup.log 2>&1") | crontab -
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs monly-ai --lines 100

# Check if port 5000 is available
sudo lsof -i :5000

# Restart PM2
pm2 restart monly-ai

# If still failing, check environment
pm2 env 0
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check app is listening on port 5000
curl http://localhost:5000/api/system/status

# Check Nginx error logs
sudo tail -f /var/log/nginx/monlyai-error.log

# Restart both
pm2 restart monly-ai
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# If renewal fails, get new certificate
sudo certbot --nginx -d monlyai.web.id --force-renewal
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Restart app
pm2 restart monly-ai

# If persistent, increase max memory
pm2 delete monly-ai
pm2 start ecosystem.config.js --max-memory-restart 1G
pm2 save
```

---

## Security Best Practices

1. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Setup fail2ban:**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

3. **Disable root login:**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   sudo systemctl restart sshd
   ```

4. **Regular backups:**
   - Database: Daily
   - WhatsApp sessions: Daily
   - Code: Use Git

5. **Monitor logs:**
   ```bash
   pm2 logs monly-ai
   sudo tail -f /var/log/nginx/monlyai-error.log
   ```

---

## Performance Optimization

### Enable Nginx Caching

Add to Nginx config:
```nginx
# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Enable Gzip Compression

Add to Nginx config:
```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### PM2 Cluster Mode

For better performance, use cluster mode:
```bash
pm2 delete monly-ai
pm2 start ecosystem.config.js -i max
pm2 save
```

---

## Success Checklist

- [ ] Node.js 20 installed
- [ ] PM2 installed and configured
- [ ] Application built successfully
- [ ] Database initialized
- [ ] PM2 running application
- [ ] Nginx installed and configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Application accessible via HTTPS
- [ ] Health check returns success
- [ ] PM2 startup configured
- [ ] Backups configured
- [ ] Monitoring script created

---

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs monly-ai`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/monlyai-error.log`
3. Run monitor script: `./monitor-prod.sh`
4. Check health endpoint: `curl http://localhost:5000/api/system/status`
