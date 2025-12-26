import { Router, Response, RequestHandler } from 'express';
import { requireAuth, AuthRequest } from '../auth';
import { AdminStorage } from '../admin/admin-storage';
import { midtransService } from '../services/midtrans-service';
import { usageTrackingService } from '../services/usage-tracking-service';
import { checkResourceLimit } from '../middleware/feature-gate';
import { db } from '../db';
import { userSubscriptions, subscriptionPlans, users, payments } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();
const adminStorage = new AdminStorage();

// Type-safe middleware
const authMiddleware = requireAuth as unknown as RequestHandler;

/**
 * GET /api/subscription/plans
 * Get all active subscription plans (PUBLIC)
 */
router.get('/plans', (async (_req, res: Response) => {
    try {
        const allPlans = await adminStorage.getAllPlans();
        const activePlans = allPlans.filter(plan => plan.isActive);
        res.json({ success: true, data: activePlans });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_PLANS_ERROR', message: 'Failed to fetch subscription plans' },
        });
    }
}) as RequestHandler);

/**
 * GET /api/subscription/current
 * Get current user's subscription details
 * Only returns ACTIVE subscriptions - pending/expired/cancelled are not considered current
 */
router.get('/current', authMiddleware, (async (req, res: Response) => {
    try {
        const authReq = req as unknown as AuthRequest;
        const userId = authReq.user!.id;

        // Only get ACTIVE subscription - pending subscriptions are not yet paid
        const subscription = db
            .select({
                id: userSubscriptions.id,
                planId: userSubscriptions.planId,
                status: userSubscriptions.status,
                billingCycle: userSubscriptions.billingCycle,
                startDate: userSubscriptions.startDate,
                endDate: userSubscriptions.endDate,
                autoRenew: userSubscriptions.autoRenew,
                planName: subscriptionPlans.name,
                planDisplayName: subscriptionPlans.displayName,
                priceMonthly: subscriptionPlans.priceMonthly,
                priceYearly: subscriptionPlans.priceYearly,
                currency: subscriptionPlans.currency,
                features: subscriptionPlans.features,
                limits: subscriptionPlans.limits,
            })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(and(
                eq(userSubscriptions.userId, userId),
                eq(userSubscriptions.status, 'active')
            ))
            .orderBy(desc(userSubscriptions.createdAt))
            .limit(1)
            .get();

        // If no active subscription, return free plan
        if (!subscription) {
            const freePlan = db
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.name, 'free'))
                .get();

            if (freePlan) {
                return res.json({
                    success: true,
                    data: {
                        id: null,
                        planName: freePlan.name,
                        planDisplayName: freePlan.displayName,
                        status: 'free',
                        billingCycle: null,
                        startDate: null,
                        endDate: null,
                        autoRenew: false,
                        features: JSON.parse(freePlan.features),
                        limits: JSON.parse(freePlan.limits),
                    },
                });
            }

            return res.status(404).json({
                success: false,
                error: { code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found for user' },
            });
        }

        const usage = await usageTrackingService.getUsage(userId);

        res.json({
            success: true,
            data: {
                id: subscription.id,
                planName: subscription.planName,
                planDisplayName: subscription.planDisplayName,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                autoRenew: Boolean(subscription.autoRenew),
                features: JSON.parse(subscription.features),
                limits: JSON.parse(subscription.limits),
                usage,
            },
        });
    } catch (error) {
        console.error('Error fetching current subscription:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_SUBSCRIPTION_ERROR', message: 'Failed to fetch subscription details' },
        });
    }
}) as RequestHandler);

/**
 * POST /api/subscription/checkout
 * Initiate subscription checkout
 */
router.post('/checkout', authMiddleware, (async (req, res: Response) => {
    try {
        const authReq = req as unknown as AuthRequest;
        const userId = authReq.user!.id;
        const { planId, billingCycle } = req.body;

        if (!planId || !billingCycle) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Plan ID and billing cycle are required' },
            });
        }

        if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_BILLING_CYCLE', message: 'Billing cycle must be "monthly" or "yearly"' },
            });
        }

        const plan = db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .get();

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: { code: 'PLAN_NOT_FOUND', message: 'Subscription plan not found' },
            });
        }

        const amount = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;

        const user = db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .get();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found' },
            });
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const orderId = `SUB-${timestamp}-${randomSuffix}`;

        const now = Math.floor(Date.now() / 1000);
        const daysToAdd = billingCycle === 'monthly' ? 30 : 365;
        const endDate = now + (daysToAdd * 24 * 60 * 60);

        const subscriptionResult = db
            .insert(userSubscriptions)
            .values({
                userId,
                planId,
                status: 'pending',
                billingCycle,
                startDate: now,
                endDate,
                autoRenew: true,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get();

        const paymentResult = db
            .insert(payments)
            .values({
                userId,
                subscriptionId: subscriptionResult.id,
                amount,
                currency: plan.currency,
                paymentMethod: 'other',
                status: 'pending',
                midtransOrderId: orderId,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get();

        const midtransResponse = await midtransService.createTransaction({
            orderId,
            grossAmount: amount,
            customerDetails: {
                firstName: user.firstName || 'User',
                lastName: user.lastName || '',
                email: user.email || '',
                phone: '',
            },
            itemDetails: [
                {
                    id: `plan-${planId}`,
                    price: amount,
                    quantity: 1,
                    name: `${plan.displayName} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`,
                },
            ],
        });

        if (midtransResponse.transaction_id) {
            db.update(payments)
                .set({
                    midtransTransactionId: midtransResponse.transaction_id,
                    updatedAt: now,
                })
                .where(eq(payments.id, paymentResult.id))
                .run();
        }

        res.json({
            success: true,
            data: {
                subscriptionId: subscriptionResult.id,
                paymentUrl: midtransResponse.redirect_url || '',
                orderId,
            },
        });
    } catch (error) {
        console.error('Error creating checkout:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'CHECKOUT_ERROR',
                message: 'Failed to create checkout session',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
        });
    }
}) as RequestHandler);

/**
 * POST /api/subscription/cancel
 * Cancel user's own subscription
 */
router.post('/cancel', authMiddleware, (async (req, res: Response) => {
    try {
        const authReq = req as unknown as AuthRequest;
        const userId = authReq.user!.id;
        const { reason } = req.body;

        const subscription = db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.userId, userId))
            .orderBy(userSubscriptions.createdAt)
            .limit(1)
            .get();

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: { code: 'SUBSCRIPTION_NOT_FOUND', message: 'No active subscription found' },
            });
        }

        if (subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: { code: 'SUBSCRIPTION_NOT_ACTIVE', message: 'Subscription is not active' },
            });
        }

        await adminStorage.cancelSubscription(
            subscription.id,
            reason || 'User requested cancellation'
        );

        res.json({
            success: true,
            message: 'Subscription cancelled successfully. Access will continue until the end of the billing period.',
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'CANCEL_ERROR',
                message: 'Failed to cancel subscription',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
        });
    }
}) as RequestHandler);

/**
 * GET /api/subscription/usage
 * Get current usage statistics including resource limits
 */
router.get('/usage', authMiddleware, (async (req, res: Response) => {
    try {
        const authReq = req as unknown as AuthRequest;
        const userId = authReq.user!.id;

        const usage = await usageTrackingService.getUsage(userId);

        // Get resource limits (budgets, goals, transactions)
        const [budgetsLimit, goalsLimit, transactionsLimit] = await Promise.all([
            checkResourceLimit(userId, 'budgets'),
            checkResourceLimit(userId, 'goals'),
            checkResourceLimit(userId, 'transactions'),
        ]);

        res.json({
            success: true,
            data: {
                ...usage,
                resourceLimits: {
                    budgets: budgetsLimit,
                    goals: goalsLimit,
                    transactions: transactionsLimit,
                }
            }
        });
    } catch (error) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({
            success: false,
            error: { code: 'FETCH_USAGE_ERROR', message: 'Failed to fetch usage statistics' },
        });
    }
}) as RequestHandler);

export default router;
