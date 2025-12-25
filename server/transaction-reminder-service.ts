import { storage } from './storage';
import { sendSingleBotMessage } from './whatsapp-single-bot';
import { InsertNotificationLog } from '@shared/schema';

interface TransactionReminderService {
  checkAndSendReminders(): Promise<void>;
  checkAndSendRemindersForTimezone(timezone: string): Promise<void>;
  sendReminderToUser(userId: string): Promise<void>;
  hasUserLoggedTransactionToday(userId: string, timezone: string): Promise<boolean>;
  getUserWhatsAppNumbers(userId: string): Promise<string[]>;
  logNotification(log: InsertNotificationLog): Promise<void>;
}

class TransactionReminderServiceImpl implements TransactionReminderService {

  /**
   * Check all users and send reminders (manual trigger - all users)
   */
  async checkAndSendReminders(): Promise<void> {
    console.log('🔔 Starting transaction reminders check (all users)...');

    try {
      const usersWithReminders = await storage.getUsersWithTransactionReminders();
      console.log(`Found ${usersWithReminders.length} users with transaction reminders enabled`);

      for (const user of usersWithReminders) {
        try {
          const userPrefs = await storage.getUserPreferences(user.id);
          const timezone = userPrefs?.timezone || 'Asia/Jakarta';
          const hasLoggedToday = await this.hasUserLoggedTransactionToday(user.id, timezone);

          if (!hasLoggedToday) {
            console.log(`📱 Sending reminder to user ${user.id} (${user.email})`);
            await this.sendReminderToUser(user.id);
          } else {
            console.log(`✅ User ${user.id} has already logged transactions today`);
          }
        } catch (error) {
          console.error(`❌ Error processing reminders for user ${user.id}:`, error);
        }
      }

      console.log('✅ Transaction reminders check completed');
    } catch (error) {
      console.error('❌ Error in transaction reminders check:', error);
    }
  }

  /**
   * Send reminders only to users with the specified timezone
   */
  async checkAndSendRemindersForTimezone(timezone: string): Promise<void> {
    console.log(`🔔 Starting transaction reminders for timezone: ${timezone}...`);

    try {
      const usersWithReminders = await storage.getUsersWithTransactionReminders();
      console.log(`Found ${usersWithReminders.length} users with transaction reminders enabled`);

      let sentCount = 0;
      let skippedCount = 0;

      for (const user of usersWithReminders) {
        try {
          const userPrefs = await storage.getUserPreferences(user.id);
          const userTimezone = userPrefs?.timezone || 'Asia/Jakarta';

          // Only process users with matching timezone
          if (userTimezone !== timezone) {
            continue;
          }

          const hasLoggedToday = await this.hasUserLoggedTransactionToday(user.id, userTimezone);

          if (!hasLoggedToday) {
            console.log(`📱 Sending reminder to user ${user.id} (${user.email}) [${userTimezone}]`);
            await this.sendReminderToUser(user.id);
            sentCount++;
          } else {
            console.log(`✅ User ${user.id} has already logged transactions today`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing reminders for user ${user.id}:`, error);
        }
      }

      console.log(`✅ Timezone ${timezone} reminders completed: ${sentCount} sent, ${skippedCount} skipped`);
    } catch (error) {
      console.error(`❌ Error in timezone ${timezone} reminders:`, error);
    }
  }

  /**
   * Send reminder message to a specific user
   */
  async sendReminderToUser(userId: string): Promise<void> {
    try {
      const whatsappNumbers = await this.getUserWhatsAppNumbers(userId);

      if (whatsappNumbers.length === 0) {
        console.log(`⚠️ User ${userId} has no WhatsApp numbers connected`);
        return;
      }

      const userPrefs = await storage.getUserPreferences(userId);
      const language = userPrefs?.language || 'en';
      const message = this.createReminderMessage(language);

      for (const whatsappNumber of whatsappNumbers) {
        try {
          const result = await sendSingleBotMessage(whatsappNumber, message);

          await this.logNotification({
            userId,
            type: 'transaction_reminder',
            whatsappNumber,
            message,
            status: result.success ? 'sent' : 'failed',
            sentAt: Math.floor(Date.now() / 1000),
            errorMessage: result.success ? undefined : result.message,
          });

          if (result.success) {
            console.log(`✅ Reminder sent to ${whatsappNumber}`);
          } else {
            console.error(`❌ Failed to send to ${whatsappNumber}: ${result.message}`);
          }
        } catch (error) {
          console.error(`❌ Error sending to ${whatsappNumber}:`, error);
          await this.logNotification({
            userId,
            type: 'transaction_reminder',
            whatsappNumber,
            message,
            status: 'failed',
            sentAt: Math.floor(Date.now() / 1000),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error sending reminder to user ${userId}:`, error);
    }
  }

  /**
   * Check if user has logged any transaction today (in their timezone)
   */
  async hasUserLoggedTransactionToday(userId: string, timezone: string = 'Asia/Jakarta'): Promise<boolean> {
    try {
      const now = new Date();

      // Get today's date in user's timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const todayStr = formatter.format(now);
      const [year, month, day] = todayStr.split('-').map(Number);

      // Calculate start/end of day in UTC
      const tzOffset = this.getTimezoneOffset(timezone);
      const todayStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const todayEndUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      const todayTimestamp = Math.floor((todayStartUTC.getTime() - tzOffset) / 1000);
      const tomorrowTimestamp = Math.floor((todayEndUTC.getTime() - tzOffset + 1000) / 1000);

      const transactions = await storage.getUserTransactionsInDateRange(
        userId,
        todayTimestamp,
        tomorrowTimestamp
      );

      return transactions.length > 0;
    } catch (error) {
      console.error(`Error checking transactions for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get timezone offset in milliseconds
   */
  private getTimezoneOffset(timezone: string): number {
    const offsets: Record<string, number> = {
      'UTC': 0,
      'Asia/Jakarta': 7 * 60 * 60 * 1000, // UTC+7
    };
    return offsets[timezone] || offsets['Asia/Jakarta'];
  }

  async getUserWhatsAppNumbers(userId: string): Promise<string[]> {
    try {
      const integrations = await storage.getUserWhatsAppIntegrations(userId);
      return integrations
        .filter(integration => integration.status === 'active')
        .map(integration => integration.whatsappNumber);
    } catch (error) {
      console.error(`Error getting WhatsApp numbers for user ${userId}:`, error);
      return [];
    }
  }

  async logNotification(log: InsertNotificationLog): Promise<void> {
    try {
      await storage.createNotificationLog(log);
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  private createReminderMessage(language: string): string {
    const messages = {
      en: `🔔 *Daily Transaction Reminder*

Hi! It looks like you haven't logged any transactions today.

Don't forget to track your expenses to keep your finances on track! 💰

You can:
• Reply with your expense (e.g., "Lunch 50000")
• Send a receipt photo 📸
• Use the Monly AI app

Keep up the good habit of tracking your money! 📊✨`,
      id: `🔔 *Pengingat Transaksi Harian*

Halo! Sepertinya Anda belum mencatat transaksi apa pun hari ini.

Jangan lupa untuk melacak pengeluaran Anda agar keuangan tetap terkontrol! 💰

Anda bisa:
• Balas dengan pengeluaran Anda (contoh: "Makan siang 50000")
• Kirim foto struk belanja 📸
• Gunakan aplikasi Monly AI

Terus pertahankan kebiasaan baik mencatat keuangan! 📊✨`
    };

    return messages[language as keyof typeof messages] || messages.en;
  }
}

export const transactionReminderService = new TransactionReminderServiceImpl();
