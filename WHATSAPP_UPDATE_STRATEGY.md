# WhatsApp Web.js Update Strategy

## 🎯 Masalah
WhatsApp Web.js sering update dan bisa menyebabkan breaking changes yang membuat fitur tidak berfungsi di production.

## ✅ Solusi Lengkap

### 1. **Version Pinning (Lock Version)**

#### Current Version
```json
"whatsapp-web.js": "^1.34.2"  // ❌ Auto-update (berbahaya)
```

#### Recommended: Pin Exact Version
```json
"whatsapp-web.js": "1.34.2"   // ✅ Locked version (aman)
```

**Cara Update `package.json`:**
```bash
# Hapus ^ untuk lock version
npm install whatsapp-web.js@1.34.2 --save-exact
```

---

### 2. **Automated Update Monitoring**

#### A. GitHub Dependabot (Recommended)
Buat file `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    # Hanya monitor, tidak auto-merge
    reviewers:
      - "your-github-username"
    labels:
      - "dependencies"
      - "whatsapp-update"
```

#### B. Renovate Bot (Alternative)
Buat file `renovate.json`:

```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchPackageNames": ["whatsapp-web.js"],
      "groupName": "WhatsApp Web.js",
      "automerge": false,
      "schedule": ["before 3am on Monday"]
    }
  ]
}
```

---

### 3. **Update Testing Workflow**

#### Script untuk Test Update
Buat file `scripts/test-whatsapp-update.sh`:

```bash
#!/bin/bash

echo "🧪 Testing WhatsApp Web.js Update..."

# Backup current version
CURRENT_VERSION=$(npm list whatsapp-web.js --depth=0 | grep whatsapp-web.js | awk '{print $2}')
echo "📦 Current version: $CURRENT_VERSION"

# Install latest version in test environment
npm install whatsapp-web.js@latest --no-save

# Run tests
echo "🔄 Running WhatsApp bot tests..."
npm run test:whatsapp

# Check if tests passed
if [ $? -eq 0 ]; then
    echo "✅ Tests passed! Safe to update."
    echo "Run: npm install whatsapp-web.js@latest --save-exact"
else
    echo "❌ Tests failed! Do not update yet."
    # Rollback
    npm install whatsapp-web.js@$CURRENT_VERSION --save-exact
fi
```

#### Test Script di `package.json`:
```json
{
  "scripts": {
    "test:whatsapp": "tsx scripts/test-whatsapp.ts",
    "update:whatsapp": "bash scripts/test-whatsapp-update.sh"
  }
}
```

---

### 4. **Health Check & Auto-Recovery**

#### A. WhatsApp Health Monitor
Buat file `server/whatsapp-health-monitor.ts`:

```typescript
import { getSingleBotConnectionState } from './whatsapp-single-bot';

export class WhatsAppHealthMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private failureCount = 0;
  private readonly MAX_FAILURES = 3;

  start() {
    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, 5 * 60 * 1000);
  }

  private async checkHealth() {
    const state = getSingleBotConnectionState();
    
    if (!state.connected) {
      this.failureCount++;
      console.warn(`⚠️ WhatsApp bot disconnected (${this.failureCount}/${this.MAX_FAILURES})`);
      
      if (this.failureCount >= this.MAX_FAILURES) {
        console.error('❌ WhatsApp bot failed health check. Sending alert...');
        await this.sendAlert();
        // Optional: Auto-restart
        await this.attemptRestart();
      }
    } else {
      this.failureCount = 0; // Reset on success
    }
  }

  private async sendAlert() {
    // Send email/Telegram/Slack notification
    console.log('📧 Sending alert to admin...');
    // TODO: Implement notification
  }

  private async attemptRestart() {
    console.log('🔄 Attempting to restart WhatsApp bot...');
    // TODO: Implement restart logic
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
```

#### B. Add to `server/index.ts`:
```typescript
import { WhatsAppHealthMonitor } from './whatsapp-health-monitor';

const healthMonitor = new WhatsAppHealthMonitor();
healthMonitor.start();
```

---

### 5. **Version Compatibility Layer**

#### Abstraction untuk Handle Breaking Changes
Buat file `server/whatsapp-adapter.ts`:

```typescript
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

/**
 * Adapter pattern untuk handle breaking changes
 * antar versi WhatsApp Web.js
 */
export class WhatsAppAdapter {
  private client: any;
  private version: string;

  constructor() {
    this.version = this.getVersion();
    this.client = this.createClient();
  }

  private getVersion(): string {
    // Get installed version
    const packageJson = require('whatsapp-web.js/package.json');
    return packageJson.version;
  }

  private createClient() {
    console.log(`📦 WhatsApp Web.js version: ${this.version}`);
    
    // Version-specific configuration
    const config: any = {
      authStrategy: new LocalAuth({ clientId: 'monly-bot' }),
      puppeteer: {
        args: ['--no-sandbox']
      }
    };

    // Handle version-specific changes
    if (this.isVersionGreaterThan('1.35.0')) {
      // New version might have different config
      config.puppeteer.args.push('--disable-setuid-sandbox');
    }

    return new Client(config);
  }

  private isVersionGreaterThan(targetVersion: string): boolean {
    const current = this.version.split('.').map(Number);
    const target = targetVersion.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (current[i] > target[i]) return true;
      if (current[i] < target[i]) return false;
    }
    return false;
  }

  getClient() {
    return this.client;
  }
}
```

---

### 6. **CI/CD Integration**

#### GitHub Actions Workflow
Buat file `.github/workflows/whatsapp-update-check.yml`:

```yaml
name: WhatsApp Web.js Update Check

on:
  schedule:
    # Check for updates every Monday at 3 AM
    - cron: '0 3 * * 1'
  workflow_dispatch: # Manual trigger

jobs:
  check-update:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Check for WhatsApp Web.js updates
        id: check
        run: |
          CURRENT=$(npm list whatsapp-web.js --depth=0 | grep whatsapp-web.js | awk '{print $2}')
          LATEST=$(npm view whatsapp-web.js version)
          echo "current=$CURRENT" >> $GITHUB_OUTPUT
          echo "latest=$LATEST" >> $GITHUB_OUTPUT
          
      - name: Test with latest version
        if: steps.check.outputs.current != steps.check.outputs.latest
        run: |
          npm install whatsapp-web.js@latest --no-save
          npm run test:whatsapp
          
      - name: Create issue if update available
        if: steps.check.outputs.current != steps.check.outputs.latest
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔄 WhatsApp Web.js Update Available',
              body: `
                ## Update Available
                
                - Current: ${{ steps.check.outputs.current }}
                - Latest: ${{ steps.check.outputs.latest }}
                
                ## Action Required
                1. Review changelog: https://github.com/pedroslopez/whatsapp-web.js/releases
                2. Test in staging environment
                3. Update if safe: \`npm install whatsapp-web.js@${{ steps.check.outputs.latest }} --save-exact\`
              `,
              labels: ['dependencies', 'whatsapp-update']
            })
```

---

### 7. **Rollback Strategy**

#### Quick Rollback Script
Buat file `scripts/rollback-whatsapp.sh`:

```bash
#!/bin/bash

# Rollback to previous working version
BACKUP_VERSION="1.34.2"  # Update this when you upgrade

echo "🔄 Rolling back WhatsApp Web.js to $BACKUP_VERSION..."

# Stop application
pm2 stop monly-ai

# Clear WhatsApp session
rm -rf .wwebjs_auth .wwebjs_cache

# Install backup version
npm install whatsapp-web.js@$BACKUP_VERSION --save-exact

# Restart application
pm2 start monly-ai

echo "✅ Rollback complete!"
```

---

### 8. **Production Update Checklist**

```markdown
## Pre-Update Checklist
- [ ] Backup database
- [ ] Backup WhatsApp session (.wwebjs_auth)
- [ ] Review changelog
- [ ] Test in staging environment
- [ ] Schedule maintenance window
- [ ] Notify users

## Update Process
- [ ] Stop application
- [ ] Update package: `npm install whatsapp-web.js@X.X.X --save-exact`
- [ ] Clear cache if needed
- [ ] Start application
- [ ] Monitor logs for 30 minutes
- [ ] Test all WhatsApp features

## Post-Update Verification
- [ ] QR code generation works
- [ ] Message receiving works
- [ ] Message sending works
- [ ] Image processing works
- [ ] Voice processing works
- [ ] No memory leaks
- [ ] No connection drops

## Rollback Plan
If issues occur:
- [ ] Run rollback script
- [ ] Restore session backup
- [ ] Verify functionality
- [ ] Document issues
```

---

## 🚀 Recommended Implementation Order

1. **Immediate** (Do now):
   - Lock version in package.json: `"whatsapp-web.js": "1.34.2"`
   - Create rollback script

2. **This Week**:
   - Add health monitoring
   - Create update testing script
   - Setup GitHub Dependabot

3. **This Month**:
   - Implement version adapter
   - Setup CI/CD workflow
   - Document update process

---

## 📊 Monitoring Dashboard

Track WhatsApp Web.js health:

```typescript
// Add to monitoring endpoint
app.get('/api/admin/whatsapp-health', async (req, res) => {
  const state = getSingleBotConnectionState();
  const packageJson = require('whatsapp-web.js/package.json');
  
  res.json({
    version: packageJson.version,
    status: state.status,
    connected: state.connected,
    uptime: process.uptime(),
    lastCheck: new Date().toISOString()
  });
});
```

---

## 🔔 Alert Notifications

Setup alerts untuk:
- WhatsApp bot disconnected > 5 minutes
- New version available
- Health check failures
- Session expired

**Tools:**
- Email: Nodemailer
- Telegram: node-telegram-bot-api
- Slack: @slack/webhook
- Discord: discord.js

---

## 📚 Resources

- [WhatsApp Web.js Changelog](https://github.com/pedroslopez/whatsapp-web.js/releases)
- [WhatsApp Web.js Discord](https://discord.gg/wyKybbF)
- [Breaking Changes Guide](https://github.com/pedroslopez/whatsapp-web.js/wiki/Breaking-Changes)
