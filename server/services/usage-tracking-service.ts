import { db } from "../db";
import { usageTracking, users, subscriptionPlans } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

export type UsageFeature = 'receiptOCR' | 'aiChat' | 'aiAnalysis';

export interface UsageStats {
    receiptOCR: { used: number; limit: number };
    aiChat: { used: number; limit: number };
    aiAnalysis: { used: number; limit: number };
}

export class UsageTrackingService {
    /**
     * Get current period in YYYY-MM format
     */
    private getCurrentPeriod(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Track feature usage - increment counter
     */
    async trackUsage(userId: string, feature: UsageFeature, amount: number = 1): Promise<void> {
        const period = this.getCurrentPeriod();
        const now = Math.floor(Date.now() / 1000);

        // Try to find existing record
        const existing = await db
            .select()
            .from(usageTracking)
            .where(
                and(
                    eq(usageTracking.userId, userId),
                    eq(usageTracking.feature, feature),
                    eq(usageTracking.period, period)
                )
            )
            .get();

        if (existing) {
            // Update existing record
            await db
                .update(usageTracking)
                .set({
                    count: existing.count + amount,
                    updatedAt: now,
                })
                .where(eq(usageTracking.id, existing.id))
                .run();
        } else {
            // Insert new record
            await db
                .insert(usageTracking)
                .values({
                    userId,
                    feature,
                    count: amount,
                    period,
                    createdAt: now,
                    updatedAt: now,
                })
                .run();
        }
    }

    /**
     * Get usage statistics for a user
     */
    async getUsage(userId: string): Promise<UsageStats> {
        const period = this.getCurrentPeriod();

        // Get user's subscription plan
        const user = await db
            .select({
                subscriptionPlanId: users.subscriptionPlanId,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        // Get plan limits
        let limits = {
            receiptOCR: 0,
            aiChat: 0,
            aiAnalysis: 0,
        };

        if (user?.subscriptionPlanId) {
            const plan = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .get();

            if (plan) {
                const planLimits = JSON.parse(plan.limits);
                limits = {
                    receiptOCR: planLimits.receiptOCR || 0,
                    aiChat: planLimits.aiChat || 0,
                    aiAnalysis: planLimits.aiAnalysis || 0,
                };
            }
        }

        // Get current usage
        const usageRecords = await db
            .select()
            .from(usageTracking)
            .where(
                and(
                    eq(usageTracking.userId, userId),
                    eq(usageTracking.period, period)
                )
            )
            .all();

        const usage = {
            receiptOCR: 0,
            aiChat: 0,
            aiAnalysis: 0,
        };

        for (const record of usageRecords) {
            if (record.feature === 'receiptOCR') {
                usage.receiptOCR = record.count;
            } else if (record.feature === 'aiChat') {
                usage.aiChat = record.count;
            } else if (record.feature === 'aiAnalysis') {
                usage.aiAnalysis = record.count;
            }
        }

        return {
            receiptOCR: { used: usage.receiptOCR, limit: limits.receiptOCR },
            aiChat: { used: usage.aiChat, limit: limits.aiChat },
            aiAnalysis: { used: usage.aiAnalysis, limit: limits.aiAnalysis },
        };
    }

    /**
     * Check if user has reached limit for a feature
     */
    async hasReachedLimit(userId: string, feature: UsageFeature): Promise<boolean> {
        const stats = await this.getUsage(userId);
        const featureStats = stats[feature];

        // -1 means unlimited
        if (featureStats.limit === -1) {
            return false;
        }

        return featureStats.used >= featureStats.limit;
    }

    /**
     * Get remaining quota for a feature
     */
    async getRemainingQuota(userId: string, feature: UsageFeature): Promise<number> {
        const stats = await this.getUsage(userId);
        const featureStats = stats[feature];

        // -1 means unlimited
        if (featureStats.limit === -1) {
            return -1;
        }

        return Math.max(0, featureStats.limit - featureStats.used);
    }

    /**
     * Reset monthly counters (called by cron job)
     * This doesn't delete old records, just ensures new period starts fresh
     */
    async resetMonthlyCounters(): Promise<void> {
        // No action needed - new period will automatically create new records
        // Old records are kept for historical tracking
        console.log('Monthly usage counters reset (new period started)');
    }

    /**
     * Increment usage counter (alias for trackUsage)
     */
    async incrementUsage(userId: string, feature: UsageFeature, amount: number = 1): Promise<void> {
        await this.trackUsage(userId, feature, amount);
    }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();
