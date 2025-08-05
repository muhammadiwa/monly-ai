#!/bin/bash

echo "🔍 QUICK DIAGNOSIS - 502 ERROR"
echo "=============================="
echo

cd /www/wwwroot/monly.web.id || cd /www/wwwroot/monlyai.web.id || { echo "❌ Can't find app directory"; exit 1; }

echo "📍 Current directory: $(pwd)"
echo "📅 Current time: $(date)"

echo
echo "1️⃣ CHECKING NODE PROCESSES:"
ps aux | grep -E "node|npm" | grep -v grep || echo "❌ No Node processes running"

echo
echo "2️⃣ CHECKING PORT STATUS:"
netstat -tulpn | grep -E ":3009|:3030|:8080" || echo "❌ No app ports listening"

echo
echo "3️⃣ CHECKING APPLICATION FILES:"
echo "✓ package.json exists: $([ -f package.json ] && echo "YES" || echo "NO")"
echo "✓ dist/ exists: $([ -d dist ] && echo "YES" || echo "NO")"  
echo "✓ .env exists: $([ -f .env ] && echo "YES" || echo "NO")"
echo "✓ node_modules exists: $([ -d node_modules ] && echo "YES" || echo "NO")"

if [ -f .env ]; then
    echo
    echo "4️⃣ ENVIRONMENT VARIABLES:"
    grep -E "PORT|NODE_ENV|DOMAIN" .env || echo "❌ Key env vars missing"
fi

echo
echo "5️⃣ RECENT LOGS (if any):"
if [ -f app.log ]; then
    echo "--- Last 10 lines of app.log ---"
    tail -10 app.log
elif [ -f nohup.out ]; then
    echo "--- Last 10 lines of nohup.out ---"
    tail -10 nohup.out
else
    echo "❌ No log files found"
fi

echo
echo "6️⃣ DISK SPACE:"
df -h $(pwd)

echo
echo "7️⃣ MEMORY USAGE:"
free -h

echo
echo "🎯 QUICK FIXES TO TRY:"
echo "====================:"
echo "1. Run: pkill -f node && sleep 3"
echo "2. Check aaPanel project status" 
echo "3. Verify port configuration (should be 3009)"
echo "4. Run emergency-fix.sh script"
echo "5. Check project memory limit in aaPanel"
echo
echo "🔧 MOST LIKELY CAUSES:"
echo "- Application crashed and didn't restart"
echo "- Wrong port configuration in aaPanel"  
echo "- Out of memory"
echo "- Missing dependencies"
echo "- Environment variables not loaded"
