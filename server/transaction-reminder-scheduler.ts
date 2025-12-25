import cron from 'node-cron';
import { transactionReminderService } from './transaction-reminder-service';

/**
 * Transaction Reminder Scheduler
 * 
 * Runs at 8 PM in two timezones:
 * - 8 PM Asia/Jakarta (20:00 WIB) → sends to users with timezone Asia/Jakarta
 * - 8 PM UTC (20:00 UTC) → sends to users with timezone UTC
 * 
 * Default timezone is Asia/Jakarta.
 */

let schedulerStarted = false;

export function startTransactionReminderScheduler() {
  if (schedulerStarted) {
    console.log('⚠️ Transaction reminder scheduler is already running');
    return;
  }

  console.log('🚀 Starting transaction reminder scheduler...');

  // Schedule for 8 PM Asia/Jakarta (WIB)
  // Cron format: second minute hour day month dayOfWeek
  const jakartaJob = cron.schedule('0 0 20 * * *', async () => {
    console.log('⏰ Running 8 PM Asia/Jakarta reminder check at', new Date().toLocaleString());
    try {
      await transactionReminderService.checkAndSendRemindersForTimezone('Asia/Jakarta');
    } catch (error) {
      console.error('❌ Error in Asia/Jakarta reminder check:', error);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // Schedule for 8 PM UTC
  const utcJob = cron.schedule('0 0 20 * * *', async () => {
    console.log('⏰ Running 8 PM UTC reminder check at', new Date().toLocaleString());
    try {
      await transactionReminderService.checkAndSendRemindersForTimezone('UTC');
    } catch (error) {
      console.error('❌ Error in UTC reminder check:', error);
    }
  }, {
    timezone: 'UTC'
  });

  schedulerStarted = true;
  console.log('✅ Transaction reminder scheduler started successfully');
  console.log('📅 Reminders scheduled:');
  console.log('   - 8:00 PM Asia/Jakarta → users with Asia/Jakarta timezone');
  console.log('   - 8:00 PM UTC → users with UTC timezone');

  return { jakartaJob, utcJob };
}

export function stopTransactionReminderScheduler() {
  if (!schedulerStarted) {
    console.log('⚠️ Transaction reminder scheduler is not running');
    return;
  }

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
