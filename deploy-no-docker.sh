#!/bin/bash

# MonlyAI Production Deployment Script (No Docker)
# Complete automated deployment with PM2 + Nginx + SSL

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 MonlyAI Production Deployment (No Docker)${NC}"
echo "=================================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Please do not run as root${NC}"
    echo "Run as regular user with sudo access"
    exit 1
fi

# Get domain from user
read -p "Enter your domain (e.g., monlyai.web.id): " DOMAIN
read -p "Enter your email for SSL certificate: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Domain and email are required${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📋 Configuration:${NC}"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Install Node.js if not installed
echo ""
echo -e "${BLUE}📦 Step 1: Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Step 2: Install PM2
echo ""
echo -e "${BLUE}📦 Step 2: Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    # Install PM2 without sudo (use npx or install globally for user)
    npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed"
fi

# Step 3: Install build tools
echo ""
echo -e "${BLUE}🔧 Step 3: Installing build tools...${NC}"
sudo apt install -y build-essential python3 git

# Step 4: Install dependencies
echo ""
echo -e "${BLUE}📦 Step 4: Installing application dependencies...${NC}"
npm install

# Step 5: Build application
echo ""
echo -e "${BLUE}🏗️  Step 5: Building application...${NC}"
npm run build

# Step 6: Setup environment
echo ""
echo -e "${BLUE}⚙️  Step 6: Setting up environment...${NC}"
if [ ! -f ".env.production" ]; then
    echo "Creating .env.production..."
    cp .env.example .env.production
    
    # Generate secrets
    SESSION_SECRET=$(openssl rand -hex 32)
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Update .env.production
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.production
    sed -i "s|DOMAIN=.*|DOMAIN=https://$DOMAIN|" .env.production
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" .env.production
    
    echo "✅ Environment file created"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.production and add your API keys:${NC}"
    echo "   - OPENROUTER_API_KEY or OPENAI_API_KEY"
    echo "   - AI_MODEL_* configurations"
    echo ""
    read -p "Press Enter after editing .env.production..."
else
    echo "✅ .env.production already exists"
fi

# Step 7: Initialize database
echo ""
echo -e "${BLUE}💾 Step 7: Initializing database...${NC}"

# Create data directory if not exists
mkdir -p data

# Update DATABASE_URL in .env.production if needed
if grep -q "DATABASE_URL=file:./database.sqlite" .env.production; then
    echo "Database path already configured"
else
    echo "DATABASE_URL=file:./database.sqlite" >> .env.production
fi

npm run db:push
echo "✅ Database initialized"

# Step 8: Setup PM2
echo ""
echo -e "${BLUE}🚀 Step 8: Setting up PM2...${NC}"

# Create ecosystem file with .cjs extension (CommonJS)
cat > ecosystem.config.cjs << 'EOF'
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

# Stop existing PM2 process if any
pm2 delete monly-ai 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save

# Setup startup
pm2 startup | grep "sudo" | bash || true

echo "✅ PM2 configured and started"

# Step 9: Install Nginx
echo ""
echo -e "${BLUE}🌐 Step 9: Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx already installed"
fi

# Step 10: Configure Nginx
echo ""
echo -e "${BLUE}⚙️  Step 10: Configuring Nginx...${NC}"

# Create Nginx config (without SSL first)
sudo tee /etc/nginx/sites-available/monlyai > /dev/null << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    access_log /var/log/nginx/monlyai-access.log;
    error_log /var/log/nginx/monlyai-error.log;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/system/status {
        proxy_pass http://localhost:5000;
        access_log off;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/monlyai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Nginx configured"

# Step 11: Install SSL
echo ""
echo -e "${BLUE}🔒 Step 11: Installing SSL certificate...${NC}"

# Install Certbot
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi

# Get SSL certificate
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

echo "✅ SSL certificate installed"

# Step 12: Configure Firewall
echo ""
echo -e "${BLUE}🔥 Step 12: Configuring firewall...${NC}"
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ Firewall configured"

# Step 13: Create monitoring script
echo ""
echo -e "${BLUE}📊 Step 13: Creating monitoring script...${NC}"

cat > monitor-prod.sh << 'EOFMON'
#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "📊 MonlyAI Production Monitor"
echo "=============================="

echo ""
echo "🚀 PM2 Status:"
pm2 status

echo ""
echo "💾 Disk Usage:"
df -h / | tail -1

echo ""
echo "🧠 Memory:"
free -h | head -2

echo ""
echo "🏥 Health Check:"
if curl -s -f http://localhost:5000/api/system/status >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API: Healthy${NC}"
else
    echo -e "${RED}❌ API: Unhealthy${NC}"
fi

echo ""
echo "🌐 Nginx:"
sudo systemctl is-active nginx

echo ""
echo "=============================="
echo "📋 Quick Commands:"
echo "   Logs: pm2 logs monly-ai"
echo "   Restart: pm2 restart monly-ai"
echo "   Nginx logs: sudo tail -f /var/log/nginx/monlyai-error.log"
EOFMON

chmod +x monitor-prod.sh

echo "✅ Monitoring script created"

# Final checks
echo ""
echo -e "${BLUE}🔍 Final verification...${NC}"
sleep 5

# Check PM2
if pm2 list | grep -q "monly-ai.*online"; then
    echo -e "${GREEN}✅ PM2: Running${NC}"
else
    echo -e "${RED}❌ PM2: Not running${NC}"
fi

# Check Nginx
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx: Running${NC}"
else
    echo -e "${RED}❌ Nginx: Not running${NC}"
fi

# Check application
if curl -s -f http://localhost:5000/api/system/status >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Application: Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Application: Starting (wait 30 seconds)${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}📱 Access your application:${NC}"
echo "   https://$DOMAIN"
echo ""
echo -e "${BLUE}📋 Management commands:${NC}"
echo "   Monitor: ./monitor-prod.sh"
echo "   Logs: pm2 logs monly-ai"
echo "   Restart: pm2 restart monly-ai"
echo "   Stop: pm2 stop monly-ai"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   Full guide: DEPLOYMENT-NO-DOCKER.md"
echo ""
echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo "   1. Verify .env.production has correct API keys"
echo "   2. Test application: https://$DOMAIN"
echo "   3. Check logs: pm2 logs monly-ai"
echo ""
