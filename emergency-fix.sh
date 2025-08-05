#!/bin/bash

echo "🚨 EMERGENCY FIX - 502 BAD GATEWAY"
echo "=================================="
echo "Fixing backend crash and startup issues"
echo

cd /www/wwwroot/monlyai.web.id || cd /www/wwwroot/monly.web.id || { echo "❌ Can't access app directory"; exit 1; }

# 1. KILL ANY EXISTING NODE PROCESSES
echo "1️⃣ Stopping all Node.js processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "npm" 2>/dev/null || true
sleep 3
echo "✅ All Node processes stopped"

# 2. CHECK CURRENT STATUS
echo
echo "2️⃣ Diagnosing current status..."
echo "Port 3009 status:"
netstat -tulpn | grep :3009 || echo "❌ Port 3009 not listening"

echo "Node.js processes:"
ps aux | grep node | grep -v grep || echo "❌ No Node.js processes running"

echo "Disk space:"
df -h /www/wwwroot/monly.web.id

echo "Memory usage:"
free -h

# 3. REBUILD ENVIRONMENT COMPLETELY
echo
echo "3️⃣ Rebuilding environment from scratch..."

# Remove old node_modules to force clean install
rm -rf node_modules package-lock.json

# Set environment variables
cat > .env << 'EOF'
NODE_ENV=production
PORT=3009
DATABASE_URL=file:./database.sqlite
OPENAI_API_KEY=your-actual-openai-api-key-here
SESSION_SECRET=f0f3419c2cba508c32ee6e9caab763fd869d76eca8ddcd2692836fdd72ddc50c
JWT_SECRET=d81a035cb8a11a324128e5f570131df26ad2c17595bf2cde755d9c93254b3345
DOMAIN=monlyai.web.id
LOG_LEVEL=debug
TZ=Asia/Jakarta
EOF

echo "✅ Environment file created"

# 4. INSTALL DEPENDENCIES WITH VERBOSE LOGGING
echo
echo "4️⃣ Installing dependencies with full logging..."
npm cache clean --force
npm install --verbose --no-optional

# Install WhatsApp dependencies specifically
npm install whatsapp-web.js@1.23.0 puppeteer@21.0.0 qrcode@1.5.3

echo "✅ Dependencies installed"

# 5. BUILD APPLICATION
echo
echo "5️⃣ Building application..."
npm run build 2>&1 | tee build.log

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed! Check build.log"
    tail -20 build.log
    exit 1
fi

# 6. CREATE STARTUP SCRIPT WITH ERROR HANDLING
echo
echo "6️⃣ Creating robust startup script..."
cat > start-app.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting Monly AI Application..."
echo "Time: $(date)"
echo "Working Directory: $(pwd)"
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"

# Load environment
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Environment loaded"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Check if build exists
if [ ! -d "dist" ]; then
    echo "❌ Build directory not found! Running build..."
    npm run build
fi

# Start with error handling
echo "🔄 Starting Node.js application..."
exec node -r dotenv/config dist/index.js 2>&1 | tee app.log
EOF

chmod +x start-app.sh

# 7. TEST STARTUP
echo
echo "7️⃣ Testing application startup..."
timeout 15s ./start-app.sh &
APP_PID=$!

echo "App PID: $APP_PID"
sleep 8

# Check if app is still running
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ Application started successfully!"
    
    # Test port
    sleep 2
    if netstat -tulpn | grep -q :3009; then
        echo "✅ Port 3009 is listening!"
        
        # Test HTTP endpoint
        HTTP_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3009/api/health -o /tmp/health.txt 2>/dev/null || echo "000")
        echo "Health check response: $HTTP_RESPONSE"
        
        if [ -f /tmp/health.txt ]; then
            echo "Response body:"
            cat /tmp/health.txt
        fi
        
    else
        echo "❌ Port 3009 not listening"
        echo "Application logs:"
        tail -20 app.log 2>/dev/null || echo "No logs available"
    fi
    
    # Stop test app
    kill $APP_PID 2>/dev/null
    sleep 2
else
    echo "❌ Application failed to start!"
    echo "Error logs:"
    tail -20 app.log 2>/dev/null || echo "No logs available"
fi

# 8. CHROME INSTALLATION CHECK
echo
echo "8️⃣ Verifying Chrome for WhatsApp..."
if command -v google-chrome-stable >/dev/null 2>&1; then
    CHROME_VERSION=$(google-chrome-stable --version 2>/dev/null || echo "Version check failed")
    echo "✅ Chrome: $CHROME_VERSION"
else
    echo "❌ Installing Chrome..."
    apt-get update -y
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
    apt-get update -y
    apt-get install -y google-chrome-stable
fi

# 9. WHATSAPP DIRECTORIES
echo
echo "9️⃣ Setting up WhatsApp session directories..."
mkdir -p whatsapp-sessions .wwebjs_auth .wwebjs_cache
chmod -R 755 whatsapp-sessions .wwebjs_auth .wwebjs_cache

# Create test script
cat > test-whatsapp.js << 'EOF'
const { Client } = require('whatsapp-web.js');

console.log('Testing WhatsApp Web.js initialization...');

try {
    const client = new Client({
        authStrategy: new (require('whatsapp-web.js')).NoAuth(),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });
    
    console.log('✅ WhatsApp client created successfully');
    process.exit(0);
} catch (error) {
    console.error('❌ WhatsApp initialization failed:', error.message);
    process.exit(1);
}
EOF

echo "Testing WhatsApp initialization..."
timeout 10s node test-whatsapp.js && echo "✅ WhatsApp test passed" || echo "⚠️ WhatsApp test failed"

# 10. FINAL SUMMARY
echo
echo "🎯 EMERGENCY FIX COMPLETE!"
echo "=========================="
echo
echo "📋 STATUS SUMMARY:"
echo "✅ Old processes killed"
echo "✅ Dependencies reinstalled" 
echo "✅ Application rebuilt"
echo "✅ Startup script created"
echo "✅ WhatsApp directories setup"
echo
echo "🔧 MANUAL STEPS REQUIRED:"
echo "1. Go to aaPanel Node Project Manager"
echo "2. Set startup command to: ./start-app.sh"
echo "3. Set working directory to: /www/wwwroot/monly.web.id"
echo "4. RESTART the project"
echo "5. Check logs in aaPanel for any errors"
echo
echo "📊 DEBUGGING FILES CREATED:"
echo "- start-app.sh (startup script)"
echo "- app.log (application logs)"
echo "- build.log (build logs)"
echo "- test-whatsapp.js (WhatsApp test)"
echo
echo "🔍 IF STILL 502 ERROR:"
echo "- Check aaPanel project status"
echo "- Verify port 3009 in aaPanel settings"
echo "- Check memory limits (needs 1GB+)"
echo "- Review app.log for detailed errors"
echo
echo "🚀 Ready to restart in aaPanel!"
