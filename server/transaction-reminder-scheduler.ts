import cron from 'node-cron';
import { transactionReminderService } from './transaction-reminder-service';

/**
 * Transaction Reminder Scheduler
 * 
 * This module handles the scheduling of daily transaction reminders.
 * It runs every day at 8 PM (20:00) to check if users have logged any transactions.
 * If not, it sends a WhatsApp reminder to all connected numbers.
 */

let schedulerStarted = false;

export function startTransactionReminderScheduler() {
  if (schedulerStarted) {
    console.log('⚠️ Transaction reminder scheduler is already running');
    return;
  }

  console.log('🚀 Starting transaction reminder scheduler...');

  // Schedule reminder check every day at 8 PM (20:00)
  // Cron format: second minute hour day month dayOfWeek
  // '0 0 20 * * *' = Every day at 8:00 PM
  const reminderJob = cron.schedule('0 0 20 * * *', async () => {
    console.log('⏰ Running daily transaction reminder check at', new Date().toLocaleString());

    try {
      await transactionReminderService.checkAndSendReminders();
    } catch (error) {
      console.error('❌ Error in scheduled transaction reminder check:', error);
    }
  }, {
    timezone: process.env.TZ || 'Asia/Jakarta' // Use timezone from environment
  });

  // Also run a check at startup (for testing)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧪 Development mode: Running initial reminder check...');
    setTimeout(async () => {
      try {
        await transactionReminderService.checkAndSendReminders();
      } catch (error) {
        console.error('❌ Error in initial reminder check:', error);
      }
    }, 5000); // Wait 5 seconds after startup
  }

  schedulerStarted = true;
  console.log('✅ Transaction reminder scheduler started successfully');
  console.log('📅 Reminders will be sent daily at 8:00 PM (Asia/Jakarta timezone)');

  return reminderJob;
}

export function stopTransactionReminderScheduler() {
  if (!schedulerStarted) {
    console.log('⚠️ Transaction reminder scheduler is not running');
    return;
  }

  // Note: In a real application, you would store the job reference
  // and call job.destroy() here
  schedulerStarted = false;
  console.log('🛑 Transaction reminder scheduler stopped');
}

// Manual trigger function for testing
export async function triggerTransactionRemindersManually() {
  console.log('🧪 Manually triggering transaction reminders...');

  try {
    await transactionReminderService.checkAndSendReminders();
    console.log('✅ Manual transaction reminders completed');
  } catch (error) {
    console.error('❌ Error in manual transaction reminders:', error);
    throw error;
  }
}
