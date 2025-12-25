import cron, { type ScheduledTask } from 'node-cron';
import { db } from '../db';
import { userSubscriptions, users, payments, subscriptionPlans, usageTracking } from '../../shared/schema';
import { eq, and, lt, lte, gte } from 'drizzle-orm';

/**
 * Subscription Cron Jobs
 * 
 * This module handles scheduled tasks for subscription management:
 * 1. Expiring subscription check (runs daily at 09:00)
 * 2. Failed payment retry (runs every 6 hours)
 * 3. Cleanup old usage data (runs monthly on 1st at 02:00)
 * 
 * Note: Monthly usage reset is NOT needed because UsageTrackingService
 * uses period-based tracking (YYYY-MM format). New periods automatically
 * create new records, so no manual reset is required.
 */

let cronJobsStarted = false;
const jobs: ScheduledTask[] = [];

/**
 * Check and expire subscriptions that have passed their end date
 */
async function checkExpiringSubscriptions() {
    console.log('🔍 Checking for expiring subscriptions...');

    try {
        const now = Math.floor(Date.now() / 1000);

        // Find active subscriptions that have expired
        const expiredSubscriptions = await db
            .select()
            .from(userSubscriptions)
            .where(
                and(
                    eq(userSubscriptions.status, 'active'),
                    lte(userSubscriptions.endDate, now)
                )
            )
            .all();

        console.log(`📊 Found ${expiredSubscriptions.length} expired subscriptions`);

        for (const subscription of expiredSubscriptions) {
            try {
                // Update subscription status to expired
                await db
                    .update(userSubscriptions)
                    .set({
                        status: 'expired',
                        updatedAt: now,
                    })
                    .where(eq(userSubscriptions.id, subscription.id))
                    .run();

                // Get the Free plan
                const freePlan = await db
                    .select()
                    .from(subscriptionPlans)
                    .where(eq(subscriptionPlans.name, 'free'))
                    .get();

                if (freePlan) {
                    // Downgrade user to Free plan
                    await db
                        .update(users)
                        .set({
                            subscriptionPlanId: freePlan.id,
                            subscriptionStatus: 'expired',
                        })
                        .where(eq(users.id, subscription.userId))
                        .run();

                    console.log(`✅ Expired subscription ${subscription.id} for user ${subscription.userId}, downgraded to Free plan`);
                } else {
                    console.warn(`⚠️ Free plan not found, could not downgrade user ${subscription.userId}`);
                }
            } catch (error) {
                console.error(`❌ Error expiring subscription ${subscription.id}:`, error);
            }
        }

        // Also check for subscriptions expiring in 7 days (for warning notifications)
        const sevenDaysFromNow = now + (7 * 24 * 60 * 60);
        const expiringSoon = await db
            .select()
            .from(userSubscriptions)
            .where(
                and(
                    eq(userSubscriptions.status, 'active'),
                    lte(userSubscriptions.endDate, sevenDaysFromNow),
                    gte(userSubscriptions.endDate, now)
                )
            )
            .all();

        if (expiringSoon.length > 0) {
            console.log(`⚠️ ${expiringSoon.length} subscriptions expiring within 7 days`);
            // TODO: Send expiration warning emails (Requirement 9.2)
            // This will be implemented in task 18 (Email Notifications)
        }

        console.log('✅ Expiring subscription check completed');
    } catch (error) {
        console.error('❌ Error checking expiring subscriptions:', error);
    }
}

/**
 * Retry failed payments
 */
async function retryFailedPayments() {
    console.log('🔄 Checking for failed payments to retry...');

    try {
        const now = Math.floor(Date.now() / 1000);
        const sixHoursAgo = now - (6 * 60 * 60);

        // Find failed payments from the last 6 hours
        const failedPayments = await db
            .select()
            .from(payments)
            .where(
                and(
                    eq(payments.status, 'failed'),
                    gte(payments.createdAt, sixHoursAgo)
                )
            )
            .all();

        console.log(`📊 Found ${failedPayments.length} failed payments to retry`);

        for (const payment of failedPayments) {
            try {
                // Skip if no subscription ID
                if (!payment.subscriptionId) {
                    continue;
                }

                // Check if subscription is still pending
                const subscription = await db
                    .select()
                    .from(userSubscriptions)
                    .where(eq(userSubscriptions.id, payment.subscriptionId))
                    .get();

                if (subscription && subscription.status === 'pending') {
                    // TODO: Implement retry logic with Midtrans
                    // For now, just log that we would retry
                    console.log(`🔄 Would retry payment ${payment.id} for subscription ${subscription.id}`);

                    // In a real implementation, you would:
                    // 1. Check payment status with Midtrans
                    // 2. If still failed, send reminder email to user
                    // 3. If payment succeeded, activate subscription
                    // 4. If payment expired, mark as failed permanently
                }
            } catch (error) {
                console.error(`❌ Error retrying payment ${payment.id}:`, error);
            }
        }

        console.log('✅ Failed payment retry check completed');
    } catch (error) {
        console.error('❌ Error retrying failed payments:', error);
    }
}

/**
 * Cleanup old usage tracking data
 * Removes usage records older than 12 months to keep database lean
 */
async function cleanupOldUsageData() {
    console.log('🧹 Cleaning up old usage tracking data...');

    try {
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        const cutoffPeriod = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

        console.log(`📅 Deleting usage data older than ${cutoffPeriod}`);

        // Delete old usage records
        const result = await db
            .delete(usageTracking)
            .where(lt(usageTracking.period, cutoffPeriod))
            .run();

        console.log(`✅ Cleanup completed: ${result.changes} old records deleted`);
    } catch (error) {
        console.error('❌ Error cleaning up old usage data:', error);
    }
}

/**
 * Start all subscription cron jobs
 */
export function startSubscriptionCronJobs() {
    if (cronJobsStarted) {
        console.log('⚠️ Subscription cron jobs are already running');
        return;
    }

    console.log('🚀 Starting subscription cron jobs...');

    // 1. Expiring subscription check - runs daily at 09:00
    const expiringCheckJob = cron.schedule('0 0 9 * * *', async () => {
        console.log('⏰ Running expiring subscription check at', new Date().toLocaleString());
        await checkExpiringSubscriptions();
    }, {
        timezone: process.env.TZ || 'Asia/Jakarta'
    });
    jobs.push(expiringCheckJob);
    console.log('✅ Expiring subscription check job scheduled (daily at 09:00)');

    // 2. Failed payment retry - runs every 6 hours
    const failedPaymentJob = cron.schedule('0 0 */6 * * *', async () => {
        console.log('⏰ Running failed payment retry at', new Date().toLocaleString());
        await retryFailedPayments();
    }, {
        timezone: process.env.TZ || 'Asia/Jakarta'
    });
    jobs.push(failedPaymentJob);
    console.log('✅ Failed payment retry job scheduled (every 6 hours)');

    // 3. Cleanup old usage data - runs monthly on 1st at 02:00
    const cleanupJob = cron.schedule('0 0 2 1 * *', async () => {
        console.log('⏰ Running usage data cleanup at', new Date().toLocaleString());
        await cleanupOldUsageData();
    }, {
        timezone: process.env.TZ || 'Asia/Jakarta'
    });
    jobs.push(cleanupJob);
    console.log('✅ Usage data cleanup job scheduled (1st of month at 02:00)');

    // Run initial checks in development mode
    if (process.env.NODE_ENV === 'development') {
        console.log('🧪 Development mode: Running initial checks...');
        setTimeout(async () => {
            try {
                await checkExpiringSubscriptions();
                await retryFailedPayments();
            } catch (error) {
                console.error('❌ Error in initial checks:', error);
            }
        }, 5000); // Wait 5 seconds after startup
    }

    cronJobsStarted = true;
    console.log('✅ All subscription cron jobs started successfully');
    console.log('📅 Schedules:');
    console.log('   - Expiring subscriptions: Daily at 09:00');
    console.log('   - Failed payment retry: Every 6 hours');
    console.log('   - Usage data cleanup: 1st of month at 02:00');
    console.log('');
    console.log('ℹ️  Note: Monthly usage reset is automatic via period-based tracking');
}

/**
 * Stop all subscription cron jobs
 */
export function stopSubscriptionCronJobs() {
    if (!cronJobsStarted) {
        console.log('⚠️ Subscription cron jobs are not running');
        return;
    }

    console.log('🛑 Stopping subscription cron jobs...');

    for (const job of jobs) {
        job.stop();
    }

    jobs.length = 0;
    cronJobsStarted = false;

    console.log('✅ All subscription cron jobs stopped');
}

/**
 * Manual trigger functions for testing
 */
export async function triggerCleanupManually() {
    console.log('🧪 Manually triggering usage data cleanup...');
    await cleanupOldUsageData();
}

export async function triggerExpiringCheckManually() {
    console.log('🧪 Manually triggering expiring subscription check...');
    await checkExpiringSubscriptions();
}

export async function triggerFailedPaymentRetryManually() {
    console.log('🧪 Manually triggering failed payment retry...');
    await retryFailedPayments();
}
