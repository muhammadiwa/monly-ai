# WhatsApp Web.js Rollback Script (PowerShell)
# Rolls back to a known working version

param(
    [string]$BackupVersion = "1.34.2",
    [string]$AppName = "monly-ai"
)

Write-Host "🔄 WhatsApp Web.js Rollback Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Target version: $BackupVersion" -ForegroundColor Yellow
Write-Host ""

# Check if running in production
if ($env:NODE_ENV -eq "production") {
    Write-Host "⚠️  Running in PRODUCTION mode" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to rollback? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "❌ Rollback cancelled" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 1: Stopping application..." -ForegroundColor Cyan
try {
    pm2 stop $AppName 2>$null
    Write-Host "✅ Application stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠️  App not running in PM2" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Backing up current WhatsApp session..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups/whatsapp-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if (Test-Path ".wwebjs_auth") {
    Copy-Item -Path ".wwebjs_auth" -Destination "$backupDir/" -Recurse -ErrorAction SilentlyContinue
}

if (Test-Path ".wwebjs_cache") {
    Copy-Item -Path ".wwebjs_cache" -Destination "$backupDir/" -Recurse -ErrorAction SilentlyContinue
}

Write-Host "✅ Backup saved to: $backupDir" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Clearing WhatsApp session..." -ForegroundColor Cyan
Remove-Item -Path ".wwebjs_auth" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".wwebjs_cache" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Session cleared" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Installing WhatsApp Web.js v$BackupVersion..." -ForegroundColor Cyan
npm install "whatsapp-web.js@$BackupVersion" --save-exact
Write-Host "✅ Package installed" -ForegroundColor Green

Write-Host ""
Write-Host "Step 5: Restarting application..." -ForegroundColor Cyan
try {
    pm2 restart $AppName 2>$null
    if ($LASTEXITCODE -ne 0) {
        pm2 start npm --name $AppName -- start
    }
    Write-Host "✅ Application restarted with PM2" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PM2 not found. Please restart manually:" -ForegroundColor Yellow
    Write-Host "   npm run start" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Rollback complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Monitor logs: pm2 logs $AppName"
Write-Host "2. Check health: curl http://localhost:5000/api/system/whatsapp-health"
Write-Host "3. Test WhatsApp functionality"
Write-Host ""
Write-Host "💾 Session backup location: $backupDir" -ForegroundColor Yellow
Write-Host ""
