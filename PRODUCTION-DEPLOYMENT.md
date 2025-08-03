# 🚀 Monly AI Production Deployment Guide

## Overview
This guide will help you deploy Monly AI to production using Docker Compose with optimized settings for security, performance, and reliability.

## 📋 Prerequisites

### System Requirements
- **Docker** 20.10+ 
- **Docker Compose** 2.0+
- **Minimum RAM**: 2GB
- **Minimum Storage**: 10GB
- **OS**: Linux (Ubuntu 20.04+ recommended)

### Required Services
- Domain name with DNS pointing to your server
- SSL certificate (Let's Encrypt recommended)
- OpenAI API key

## 🛠️ Quick Start

### 1. Clone and Setup
```bash
git clone <your-repo>
cd MoneyIntelligence
chmod +x deploy-prod.sh monitor-prod.sh
```

### 2. Configure Environment
```bash
# Copy production template
cp .env.production.template .env.production

# Edit with your actual values
nano .env.production
```

### 3. Required Configuration
Update these values in `.env.production`:
```bash
# Replace with your actual values
OPENAI_API_KEY=sk-proj-your-actual-openai-api-key
SESSION_SECRET=your-super-secret-64-char-string
JWT_SECRET=your-super-secret-64-char-string
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

### 4. Deploy
```bash
./deploy-prod.sh
```

## 🔧 Configuration Details

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | ✅ | `sk-proj-abc123...` |
| `SESSION_SECRET` | Session encryption secret | ✅ | `64-char-random-string` |
| `JWT_SECRET` | JWT token secret | ✅ | `64-char-random-string` |
| `DOMAIN` | Your production domain | ✅ | `monlyai.com` |
| `ACME_EMAIL` | Email for SSL certificates | ✅ | `admin@monlyai.com` |
| `DATABASE_URL` | Database path | 🔄 | `file:/app/data/database.sqlite` |

### Generate Secure Secrets
```bash
# Generate session secret
openssl rand -hex 32

# Generate JWT secret  
openssl rand -hex 32
```

## 🗂️ File Structure

### Production Files
```
MoneyIntelligence/
├── docker-compose.prod.yml     # Production compose file
├── .env.production            # Production environment
├── deploy-prod.sh            # Deployment script
├── monitor-prod.sh           # Monitoring script
├── nginx/
│   └── nginx-prod.conf       # Nginx configuration
├── data/                     # Persistent data
│   ├── database.sqlite       # SQLite database
│   └── whatsapp_sessions/    # WhatsApp sessions
└── logs/                     # Application logs
    ├── app.log
    └── nginx/
```

## 🔒 Security Features

### Container Security
- ✅ Non-root user execution
- ✅ Read-only root filesystem where possible
- ✅ Resource limits and reservations
- ✅ Security options (no-new-privileges)
- ✅ Network isolation

### Web Security
- ✅ HTTPS enforcement
- ✅ Security headers (HSTS, CSP, XSS protection)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ SSL/TLS optimization

### Data Security
- ✅ Database file permissions
- ✅ Secure volume mounts
- ✅ Environment variable protection

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Check system status
./monitor-prod.sh

# View live logs
docker-compose -f docker-compose.prod.yml logs -f

# Check container health
docker-compose -f docker-compose.prod.yml ps
```

### Common Commands
```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose -f docker-compose.prod.yml down

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Update application
./deploy-prod.sh

# Access container shell
docker-compose -f docker-compose.prod.yml exec monlyai-prod sh

# Database backup
docker-compose -f docker-compose.prod.yml exec monlyai-prod cp /app/data/database.sqlite /app/data/backup-$(date +%Y%m%d).sqlite
```

## 🔄 Updates & Backups

### Application Updates
```bash
# Pull latest code
git pull origin main

# Redeploy
./deploy-prod.sh
```

### Database Backups
```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec monlyai-prod cp /app/data/database.sqlite /app/data/backup-$(date +%Y%m%d-%H%M%S).sqlite

# Automated backups (add to crontab)
0 2 * * * cd /path/to/MoneyIntelligence && docker-compose -f docker-compose.prod.yml exec -T monlyai-prod cp /app/data/database.sqlite /app/data/backup-$(date +\%Y\%m\%d).sqlite
```

## 🌐 SSL/TLS Setup

### Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com --email admin@yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem

# Set permissions
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

### Auto-renewal
```bash
# Add to crontab
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /path/to/MoneyIntelligence/docker-compose.prod.yml restart nginx-prod
```

## 🚨 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs monlyai-prod

# Check environment
docker-compose -f docker-compose.prod.yml config
```

#### Database Issues
```bash
# Check database file
ls -la data/database.sqlite

# Run migrations manually
docker-compose -f docker-compose.prod.yml exec monlyai-prod npm run migrate
```

#### SSL Issues
```bash
# Check certificate
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL configuration
curl -I https://yourdomain.com
```

### Log Locations
- Application logs: `logs/`
- Nginx logs: `logs/nginx/`
- Container logs: `docker-compose -f docker-compose.prod.yml logs`

## 📈 Performance Optimization

### Resource Monitoring
```bash
# Monitor resource usage
docker stats monlyai-production

# Check disk usage
du -sh data/ logs/

# Monitor network
docker-compose -f docker-compose.prod.yml exec monlyai-prod netstat -tlnp
```

### Optimization Tips
- Adjust resource limits based on usage
- Monitor database size and optimize queries
- Use log rotation for disk space management
- Consider Redis for session storage at scale

## 🆘 Support

### Getting Help
1. Check the logs first: `./monitor-prod.sh`
2. Review this documentation
3. Check GitHub issues
4. Contact support with:
   - Error logs
   - System configuration
   - Steps to reproduce

### Emergency Procedures
```bash
# Emergency stop
docker-compose -f docker-compose.prod.yml down

# Emergency backup
cp -r data/ backup-emergency-$(date +%Y%m%d-%H%M%S)/

# Rollback to previous version
git checkout previous-tag
./deploy-prod.sh
```

---

## 📝 Production Checklist

Before going live, ensure:

- [ ] ✅ Environment variables configured
- [ ] ✅ SSL certificates installed
- [ ] ✅ DNS pointing to server
- [ ] ✅ Firewall configured (ports 80, 443)
- [ ] ✅ Backups configured
- [ ] ✅ Monitoring set up
- [ ] ✅ Health checks passing
- [ ] ✅ Security headers tested
- [ ] ✅ Rate limiting tested
- [ ] ✅ Error handling tested

**🎉 You're ready for production!**
