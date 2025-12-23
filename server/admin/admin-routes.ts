import { Router, Response } from 'express';
import { z } from 'zod';
import {
    generateAdminToken,
    verifyAdminPassword,
    requireAdminAuth,
    type AdminAuthRequest
} from './admin-auth';
import { adminStorage } from './admin-storage';

const router = Router();

// Validation schemas
const adminLoginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

// POST /api/admin/auth/login
router.post('/admin/auth/login', async (req: AdminAuthRequest, res: Response) => {
    try {
        // Validate input
        const validatedData = adminLoginSchema.parse(req.body);

        // Find admin by email
        const admin = await adminStorage.getAdminByEmail(validatedData.email);
        if (!admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                }
            });
        }

        // Verify password
        const isValidPassword = await verifyAdminPassword(validatedData.password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                }
            });
        }

        // Update last login timestamp
        await adminStorage.updateLastLogin(admin.id);

        // Log admin login activity
        await adminStorage.logAdminActivity({
            adminId: admin.id,
            action: 'LOGIN',
            resourceType: 'AUTH',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // Generate token
        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            },
        });
    } catch (error) {
        console.error('Admin login error:', error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                    details: error.errors
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal server error'
            }
        });
    }
});

// GET /api/admin/auth/me
router.get('/admin/auth/me', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Fetch fresh admin data from database
        const admin = await adminStorage.getAdminById(req.admin.id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Admin not found'
                }
            });
        }

        res.json({
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                lastLogin: admin.lastLogin,
            },
        });
    } catch (error) {
        console.error('Error fetching admin profile:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch admin profile'
            }
        });
    }
});

// POST /api/admin/auth/logout
router.post('/admin/auth/logout', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Log admin logout activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'LOGOUT',
            resourceType: 'AUTH',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Admin logout error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to logout'
            }
        });
    }
});

// GET /api/admin/dashboard/metrics
router.get('/admin/dashboard/metrics', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Fetch all metrics in parallel for better performance
        const [userMetrics, subscriptionMetrics, revenueMetrics, systemHealthMetrics, recentActivity] = await Promise.all([
            adminStorage.getUserMetrics(),
            adminStorage.getSubscriptionMetrics(),
            adminStorage.getRevenueMetrics(),
            adminStorage.getSystemHealthMetrics(),
            adminStorage.getRecentActivity(),
        ]);

        res.json({
            success: true,
            data: {
                users: userMetrics,
                subscriptions: subscriptionMetrics,
                revenue: revenueMetrics,
                system: systemHealthMetrics,
                recentActivity,
            },
        });
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch dashboard metrics'
            }
        });
    }
});

// GET /api/admin/dashboard/recent-activity
router.get('/admin/dashboard/recent-activity', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Fetch recent activity from database
        const recentActivity = await adminStorage.getRecentActivity();

        res.json({
            success: true,
            data: recentActivity,
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch recent activity'
            }
        });
    }
});

// GET /api/admin/analytics/revenue
router.get('/admin/analytics/revenue', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Fetch revenue analytics from database
        const revenueAnalytics = await adminStorage.getRevenueAnalytics();

        res.json({
            success: true,
            data: revenueAnalytics,
        });
    } catch (error) {
        console.error('Error fetching revenue analytics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch revenue analytics'
            }
        });
    }
});

// GET /api/admin/dashboard/charts/revenue
router.get('/admin/dashboard/charts/revenue', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Validate period parameter
        const period = req.query.period as string;
        if (!period || !['week', 'month', 'year'].includes(period)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid period parameter. Must be one of: week, month, year'
                }
            });
        }

        // Fetch revenue chart data from database
        const chartData = await adminStorage.getRevenueChartData(period as 'week' | 'month' | 'year');

        res.json({
            success: true,
            data: chartData,
        });
    } catch (error) {
        console.error('Error fetching revenue chart data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch revenue chart data'
            }
        });
    }
});

// GET /api/admin/dashboard/charts/user-growth
router.get('/admin/dashboard/charts/user-growth', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Validate period parameter
        const period = req.query.period as string;
        if (!period || !['week', 'month', 'year'].includes(period)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid period parameter. Must be one of: week, month, year'
                }
            });
        }

        // Fetch user growth chart data from database
        const chartData = await adminStorage.getUserGrowthChartData(period as 'week' | 'month' | 'year');

        res.json({
            success: true,
            data: chartData,
        });
    } catch (error) {
        console.error('Error fetching user growth chart data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch user growth chart data'
            }
        });
    }
});

// GET /api/admin/dashboard/charts/subscriptions
router.get('/admin/dashboard/charts/subscriptions', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin not authenticated'
                }
            });
        }

        // Validate period parameter
        const period = req.query.period as string;
        if (!period || !['week', 'month', 'year'].includes(period)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid period parameter. Must be one of: week, month, year'
                }
            });
        }

        // Fetch subscription trend chart data from database
        const chartData = await adminStorage.getSubscriptionTrendChartData(period as 'week' | 'month' | 'year');

        res.json({
            success: true,
            data: chartData,
        });
    } catch (error) {
        console.error('Error fetching subscription trend chart data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch subscription trend chart data'
            }
        });
    }
});

export default router;
