#!/bin/bash

# WhatsApp Web.js Rollback Script
# Rolls back to a known working version

set -e  # Exit on error

# Configuration
BACKUP_VERSION="1.34.2"  # Update this when you upgrade successfully
APP_NAME="monly-ai"

echo "🔄 WhatsApp Web.js Rollback Script"
echo "=================================="
echo ""
echo "📦 Target version: $BACKUP_VERSION"
echo ""

# Check if running in production
if [ "$NODE_ENV" = "production" ]; then
    echo "⚠️  Running in PRODUCTION mode"
    read -p "Are you sure you want to rollback? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Rollback cancelled"
        exit 1
    fi
fi

echo ""
echo "Step 1: Stopping application..."
if command -v pm2 &> /dev/null; then
    pm2 stop $APP_NAME || echo "⚠️  App not running in PM2"
else
    echo "⚠️  PM2 not found, skipping stop"
fi

echo ""
echo "Step 2: Backing up current WhatsApp session..."
BACKUP_DIR="backups/whatsapp-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d ".wwebjs_auth" ]; then
    cp -r .wwebjs_auth "$BACKUP_DIR/" || echo "⚠️  Failed to backup auth"
fi

if [ -d ".wwebjs_cache" ]; then
    cp -r .wwebjs_cache "$BACKUP_DIR/" || echo "⚠️  Failed to backup cache"
fi

echo "✅ Backup saved to: $BACKUP_DIR"

echo ""
echo "Step 3: Clearing WhatsApp session..."
rm -rf .wwebjs_auth .wwebjs_cache
echo "✅ Session cleared"

echo ""
echo "Step 4: Installing WhatsApp Web.js v$BACKUP_VERSION..."
npm install whatsapp-web.js@$BACKUP_VERSION --save-exact
echo "✅ Package installed"

echo ""
echo "Step 5: Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart $APP_NAME || pm2 start npm --name $APP_NAME -- start
    echo "✅ Application restarted with PM2"
else
    echo "⚠️  PM2 not found. Please restart manually:"
    echo "   npm run start"
fi

echo ""
echo "=================================="
echo "✅ Rollback complete!"
echo ""
echo "📋 Next steps:"
echo "1. Monitor logs: pm2 logs $APP_NAME"
echo "2. Check health: curl http://localhost:5000/api/system/whatsapp-health"
echo "3. Test WhatsApp functionality"
echo ""
echo "💾 Session backup location: $BACKUP_DIR"
echo ""
