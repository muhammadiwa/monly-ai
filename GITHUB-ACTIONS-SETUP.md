# GitHub Actions Setup untuk Auto-Deploy ke VPS

## 📋 Prerequisites

1. VPS dengan akses SSH (IP: 43.156.75.101)
2. Node.js dan npm terinstall di VPS
3. PM2 terinstall di VPS untuk process management
4. Git terinstall di VPS
5. Repository sudah di-clone di `/var/www/html/monly-ai`

## 🔑 Step 1: Generate SSH Key untuk GitHub Actions

Di VPS, jalankan:

```bash
# Login ke VPS
ssh root@43.156.75.101

# Generate SSH key khusus untuk GitHub Actions
ssh-keygen -t ed25519 -C "github-actions@monly-ai" -f ~/.ssh/github_actions_key

# Tampilkan private key (untuk disimpan di GitHub Secrets)
cat ~/.ssh/github_actions_key

# Tampilkan public key
cat ~/.ssh/github_actions_key.pub
```

## 🔐 Step 2: Setup SSH Key di VPS

```bash
# Tambahkan public key ke authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# Set permissions yang benar
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

## 🔧 Step 3: Setup GitHub Secrets

Buka repository di GitHub: https://github.com/muhammadiwa/monly-ai

1. Klik **Settings** → **Secrets and variables** → **Actions**
2. Klik **New repository secret**
3. Tambahkan secrets berikut:

| Secret Name | Value | Deskripsi |
|-------------|-------|-----------|
| `VPS_HOST` | `43.156.75.101` | IP address VPS |
| `VPS_USERNAME` | `root` | Username SSH (biasanya root) |
| `VPS_SSH_KEY` | `[isi private key]` | Isi dari `~/.ssh/github_actions_key` |
| `VPS_PORT` | `22` | Port SSH (default 22) |

### Cara Copy Private Key:

```bash
# Di VPS, copy seluruh output ini ke GitHub Secret VPS_SSH_KEY
cat ~/.ssh/github_actions_key
```

Output akan seperti ini (copy SEMUA termasuk header dan footer):
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
[banyak baris]
...
-----END OPENSSH PRIVATE KEY-----
```

## 📦 Step 4: Setup Project di VPS

```bash
# Login ke VPS
ssh root@43.156.75.101

# Pastikan directory ada
cd /var/www/html/monly-ai

# Pastikan git remote sudah benar
git remote -v

# Jika belum ada, tambahkan remote
git remote add origin https://github.com/muhammadiwa/monly-ai.git

# Checkout ke branch production
git fetch origin
git checkout production
git pull origin production

# Install dependencies
npm ci

# Build aplikasi
npm run build

# Setup .env file (copy dari .env.example)
cp .env.example .env
nano .env  # Edit sesuai kebutuhan

# Install PM2 globally jika belum
npm install -g pm2

# Start aplikasi dengan PM2
pm2 start npm --name "monly-ai" -- run start:unix

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Jalankan command yang muncul dari output di atas

# Check status
pm2 status
pm2 logs monly-ai
```

## 🚀 Step 5: Test Deployment

### Manual Test:

```bash
# Di local machine, push ke branch production
git checkout production
git push origin production
```

### Cek GitHub Actions:

1. Buka https://github.com/muhammadiwa/monly-ai/actions
2. Lihat workflow "Deploy to Production" yang sedang berjalan
3. Klik untuk melihat detail logs

### Workflow akan:

1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Type check
5. ✅ Build application
6. ✅ Run tests (optional)
7. ✅ Deploy ke VPS via SSH:
   - Pull latest code dari branch production
   - Install dependencies
   - Build aplikasi
   - Run migrations
   - Restart PM2
8. ✅ Health check

## 🔍 Troubleshooting

### Error: Permission denied (publickey)

```bash
# Di VPS, cek permissions
ls -la ~/.ssh/
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Error: PM2 not found

```bash
# Install PM2 globally
npm install -g pm2

# Atau gunakan npx
npx pm2 start npm --name "monly-ai" -- run start:unix
```

### Error: Port already in use

```bash
# Check process di port 5000
lsof -i :5000

# Kill process jika perlu
pm2 delete monly-ai
pm2 start npm --name "monly-ai" -- run start:unix
```

### Error: Database locked

```bash
# Stop aplikasi
pm2 stop monly-ai

# Backup database
cp database.sqlite database.sqlite.backup

# Start ulang
pm2 start monly-ai
```

### Cek Logs:

```bash
# Di VPS
pm2 logs monly-ai --lines 100

# Atau
pm2 logs monly-ai --err  # Error logs only
```

## 📊 Monitoring

### Check Application Status:

```bash
# PM2 status
pm2 status

# Detailed info
pm2 info monly-ai

# Monitor real-time
pm2 monit
```

### Check Deployment History:

```bash
# Git log
cd /var/www/html/monly-ai
git log --oneline -10

# Check current branch
git branch
```

## 🔄 Rollback (jika deployment gagal)

```bash
# Di VPS
cd /var/www/html/monly-ai

# Lihat commit history
git log --oneline -10

# Rollback ke commit sebelumnya
git reset --hard <commit-hash>

# Rebuild
npm ci
npm run build

# Restart
pm2 restart monly-ai
```

## 🎯 Best Practices

1. **Selalu test di local dulu** sebelum push ke production
2. **Gunakan branch feat/*** untuk development
3. **Merge ke production** hanya setelah testing
4. **Backup database** sebelum deployment besar
5. **Monitor logs** setelah deployment
6. **Setup monitoring** (Uptime Robot, New Relic, dll)

## 📝 Deployment Checklist

Sebelum push ke production:

- [ ] Code sudah di-test di local
- [ ] Build berhasil tanpa error
- [ ] Database migrations sudah di-test
- [ ] Environment variables sudah di-set di VPS
- [ ] Backup database production
- [ ] Inform team tentang deployment
- [ ] Monitor logs setelah deployment

## 🆘 Emergency Contacts

Jika deployment gagal dan aplikasi down:

1. Cek GitHub Actions logs
2. SSH ke VPS dan cek PM2 logs
3. Rollback ke commit sebelumnya
4. Contact DevOps team

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [SSH Key Setup](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
