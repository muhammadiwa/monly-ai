#!/bin/bash

# Quick WhatsApp Fix for Production
# Run this on your production server

echo "🚀 Quick WhatsApp Web.js fix..."

# Install Chrome and dependencies
apt-get update && apt-get install -y wget gnupg
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
apt-get update && apt-get install -y google-chrome-stable

# Install essential libraries
apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2

# Set permissions and restart
cd /www/wwwroot/monlyai.web.id
mkdir -p .wwebjs_cache .wwebjs_auth
chmod 755 .wwebjs_cache .wwebjs_auth

# Kill existing process and restart
pkill -f "node dist/index.js" || true
sleep 2
npm run build
nohup npm run start > whatsapp.log 2>&1 &

echo "✅ Fixed! Check logs: tail -f whatsapp.log"
