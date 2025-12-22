# Quick Start - Deploy Tanpa Docker

Panduan cepat deploy MonlyAI di VPS Ubuntu tanpa Docker.

## Prerequisites

- Ubuntu 20.04/22.04 VPS
- Domain sudah pointing ke IP server
- Root/sudo access

## One-Command Deploy

```bash
# Di server Ubuntu
cd /var/www/html/monly-ai
chmod +x deploy-no-docker.sh
./deploy-no-docker.sh
```

Script akan otomatis:
1. ✅ Install Node.js 20
2. ✅ Install PM2
3. ✅ Install dependencies
4. ✅ Build application
5. ✅ Setup environment
6. ✅ Initialize database
7. ✅ Start dengan PM2
8. ✅ Install & configure Nginx
9. ✅ Install SSL certificate
10. ✅ Configure firewall
11. ✅ Create monitoring script

## Manual Steps (Jika Script Gagal)

### 1. Install Dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2

# Build tools
sudo apt install -y build-essential python3 git
```

### 2. Setup Application

```bash
cd /var/www/html/monly-ai

# Install & build
npm install
npm run build

# Setup environment
cp .env.example .env.production
nano .env.production  # Edit API keys

# Initialize database
npm run db:push
```

### 3. Start with PM2

```bash
# Create ecosystem file
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
    max_memory_restart: '500M',
    autorestart: true
  }]
}
EOF

# Start
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/monlyai
```

Paste:
```nginx
server {
    listen 80;
    server_name monlyai.web.id;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/monlyai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Install SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d monlyai.web.id
```

### 7. Configure Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Verify Deployment

```bash
# Check PM2
pm2 status

# Check logs
pm2 logs monly-ai

# Check health
curl http://localhost:5000/api/system/status

# Check from outside
curl https://monlyai.web.id/api/system/status
```

## Management Commands

```bash
# View logs
pm2 logs monly-ai

# Restart
pm2 restart monly-ai

# Stop
pm2 stop monly-ai

# Monitor
pm2 monit

# Nginx logs
sudo tail -f /var/log/nginx/monlyai-error.log
```

## Update Application

```bash
cd /var/www/html/monly-ai

# Pull latest code
git pull origin master

# Install dependencies (if needed)
npm install

# Rebuild
npm run build

# Restart
pm2 restart monly-ai

# Check logs
pm2 logs monly-ai --lines 50
```

## Troubleshooting

### Application not starting

```bash
# Check logs
pm2 logs monly-ai --lines 100

# Check if port 5000 is free
sudo lsof -i :5000

# Restart
pm2 restart monly-ai
```

### Nginx 502 Error

```bash
# Check if app is running
pm2 status

# Check app health
curl http://localhost:5000/api/system/status

# Check Nginx logs
sudo tail -f /var/log/nginx/monlyai-error.log

# Restart both
pm2 restart monly-ai
sudo systemctl restart nginx
```

### SSL Issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Force renewal
sudo certbot --nginx -d monlyai.web.id --force-renewal
```

## Success Checklist

- [ ] Node.js 20 installed
- [ ] PM2 running application
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Application accessible via HTTPS
- [ ] Health check returns success

## Next Steps

1. ✅ Verify application works: https://monlyai.web.id
2. ✅ Check logs: `pm2 logs monly-ai`
3. ✅ Setup monitoring: `./monitor-prod.sh`
4. ✅ Configure backups (see DEPLOYMENT-NO-DOCKER.md)

## Full Documentation

For complete guide, see: [DEPLOYMENT-NO-DOCKER.md](./DEPLOYMENT-NO-DOCKER.md)
