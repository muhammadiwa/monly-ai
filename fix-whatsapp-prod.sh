#!/bin/bash

# Comprehensive WhatsApp Web.js Fix for Production
echo "🔧 Fixing WhatsApp Web.js for production server..."

# Step 1: Install Chrome dependencies
echo "📦 Installing Chrome dependencies..."
apt-get update
apt-get install -y wget gnupg

# Step 2: Install Google Chrome
echo "🌐 Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
apt-get update
apt-get install -y google-chrome-stable

# Step 3: Install required libraries
echo "📚 Installing required libraries..."
apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils

# Step 4: Verify Chrome installation
echo "✅ Verifying Chrome installation..."
if command -v google-chrome-stable &> /dev/null; then
    echo "✅ Chrome installed successfully:"
    google-chrome-stable --version
else
    echo "❌ Chrome installation failed"
    exit 1
fi

# Step 5: Set environment variable for Chrome path
echo "🔧 Setting Chrome path..."
echo "export CHROME_PATH=/usr/bin/google-chrome-stable" >> ~/.bashrc
export CHROME_PATH=/usr/bin/google-chrome-stable

# Step 6: Create .wwebjs_cache directory with proper permissions
echo "📁 Setting up WhatsApp cache directory..."
cd /www/wwwroot/monlyai.web.id
mkdir -p .wwebjs_cache .wwebjs_auth
chmod 755 .wwebjs_cache .wwebjs_auth

# Step 7: Install missing npm dependencies
echo "📦 Checking npm dependencies..."
npm install puppeteer-core --save-dev

# Step 8: Test Chrome executable
echo "🧪 Testing Chrome executable..."
google-chrome-stable --headless --disable-gpu --remote-debugging-port=9222 --no-sandbox --version

# Step 9: Build application
echo "🔨 Building application..."
npm run build

# Step 10: Restart application
echo "🔄 Restarting application..."
pkill -f "node dist/index.js" || true
sleep 2

# Start in background
nohup npm run start > app.log 2>&1 &
echo "✅ Application restarted"

echo "🎉 WhatsApp Web.js fix completed!"
echo "📝 Chrome path: /usr/bin/google-chrome-stable"
echo "📝 Cache directory: .wwebjs_cache"
echo "📝 Auth directory: .wwebjs_auth"
echo ""
echo "📊 Check application logs: tail -f app.log"
