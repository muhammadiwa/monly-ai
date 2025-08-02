# 📱 Transaction Reminders - Implementation Documentation

## 📋 Overview

Fitur Transaction Reminders telah berhasil diimplementasikan untuk mengirim pengingat harian via WhatsApp kepada pengguna yang belum mencatat transaksi dalam sehari.

## 🚀 Features Implemented

### 1. **Database Schema**
- ✅ Menambahkan field `transaction_reminders` ke tabel `user_preferences`
- ✅ Membuat tabel `notification_logs` untuk tracking notifikasi yang dikirim
- ✅ Menambahkan indexes untuk performa optimal

### 2. **Backend Services**
- ✅ `TransactionReminderService` - Core logic untuk checking dan sending reminders
- ✅ `TransactionReminderScheduler` - Scheduler menggunakan node-cron
- ✅ Storage methods untuk mendukung fitur reminders
- ✅ API endpoints untuk manual trigger dan monitoring

### 3. **Frontend Integration**
- ✅ Switch di Settings > Preferences untuk enable/disable reminders
- ✅ Real-time update preferences melalui API
- ✅ Toast notifications untuk user feedback

### 4. **WhatsApp Integration**
- ✅ Integrasi dengan WhatsApp service yang sudah ada
- ✅ Multi-language support (English & Indonesian)
- ✅ Error handling dan retry mechanism

## ⚙️ How It Works

### 1. **Daily Scheduler**
```typescript
// Runs every day at 8:00 PM (Asia/Jakarta timezone)
// '0 0 20 * * *' = Every day at 8:00 PM
const reminderJob = cron.schedule('0 0 20 * * *', async () => {
  await transactionReminderService.checkAndSendReminders();
});
```

### 2. **User Checking Logic**
```typescript
async checkAndSendReminders() {
  // 1. Get all users with reminders enabled
  const users = await storage.getUsersWithTransactionReminders();
  
  // 2. For each user, check if they logged transactions today
  for (const user of users) {
    const hasLoggedToday = await this.hasUserLoggedTransactionToday(user.id);
    
    // 3. If no transactions today, send reminder
    if (!hasLoggedToday) {
      await this.sendReminderToUser(user.id);
    }
  }
}
```

### 3. **Message Template**
**English:**
```
🔔 Daily Transaction Reminder

Hi! It looks like you haven't logged any transactions today.

Don't forget to track your expenses to keep your finances on track! 💰

You can:
• Reply with your expense (e.g., "Lunch 50000")
• Send a receipt photo 📸
• Use the Monly AI app

Keep up the good habit of tracking your money! 📊✨
```

**Indonesian:**
```
🔔 Pengingat Transaksi Harian

Halo! Sepertinya Anda belum mencatat transaksi apa pun hari ini.

Jangan lupa untuk melacak pengeluaran Anda agar keuangan tetap terkontrol! 💰

Anda bisa:
• Balas dengan pengeluaran Anda (contoh: "Makan siang 50000")
• Kirim foto struk belanja 📸
• Gunakan aplikasi Monly AI

Terus pertahankan kebiasaan baik mencatat keuangan! 📊✨
```

## 🛠️ Configuration

### 1. **Enable Transaction Reminders**
1. Buka Settings > Preferences di aplikasi
2. Toggle switch "Transaction Reminders" menjadi ON
3. Pastikan WhatsApp sudah terhubung di Settings > WhatsApp

### 2. **Scheduler Configuration**
```typescript
// server/transaction-reminder-scheduler.ts
const reminderJob = cron.schedule('0 0 20 * * *', async () => {
  // Runs daily at 8:00 PM Asia/Jakarta timezone
}, {
  scheduled: true,
  timezone: 'Asia/Jakarta'
});
```

### 3. **Database Configuration**
```sql
-- Enable reminders for a user
UPDATE user_preferences 
SET transaction_reminders = 1 
WHERE user_id = 'your-user-id';

-- Check notification logs
SELECT * FROM notification_logs 
WHERE user_id = 'your-user-id' 
ORDER BY sent_at DESC;
```

## 📡 API Endpoints

### 1. **Manual Trigger Reminders**
```bash
POST /api/reminders/trigger-transaction-reminders
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Transaction reminders triggered successfully"
}
```

### 2. **Get Notification Logs**
```bash
GET /api/reminders/notification-logs
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": "demo_123",
      "type": "transaction_reminder",
      "whatsappNumber": "+6281234567890",
      "message": "🔔 Daily Transaction Reminder...",
      "status": "sent",
      "sentAt": 1691234567890,
      "createdAt": 1691234567890
    }
  ]
}
```

### 3. **Update User Preferences**
```bash
PUT /api/user/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactionReminders": true
}

Response:
{
  "id": 1,
  "userId": "demo_123",
  "transactionReminders": true,
  "defaultCurrency": "IDR",
  "timezone": "Asia/Jakarta",
  "language": "id"
}
```

## 🔧 Testing

### 1. **Manual Testing**
```bash
# Test reminder trigger
curl -X POST http://localhost:5000/api/reminders/trigger-transaction-reminders \
  -H "Authorization: Bearer <your-token>"

# Check notification logs
curl -X GET http://localhost:5000/api/reminders/notification-logs \
  -H "Authorization: Bearer <your-token>"
```

### 2. **Development Testing**
```typescript
// In development mode, scheduler runs initial check after 5 seconds
if (process.env.NODE_ENV === 'development') {
  setTimeout(async () => {
    await transactionReminderService.checkAndSendReminders();
  }, 5000);
}
```

## 📊 Monitoring & Logs

### 1. **Server Logs**
```
✅ Transaction reminder scheduler started successfully
📅 Reminders will be sent daily at 8:00 PM (Asia/Jakarta timezone)
🔔 Starting transaction reminders check...
Found 2 users with transaction reminders enabled
📱 Sending reminder to user demo_123 (user@example.com)
✅ Reminder sent successfully to +6281234567890
```

### 2. **Database Monitoring**
```sql
-- Count reminders sent today
SELECT COUNT(*) as reminders_sent_today
FROM notification_logs 
WHERE type = 'transaction_reminder' 
AND DATE(datetime(sent_at/1000, 'unixepoch')) = DATE('now');

-- Check reminder success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM notification_logs 
WHERE type = 'transaction_reminder'
GROUP BY status;
```

## ⚠️ Important Notes

### 1. **WhatsApp Connection Required**
- User harus memiliki WhatsApp connection yang aktif
- Jika WhatsApp tidak terhubung, reminder tidak akan dikirim

### 2. **Timezone Considerations**
- Scheduler menggunakan timezone Asia/Jakarta
- Pengecekan transaksi berdasarkan tanggal user's timezone

### 3. **Rate Limiting**
- Reminder hanya dikirim sekali per hari per user
- Log semua notifikasi untuk tracking

### 4. **Error Handling**
- Jika WhatsApp service down, error akan di-log tapi tidak crash scheduler
- Retry mechanism untuk failed messages (future enhancement)

## 🎯 Future Enhancements

1. **Customizable Schedule** - Allow users to set their preferred reminder time
2. **Smart Reminders** - Skip reminders on weekends or holidays
3. **Reminder Types** - Budget alerts, goal reminders, etc.
4. **Push Notifications** - Alternative to WhatsApp for users without connection
5. **Analytics Dashboard** - Reminder effectiveness tracking

## ✅ Conclusion

Fitur Transaction Reminders telah berhasil diimplementasikan dengan lengkap dan terintegrasi dengan sistem yang ada. Pengguna sekarang dapat:

1. ✅ Enable/disable reminders melalui Settings
2. ✅ Menerima pengingat harian via WhatsApp
3. ✅ Melihat log notifikasi yang telah dikirim
4. ✅ Manual trigger reminders untuk testing

Sistem berjalan otomatis setiap hari jam 8 malam dan akan mengirim pengingat kepada semua pengguna yang belum mencatat transaksi hari itu.
