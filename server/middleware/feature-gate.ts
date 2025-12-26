import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth';
import { db } from '../db';
import { users, subscriptionPlans, transactions } from '../../shared/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { usageTrackingService, UsageFeature } from '../services/usage-tracking-service';

export type FeatureName =
    | 'ai_categorization'
    | 'receipt_ocr'
    | 'ai_chat'
    | 'whatsapp_notifications'
    | 'export_data'
    | 'advanced_reports';

/**
 * Middleware to check if user can access a feature based on their subscription plan
 * Requirements: 5.2, 5.3, 5.7
 */
export function requireFeature(feature: FeatureName) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get user's subscription plan
            const user = await db
                .select({
                    subscriptionPlanId: users.subscriptionPlanId,
                })
                .from(users)
                .where(eq(users.id, userId))
                .get();

            if (!user || !user.subscriptionPlanId) {
                // User has no plan (free tier)
                return res.status(403).json({
                    error: 'Feature not available in your plan',
                    feature,
                    upgradeRequired: true,
                });
            }

            // Get plan details
            const plan = await db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .get();

            if (!plan) {
                return res.status(403).json({
                    error: 'Feature not available in your plan',
                    feature,
                    upgradeRequired: true,
                });
            }

            // Parse plan features
            const planFeatures = JSON.parse(plan.features) as string[];
            const planLimits = JSON.parse(plan.limits);

            // Check if feature is available in plan
            let hasFeature = false;

            switch (feature) {
                case 'ai_categorization':
                    // Check if plan has AI categorization feature
                    hasFeature = planFeatures.includes('ai_categorization') ||
                        planLimits.aiAnalysis > 0 ||
                        planLimits.aiAnalysis === -1;
                    break;
                case 'receipt_ocr':
                    // Check if plan has OCR feature
                    hasFeature = planFeatures.includes('receipt_ocr') ||
                        planLimits.receiptOCR > 0 ||
                        planLimits.receiptOCR === -1;
                    break;
                case 'ai_chat':
                    // Check if plan has AI chat feature
                    hasFeature = planFeatures.includes('ai_chat') ||
                        planLimits.aiChat > 0 ||
                        planLimits.aiChat === -1;
                    break;
                case 'whatsapp_notifications':
                    // Check if plan has WhatsApp notifications
                    hasFeature = planFeatures.includes('whatsapp_notifications') ||
                        planLimits.whatsappNotifications === true;
                    break;
                case 'export_data':
                    // Check if plan has export data feature
                    hasFeature = planFeatures.includes('export_data') ||
                        planLimits.exportData === true;
                    break;
                case 'advanced_reports':
                    // Check if plan has advanced reports
                    hasFeature = planFeatures.includes('advanced_reports') ||
                        planLimits.advancedReports === true;
                    break;
                default:
                    hasFeature = false;
            }

            if (!hasFeature) {
                return res.status(403).json({
                    error: 'Feature not available in your plan',
                    feature,
                    upgradeRequired: true,
                });
            }

            // Feature is available, proceed
            next();
        } catch (error) {
            console.error('Error in requireFeature middleware:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

/**
 * Middleware to check if user has reached usage limit for a feature
 * Requirements: 5.1, 5.4, 5.5, 5.6
 */
export function checkUsageLimit(feature: UsageFeature) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Check if user has reached limit
            const hasReached = await usageTrackingService.hasReachedLimit(userId, feature);

            if (hasReached) {
                const remaining = await usageTrackingService.getRemainingQuota(userId, feature);
                return res.status(429).json({
                    error: 'Usage limit reached',
                    feature,
                    remaining,
                    upgradeRequired: true,
                });
            }

            // User is within limits, proceed
            next();
        } catch (error) {
            console.error('Error in checkUsageLimit middleware:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

/**
 * Helper function to check if user can use a feature (for use in route handlers)
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export async function canUseFeature(userId: string, feature: FeatureName): Promise<boolean> {
    try {
        // Get user's subscription plan
        const user = await db
            .select({
                subscriptionPlanId: users.subscriptionPlanId,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        if (!user || !user.subscriptionPlanId) {
            // User has no plan (free tier)
            return false;
        }

        // Get plan details
        const plan = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
            .get();

        if (!plan) {
            return false;
        }

        // Parse plan features
        const planFeatures = JSON.parse(plan.features) as string[];
        const planLimits = JSON.parse(plan.limits);

        // Check if feature is available in plan
        switch (feature) {
            case 'ai_categorization':
                return planFeatures.includes('ai_categorization') ||
                    planLimits.aiAnalysis > 0 ||
                    planLimits.aiAnalysis === -1;
            case 'receipt_ocr':
                return planFeatures.includes('receipt_ocr') ||
                    planLimits.receiptOCR > 0 ||
                    planLimits.receiptOCR === -1;
            case 'ai_chat':
                return planFeatures.includes('ai_chat') ||
                    planLimits.aiChat > 0 ||
                    planLimits.aiChat === -1;
            case 'whatsapp_notifications':
                return planFeatures.includes('whatsapp_notifications') ||
                    planLimits.whatsappNotifications === true;
            case 'export_data':
                return planFeatures.includes('export_data') ||
                    planLimits.exportData === true;
            case 'advanced_reports':
                return planFeatures.includes('advanced_reports') ||
                    planLimits.advancedReports === true;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error in canUseFeature:', error);
        return false;
    }
}

/**
 * Helper function to check transaction limit
 * NO HARDCODE - limits come from subscription_plans table
 */
export async function checkTransactionLimit(userId: string): Promise<{ allowed: boolean; limit: number; current: number }> {
    try {
        // Get user's subscription plan
        const user = await db
            .select({
                subscriptionPlanId: users.subscriptionPlanId,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        let plan;

        if (!user || !user.subscriptionPlanId) {
            // User has no subscription - get "free" plan from database
            plan = db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.name, 'free'))
                .get();
        } else {
            // Get user's subscription plan
            plan = db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .get();

            // If plan not found (e.g., deleted), fallback to free plan
            if (!plan) {
                plan = db
                    .select()
                    .from(subscriptionPlans)
                    .where(eq(subscriptionPlans.name, 'free'))
                    .get();
            }
        }

        if (!plan) {
            console.error('No plan found for user (including free fallback):', userId);
            return { allowed: false, limit: 0, current: 0 };
        }

        // Parse plan limits from database
        const planLimits = JSON.parse(plan.limits);
        const transactionLimit = planLimits.transactions || 0;

        // -1 means unlimited
        if (transactionLimit === -1) {
            return { allowed: true, limit: -1, current: 0 };
        }

        // Count user's transactions this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthStartTimestamp = Math.floor(startOfMonth.getTime() / 1000);

        const transactionCountResult = db
            .select({ count: sql<number>`COUNT(*)` })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                gte(transactions.createdAt, monthStartTimestamp)
            ))
            .get();

        const currentCount = transactionCountResult?.count || 0;

        return {
            allowed: currentCount < transactionLimit,
            limit: transactionLimit,
            current: currentCount,
        };
    } catch (error) {
        console.error('Error in checkTransactionLimit:', error);
        return { allowed: false, limit: 0, current: 0 };
    }
}

import { budgets, goals } from '../../shared/schema';

export type ResourceLimitType = 'budgets' | 'goals' | 'transactions';

/**
 * Helper function to get user's plan limits from database
 * NO HARDCODE - all limits come from subscription_plans table
 */
export async function getUserPlanLimits(userId: string): Promise<{
    transactions: number;
    budgets: number;
    goals: number;
    aiAnalysis: number;
    receiptOCR: number;
    aiChat: number;
    whatsappNotifications: boolean;
    exportData: boolean;
    advancedReports: boolean;
    prioritySupport: boolean;
} | null> {
    try {
        const user = await db
            .select({
                subscriptionPlanId: users.subscriptionPlanId,
            })
            .from(users)
            .where(eq(users.id, userId))
            .get();

        let plan;

        if (!user || !user.subscriptionPlanId) {
            // User has no subscription - get "free" plan from database
            plan = db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.name, 'free'))
                .get();
        } else {
            // Get user's subscription plan
            plan = db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, user.subscriptionPlanId))
                .get();

            // If plan not found (e.g., deleted), fallback to free plan
            if (!plan) {
                plan = db
                    .select()
                    .from(subscriptionPlans)
                    .where(eq(subscriptionPlans.name, 'free'))
                    .get();
            }
        }

        if (!plan) {
            console.error('No plan found for user (including free fallback):', userId);
            return null;
        }

        return JSON.parse(plan.limits);
    } catch (error) {
        console.error('Error getting user plan limits:', error);
        return null;
    }
}

/**
 * Check if user can create more of a resource (budget/goal)
 */
export async function checkResourceLimit(userId: string, resourceType: ResourceLimitType): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
}> {
    try {
        const limits = await getUserPlanLimits(userId);

        if (!limits) {
            return { allowed: false, limit: 0, current: 0 };
        }

        let limit: number;
        let currentCount: number;

        switch (resourceType) {
            case 'budgets':
                limit = limits.budgets;
                const budgetCountResult = await db
                    .select({ count: sql<number>`COUNT(*)` })
                    .from(budgets)
                    .where(eq(budgets.userId, userId))
                    .get();
                currentCount = budgetCountResult?.count || 0;
                break;

            case 'goals':
                limit = limits.goals;
                const goalCountResult = await db
                    .select({ count: sql<number>`COUNT(*)` })
                    .from(goals)
                    .where(eq(goals.userId, userId))
                    .get();
                currentCount = goalCountResult?.count || 0;
                break;

            case 'transactions':
                return checkTransactionLimit(userId);

            default:
                return { allowed: false, limit: 0, current: 0 };
        }

        // -1 means unlimited
        if (limit === -1) {
            return { allowed: true, limit: -1, current: currentCount };
        }

        return {
            allowed: currentCount < limit,
            limit,
            current: currentCount,
        };
    } catch (error) {
        console.error('Error in checkResourceLimit:', error);
        return { allowed: false, limit: 0, current: 0 };
    }
}

/**
 * Middleware to check resource limits before creating
 */
export function checkResourceLimitMiddleware(resourceType: ResourceLimitType) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { allowed, limit, current } = await checkResourceLimit(userId, resourceType);

            if (!allowed) {
                return res.status(403).json({
                    error: `You have reached your ${resourceType} limit`,
                    limit,
                    current,
                    upgradeRequired: true,
                });
            }

            next();
        } catch (error) {
            console.error('Error in checkResourceLimitMiddleware:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}
