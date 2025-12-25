import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth';
import { AdminStorage } from '../admin/admin-storage';
import { midtransService } from '../services/midtrans-service';
import { usageTrackingService } from '../services/usage-tracking-service';
import { db } from '../db';
import { userSubscriptions, subscriptionPlans, users, payments } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const adminStorage = new AdminStorage();

/**
 * GET /api/subscription/plans
 * Get all active subscription plans (PUBLIC)
 * Requirements: 1.1
 */
router.get('/plans', async (req, res: Response) => {
    try {
        // Get all plans from admin storage
        const allPlans = await adminStorage.getAllPlans();

        // Filter only active plans for public display
        const activePlans = allPlans.filter(plan => plan.isActive);

        res.json({
            success: true,
            data: activePlans,
        });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_PLANS_ERROR',
                message: 'Failed to fetch subscription plans',
            },
        });
    }
});

/**
 * GET /api/subscription/current
 * Get current user's subscription details
 * Requirements: 1.2, 8.1, 8.2
 */
router.get('/current', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get user's current subscription
        const subscription = await db
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
            .where(eq(userSubscriptions.userId, userId))
            .orderBy(userSubscriptions.createdAt)
            .limit(1)
            .get();

        if (!subscription) {
            // User has no subscription, return free plan info
            const freePlan = await db
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
                error: {
                    code: 'SUBSCRIPTION_NOT_FOUND',
                    message: 'No subscription found for user',
                },
            });
        }

        // Get usage stats
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
            error: {
                code: 'FETCH_SUBSCRIPTION_ERROR',
                message: 'Failed to fetch subscription details',
            },
        });
    }
});

/**
 * POST /api/subscription/checkout
 * Initiate subscription checkout
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1
 */
router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { planId, billingCycle } = req.body;

        // Validate input
        if (!planId || !billingCycle) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Plan ID and billing cycle are required',
                },
            });
        }

        if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_BILLING_CYCLE',
                    message: 'Billing cycle must be "monthly" or "yearly"',
                },
            });
        }

        // Get plan details
        const plan = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .get();

        if (!plan) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'PLAN_NOT_FOUND',
                    message: 'Subscription plan not found',
                },
            });
        }

        // Calculate amount based on billing cycle
        const amount = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;

        // Get user details
        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .get();

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                },
            });
        }

        // Generate unique order ID (Property 1: Unique Order ID Generation)
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const orderId = `SUB-${timestamp}-${randomSuffix}`;

        // Calculate subscription dates
        const now = Math.floor(Date.now() / 1000);
        const daysToAdd = billingCycle === 'monthly' ? 30 : 365;
        const endDate = now + (daysToAdd * 24 * 60 * 60);

        // Create pending subscription record
        const subscriptionResult = await db
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

        // Create payment record
        const paymentResult = await db
            .insert(payments)
            .values({
                userId,
                subscriptionId: subscriptionResult.id,
                amount,
                currency: plan.currency,
                paymentMethod: 'other', // Midtrans can use various methods
                status: 'pending',
                midtransOrderId: orderId,
                createdAt: now,
                updatedAt: now,
            })
            .returning()
            .get();

        // Create Midtrans transaction
        const midtransResponse = await midtransService.createTransaction({
            orderId,
            grossAmount: amount,
            customerDetails: {
                firstName: user.firstName || 'User',
                lastName: user.lastName || '',
                email: user.email || '',
                phone: '', // Optional
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

        // Update payment with Midtrans transaction ID
        if (midtransResponse.transaction_id) {
            await db
                .update(payments)
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
});

/**
 * POST /api/subscription/cancel
 * Cancel user's own subscription
 * Requirements: 7.2, 7.3
 */
router.post('/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { reason } = req.body;

        // Get user's active subscription
        const subscription = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.userId, userId))
            .orderBy(userSubscriptions.createdAt)
            .limit(1)
            .get();

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SUBSCRIPTION_NOT_FOUND',
                    message: 'No active subscription found',
                },
            });
        }

        if (subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'SUBSCRIPTION_NOT_ACTIVE',
                    message: 'Subscription is not active',
                },
            });
        }

        // Cancel subscription using admin storage
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
});

/**
 * GET /api/subscription/usage
 * Get current usage statistics
 * Requirements: 6.5, 6.6
 */
router.get('/usage', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get usage stats from usage tracking service
        const usage = await usageTrackingService.getUsage(userId);

        res.json({
            success: true,
            data: usage,
        });
    } catch (error) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'FETCH_USAGE_ERROR',
                message: 'Failed to fetch usage statistics',
            },
        });
    }
});

export default router;
