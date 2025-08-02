import { storage } from './storage';
import { sendWhatsAppMessage } from './whatsapp-service';
import { NotificationLog, InsertNotificationLog } from '@shared/schema';

interface TransactionReminderService {
  checkAndSendReminders(): Promise<void>;
  sendReminderToUser(userId: string): Promise<void>;
  hasUserLoggedTransactionToday(userId: string): Promise<boolean>;
  getUserWhatsAppNumbers(userId: string): Promise<string[]>;
  logNotification(log: InsertNotificationLog): Promise<void>;
}

class TransactionReminderServiceImpl implements TransactionReminderService {
  
  /**
   * Check all users and send reminders to those who haven't logged transactions today
   */
  async checkAndSendReminders(): Promise<void> {
    console.log('🔔 Starting transaction reminders check...');
    
    try {
      // Get all users with transaction reminders enabled
      const usersWithReminders = await storage.getUsersWithTransactionReminders();
      
      console.log(`Found ${usersWithReminders.length} users with transaction reminders enabled`);
      
      for (const user of usersWithReminders) {
        try {
          // Check if user has logged any transaction today
          const hasLoggedToday = await this.hasUserLoggedTransactionToday(user.id);
          
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
   * Send reminder message to a specific user
   */
  async sendReminderToUser(userId: string): Promise<void> {
    try {
      // Get user's WhatsApp numbers
      const whatsappNumbers = await this.getUserWhatsAppNumbers(userId);
      
      if (whatsappNumbers.length === 0) {
        console.log(`⚠️ User ${userId} has no WhatsApp numbers connected`);
        return;
      }

      // Get user preferences for language
      const userPrefs = await storage.getUserPreferences(userId);
      const language = userPrefs?.language || 'en';
      
      // Create reminder message based on language
      const message = this.createReminderMessage(language);
      
      // Send message to all connected WhatsApp numbers
      for (const whatsappNumber of whatsappNumbers) {
        try {
          const result = await sendWhatsAppMessage(userId, whatsappNumber, message);
          
          // Log the notification
          await this.logNotification({
            userId,
            type: 'transaction_reminder',
            whatsappNumber,
            message,
            status: result.success ? 'sent' : 'failed',
            sentAt: Date.now(),
            errorMessage: result.success ? undefined : result.message,
          });
          
          if (result.success) {
            console.log(`✅ Reminder sent successfully to ${whatsappNumber}`);
          } else {
            console.error(`❌ Failed to send reminder to ${whatsappNumber}: ${result.message}`);
          }
        } catch (error) {
          console.error(`❌ Error sending reminder to ${whatsappNumber}:`, error);
          
          // Log the failed notification
          await this.logNotification({
            userId,
            type: 'transaction_reminder',
            whatsappNumber,
            message,
            status: 'failed',
            sentAt: Date.now(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error sending reminder to user ${userId}:`, error);
    }
  }

  /**
   * Check if user has logged any transaction today
   */
  async hasUserLoggedTransactionToday(userId: string): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Math.floor(today.getTime() / 1000);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTimestamp = Math.floor(tomorrow.getTime() / 1000);
      
      const transactions = await storage.getUserTransactionsInDateRange(
        userId, 
        todayTimestamp, 
        tomorrowTimestamp
      );
      
      return transactions.length > 0;
    } catch (error) {
      console.error(`Error checking transactions for user ${userId}:`, error);
      return false; // Assume false to send reminder in case of error
    }
  }

  /**
   * Get all WhatsApp numbers connected to a user
   */
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

  /**
   * Log notification to database
   */
  async logNotification(log: InsertNotificationLog): Promise<void> {
    try {
      await storage.createNotificationLog({
        ...log,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Create reminder message based on language
   */
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
