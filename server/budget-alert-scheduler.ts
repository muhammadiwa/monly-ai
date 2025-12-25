import cron from 'node-cron';
import { budgetAlertService } from './budget-alert-service';

/**
 * Budget Alert Scheduler
 * 
 * This module handles the scheduling of budget alert checks.
 * It runs twice daily (morning and evening) to check if users have
 * budgets at warning level or over budget, and sends WhatsApp notifications.
 */

let schedulerStarted = false;

export function startBudgetAlertScheduler() {
    if (schedulerStarted) {
        console.log('⚠️ Budget alert scheduler is already running');
        return;
    }

    console.log('🚀 Starting budget alert scheduler...');

    // Schedule budget check twice daily:
    // - 9 AM: Morning check
    // - 6 PM: Evening check

    // Morning check at 9 AM
    const morningJob = cron.schedule('0 0 9 * * *', async () => {
        console.log('⏰ Running morning budget alert check at', new Date().toLocaleString());

        try {
            await budgetAlertService.checkAllBudgetsAndSendAlerts();
        } catch (error) {
            console.error('❌ Error in morning budget alert check:', error);
        }
    }, {
        timezone: process.env.TZ || 'Asia/Jakarta'
    });

    // Evening check at 6 PM
    const eveningJob = cron.schedule('0 0 18 * * *', async () => {
        console.log('⏰ Running evening budget alert check at', new Date().toLocaleString());

        try {
            await budgetAlertService.checkAllBudgetsAndSendAlerts();
        } catch (error) {
            console.error('❌ Error in evening budget alert check:', error);
        }
    }, {
        timezone: process.env.TZ || 'Asia/Jakarta'
    });

    schedulerStarted = true;
    console.log('✅ Budget alert scheduler started successfully');
    console.log('📅 Budget alerts will be checked at 9:00 AM and 6:00 PM (Asia/Jakarta timezone)');

    return { morningJob, eveningJob };
}

export function stopBudgetAlertScheduler() {
    if (!schedulerStarted) {
        console.log('⚠️ Budget alert scheduler is not running');
        return;
    }

    schedulerStarted = false;
    console.log('🛑 Budget alert scheduler stopped');
}

// Manual trigger function for testing
export async function triggerBudgetAlertsManually() {
    console.log('🧪 Manually triggering budget alerts...');

    try {
        await budgetAlertService.checkAllBudgetsAndSendAlerts();
        console.log('✅ Manual budget alerts completed');
    } catch (error) {
        console.error('❌ Error in manual budget alerts:', error);
        throw error;
    }
}
