#!/bin/bash

# Install WhatsApp Web.js Dependencies for Production Server
# This script installs all required dependencies for Puppeteer and Chrome

echo "🔧 Installing WhatsApp Web.js dependencies for production..."

# Update package list
echo "📦 Updating package list..."
apt-get update

# Install Chrome dependencies
echo "🌐 Installing Chrome and dependencies..."
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
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
    lsb-release \
    wget \
    xdg-utils

# Install Google Chrome
echo "🌐 Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
apt-get update
apt-get install -y google-chrome-stable

# Verify Chrome installation
echo "✅ Verifying Chrome installation..."
google-chrome --version

# Create Chrome wrapper script for better compatibility
echo "🔧 Creating Chrome wrapper script..."
cat > /usr/bin/chrome-wrapper.sh << 'EOF'
#!/bin/bash
/usr/bin/google-chrome-stable \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-accelerated-2d-canvas \
  --no-first-run \
  --no-zygote \
  --single-process \
  --disable-gpu \
  --remote-debugging-port=9222 \
  "$@"
EOF

chmod +x /usr/bin/chrome-wrapper.sh

# Install additional fonts
echo "🔤 Installing additional fonts..."
apt-get install -y fonts-liberation fonts-dejavu-core fontconfig

# Clean up
echo "🧹 Cleaning up..."
apt-get autoremove -y
apt-get autoclean

echo "✅ WhatsApp Web.js dependencies installation completed!"
echo "📝 Chrome path: /usr/bin/google-chrome-stable"
echo "📝 Wrapper script: /usr/bin/chrome-wrapper.sh"
echo ""
echo "🔄 Please restart your Node.js application to use the new Chrome installation."
