import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
    generateAdminToken,
    verifyAdminPassword,
    requireAdminAuth,
    type AdminAuthRequest
} from './admin-auth';
import { adminStorage } from './admin-storage';
import { midtransService, type WebhookNotification } from '../services/midtrans-service';
import { updateEnvVariables, getEnvVariable } from '../utils/env-manager';

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

// GET /api/admin/users - User list with pagination, search, and filtering
router.get('/admin/users', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const plan = req.query.plan as string;
        const status = req.query.status as string;

        // Validate pagination parameters
        if (page < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Page must be greater than 0'
                }
            });
        }

        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be between 1 and 100'
                }
            });
        }

        // Fetch user list from database
        const result = await adminStorage.getUserList({
            page,
            limit,
            search,
            plan,
            status,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_USER_LIST',
            resourceType: 'USER',
            details: { page, limit, search, plan, status },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching user list:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch user list'
            }
        });
    }
});

// GET /api/admin/users/export - Export user data as CSV
// IMPORTANT: This route must come BEFORE /admin/users/:id to avoid matching "export" as an ID
router.get('/admin/users/export', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const search = req.query.search as string;
        const plan = req.query.plan as string;
        const status = req.query.status as string;
        const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

        // Validate date range if provided
        if (dateFrom && isNaN(dateFrom)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateFrom parameter'
                }
            });
        }

        if (dateTo && isNaN(dateTo)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateTo parameter'
                }
            });
        }

        // Fetch user data for export
        const userData = await adminStorage.getUserDataForExport({
            search,
            plan,
            status,
            dateFrom,
            dateTo,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'EXPORT_USER_DATA',
            resourceType: 'USER',
            details: { search, plan, status, dateFrom, dateTo, count: userData.length },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // Generate CSV content
        const csvHeaders = [
            'User ID',
            'Email',
            'First Name',
            'Last Name',
            'Full Name',
            'Subscription Plan',
            'Status',
            'Registration Date',
            'Last Login',
            'Transaction Count',
            'Budget Count',
            'Goal Count'
        ];

        const csvRows = userData.map(user => [
            user.id,
            user.email,
            user.firstName,
            user.lastName,
            user.fullName,
            user.subscriptionPlanDisplay,
            user.status,
            user.registrationDate && !isNaN(user.registrationDate) ? new Date(user.registrationDate * 1000).toISOString() : '',
            user.lastLogin && !isNaN(user.lastLogin) ? new Date(user.lastLogin * 1000).toISOString() : '',
            user.transactionCount,
            user.budgetCount,
            user.goalCount
        ]);

        // Escape CSV values (handle commas, quotes, newlines)
        const escapeCSV = (value: any): string => {
            if (value === null || value === undefined) {
                return '';
            }
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        // Build CSV content
        const csvContent = [
            csvHeaders.map(escapeCSV).join(','),
            ...csvRows.map(row => row.map(escapeCSV).join(','))
        ].join('\n');

        // Set response headers for CSV download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `users-export-${timestamp}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');

        // Send CSV content
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting user data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to export user data'
            }
        });
    }
});

// GET /api/admin/users/:id - Get user details
router.get('/admin/users/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const userId = req.params.id;

        // Fetch user details from database
        const userDetails = await adminStorage.getUserDetails(userId);

        if (!userDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_USER_DETAILS',
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: userDetails,
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch user details'
            }
        });
    }
});

// PUT /api/admin/users/:id/suspend - Suspend user account
router.put('/admin/users/:id/suspend', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const userId = req.params.id;
        const { reason } = req.body;

        // Validate reason
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Suspension reason is required'
                }
            });
        }

        // Check if user exists
        const userDetails = await adminStorage.getUserDetails(userId);
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Suspend user
        await adminStorage.suspendUser(userId, reason);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'SUSPEND_USER',
            resourceType: 'USER',
            resourceId: userId,
            details: { reason },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // TODO: Send notification email to user
        // This would be implemented in a separate email service

        res.json({
            success: true,
            message: 'User suspended successfully',
        });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to suspend user'
            }
        });
    }
});

// PUT /api/admin/users/:id/activate - Activate user account
router.put('/admin/users/:id/activate', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const userId = req.params.id;

        // Check if user exists
        const userDetails = await adminStorage.getUserDetails(userId);
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Activate user
        await adminStorage.activateUser(userId);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'ACTIVATE_USER',
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // TODO: Send notification email to user
        // This would be implemented in a separate email service

        res.json({
            success: true,
            message: 'User activated successfully',
        });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to activate user'
            }
        });
    }
});

// DELETE /api/admin/users/:id - Soft delete user account
router.delete('/admin/users/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const userId = req.params.id;
        const { reason } = req.body;

        // Validate reason
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Deletion reason is required'
                }
            });
        }

        // Check if user exists
        const userDetails = await adminStorage.getUserDetails(userId);
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Soft delete user
        await adminStorage.deleteUser(userId, reason);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'DELETE_USER',
            resourceType: 'USER',
            resourceId: userId,
            details: { reason },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // TODO: Send notification email to user
        // This would be implemented in a separate email service

        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete user'
            }
        });
    }
});

// GET /api/admin/users/:id/activity - Get user activity analytics
router.get('/admin/users/:id/activity', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const userId = req.params.id;

        // Fetch user activity analytics from database
        const activityData = await adminStorage.getUserActivity(userId);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_USER_ACTIVITY',
            resourceType: 'USER',
            resourceId: userId,
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: activityData,
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);

        if (error instanceof Error && error.message === 'User not found') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch user activity'
            }
        });
    }
});

// Subscription Plans CRUD API

// Validation schemas for subscription plans
const createPlanSchema = z.object({
    name: z.string().min(1, 'Plan name is required'),
    displayName: z.string().min(1, 'Display name is required'),
    description: z.string().optional(),
    priceMonthly: z.number().min(0, 'Monthly price must be non-negative'),
    priceYearly: z.number().min(0, 'Yearly price must be non-negative'),
    currency: z.string().default('IDR'),
    features: z.array(z.string()).min(1, 'At least one feature is required'),
    limits: z.object({
        transactionLimit: z.number().int(),
        accountLimit: z.number().int(),
        budgetLimit: z.number().int(),
        goalLimit: z.number().int(),
        aiInsights: z.boolean(),
        advancedReports: z.boolean(),
        prioritySupport: z.boolean(),
        apiAccess: z.boolean(),
    }),
    isActive: z.boolean().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

// GET /api/admin/plans - Get all subscription plans
router.get('/admin/plans', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Fetch all plans from database
        const plans = await adminStorage.getAllPlans();

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_PLANS',
            resourceType: 'SUBSCRIPTION_PLAN',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: plans,
        });
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch subscription plans'
            }
        });
    }
});

// POST /api/admin/plans - Create new subscription plan
router.post('/admin/plans', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate input
        const validatedData = createPlanSchema.parse(req.body);

        // Create plan in database
        const newPlan = await adminStorage.createPlan(validatedData);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'CREATE_PLAN',
            resourceType: 'SUBSCRIPTION_PLAN',
            resourceId: String(newPlan.id),
            details: { planName: newPlan.name },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.status(201).json({
            success: true,
            data: newPlan,
            message: 'Subscription plan created successfully',
        });
    } catch (error) {
        console.error('Error creating subscription plan:', error);

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

        // Check for unique constraint violation (duplicate plan name)
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'RESOURCE_ALREADY_EXISTS',
                    message: 'A plan with this name already exists'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create subscription plan'
            }
        });
    }
});

// PUT /api/admin/plans/:id - Update subscription plan
router.put('/admin/plans/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const planId = parseInt(req.params.id);

        if (isNaN(planId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid plan ID'
                }
            });
        }

        // Check if plan exists
        const existingPlan = await adminStorage.getPlanById(planId);
        if (!existingPlan) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Subscription plan not found'
                }
            });
        }

        // Validate input
        const validatedData = updatePlanSchema.parse(req.body);

        // Update plan in database
        const updatedPlan = await adminStorage.updatePlan(planId, validatedData);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPDATE_PLAN',
            resourceType: 'SUBSCRIPTION_PLAN',
            resourceId: String(planId),
            details: { updates: validatedData },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedPlan,
            message: 'Subscription plan updated successfully',
        });
    } catch (error) {
        console.error('Error updating subscription plan:', error);

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

        // Check for unique constraint violation (duplicate plan name)
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'RESOURCE_CONFLICT',
                    message: 'A plan with this name already exists'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update subscription plan'
            }
        });
    }
});

// DELETE /api/admin/plans/:id - Delete subscription plan
router.delete('/admin/plans/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const planId = parseInt(req.params.id);

        if (isNaN(planId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid plan ID'
                }
            });
        }

        // Check if plan exists
        const existingPlan = await adminStorage.getPlanById(planId);
        if (!existingPlan) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Subscription plan not found'
                }
            });
        }

        // Delete plan (soft delete)
        await adminStorage.deletePlan(planId);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'DELETE_PLAN',
            resourceType: 'SUBSCRIPTION_PLAN',
            resourceId: String(planId),
            details: { planName: existingPlan.name },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            message: 'Subscription plan deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting subscription plan:', error);

        // Check for active subscriptions error
        if (error instanceof Error && error.message.includes('Cannot delete plan with')) {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'RESOURCE_CONFLICT',
                    message: error.message
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete subscription plan'
            }
        });
    }
});

// GET /api/admin/subscriptions - Get subscription list with pagination, search, and filtering
router.get('/admin/subscriptions', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const plan = req.query.plan as string;
        const status = req.query.status as string;

        // Validate pagination parameters
        if (page < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Page must be greater than 0'
                }
            });
        }

        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be between 1 and 100'
                }
            });
        }

        // Validate status parameter if provided
        if (status && !['active', 'expired', 'cancelled', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid status. Must be one of: active, expired, cancelled, pending'
                }
            });
        }

        // Fetch subscription list from database
        const result = await adminStorage.getSubscriptionList({
            page,
            limit,
            search,
            plan,
            status,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_SUBSCRIPTION_LIST',
            resourceType: 'SUBSCRIPTION',
            details: { page, limit, search, plan, status },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching subscription list:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch subscription list'
            }
        });
    }
});

// GET /api/admin/subscriptions/:id - Get subscription details with payment history and invoices
router.get('/admin/subscriptions/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const subscriptionId = parseInt(req.params.id);

        if (isNaN(subscriptionId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid subscription ID'
                }
            });
        }

        // Fetch subscription details from database
        const subscriptionDetails = await adminStorage.getSubscriptionDetails(subscriptionId);

        if (!subscriptionDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Subscription not found'
                }
            });
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_SUBSCRIPTION_DETAILS',
            resourceType: 'SUBSCRIPTION',
            resourceId: String(subscriptionId),
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: subscriptionDetails,
        });
    } catch (error) {
        console.error('Error fetching subscription details:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch subscription details'
            }
        });
    }
});

// Validation schemas for subscription management actions
const extendSubscriptionSchema = z.object({
    days: z.number().int().min(1, 'Days must be at least 1').max(365, 'Days cannot exceed 365'),
    reason: z.string().min(1, 'Reason is required'),
});

const upgradeDowngradeSubscriptionSchema = z.object({
    newPlanId: z.number().int().min(1, 'New plan ID is required'),
});

const cancelSubscriptionSchema = z.object({
    reason: z.string().min(1, 'Cancellation reason is required'),
});

// PUT /api/admin/subscriptions/:id/extend - Extend subscription by adding days
router.put('/admin/subscriptions/:id/extend', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const subscriptionId = parseInt(req.params.id);

        if (isNaN(subscriptionId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid subscription ID'
                }
            });
        }

        // Validate input
        const validatedData = extendSubscriptionSchema.parse(req.body);

        // Extend subscription
        const updatedSubscription = await adminStorage.extendSubscription(
            subscriptionId,
            validatedData.days,
            validatedData.reason
        );

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'EXTEND_SUBSCRIPTION',
            resourceType: 'SUBSCRIPTION',
            resourceId: String(subscriptionId),
            details: { days: validatedData.days, reason: validatedData.reason },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedSubscription,
            message: `Subscription extended by ${validatedData.days} days successfully`,
        });
    } catch (error) {
        console.error('Error extending subscription:', error);

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

        if (error instanceof Error && error.message === 'Subscription not found') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Subscription not found'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to extend subscription'
            }
        });
    }
});

// PUT /api/admin/subscriptions/:id/upgrade - Upgrade subscription to a higher plan
router.put('/admin/subscriptions/:id/upgrade', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const subscriptionId = parseInt(req.params.id);

        if (isNaN(subscriptionId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid subscription ID'
                }
            });
        }

        // Validate input
        const validatedData = upgradeDowngradeSubscriptionSchema.parse(req.body);

        // Upgrade subscription
        const updatedSubscription = await adminStorage.upgradeSubscription(
            subscriptionId,
            validatedData.newPlanId
        );

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPGRADE_SUBSCRIPTION',
            resourceType: 'SUBSCRIPTION',
            resourceId: String(subscriptionId),
            details: { newPlanId: validatedData.newPlanId },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedSubscription,
            message: 'Subscription upgraded successfully',
        });
    } catch (error) {
        console.error('Error upgrading subscription:', error);

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

        if (error instanceof Error) {
            if (error.message === 'Subscription not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Subscription not found'
                    }
                });
            }
            if (error.message === 'New plan not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'New plan not found'
                    }
                });
            }
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to upgrade subscription'
            }
        });
    }
});

// PUT /api/admin/subscriptions/:id/downgrade - Downgrade subscription to a lower plan
router.put('/admin/subscriptions/:id/downgrade', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const subscriptionId = parseInt(req.params.id);

        if (isNaN(subscriptionId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid subscription ID'
                }
            });
        }

        // Validate input
        const validatedData = upgradeDowngradeSubscriptionSchema.parse(req.body);

        // Downgrade subscription
        const updatedSubscription = await adminStorage.downgradeSubscription(
            subscriptionId,
            validatedData.newPlanId
        );

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'DOWNGRADE_SUBSCRIPTION',
            resourceType: 'SUBSCRIPTION',
            resourceId: String(subscriptionId),
            details: { newPlanId: validatedData.newPlanId },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedSubscription,
            message: 'Subscription downgraded successfully',
        });
    } catch (error) {
        console.error('Error downgrading subscription:', error);

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

        if (error instanceof Error) {
            if (error.message === 'Subscription not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Subscription not found'
                    }
                });
            }
            if (error.message === 'New plan not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'New plan not found'
                    }
                });
            }
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to downgrade subscription'
            }
        });
    }
});

// PUT /api/admin/subscriptions/:id/cancel - Cancel subscription
router.put('/admin/subscriptions/:id/cancel', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const subscriptionId = parseInt(req.params.id);

        if (isNaN(subscriptionId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid subscription ID'
                }
            });
        }

        // Validate input
        const validatedData = cancelSubscriptionSchema.parse(req.body);

        // Cancel subscription
        await adminStorage.cancelSubscription(subscriptionId, validatedData.reason);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'CANCEL_SUBSCRIPTION',
            resourceType: 'SUBSCRIPTION',
            resourceId: String(subscriptionId),
            details: { reason: validatedData.reason },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            message: 'Subscription cancelled successfully',
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);

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

        if (error instanceof Error && error.message === 'Subscription not found') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Subscription not found'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to cancel subscription'
            }
        });
    }
});

// GET /api/admin/analytics/subscriptions - Get subscription analytics
router.get('/admin/analytics/subscriptions', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Fetch subscription analytics from database
        const subscriptionAnalytics = await adminStorage.getSubscriptionAnalytics();

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_SUBSCRIPTION_ANALYTICS',
            resourceType: 'ANALYTICS',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: subscriptionAnalytics,
        });
    } catch (error) {
        console.error('Error fetching subscription analytics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch subscription analytics'
            }
        });
    }
});

// GET /api/admin/analytics/export - Export analytics data as CSV or Excel
router.get('/admin/analytics/export', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const type = req.query.type as string;
        const format = req.query.format as string;
        const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

        // Validate type parameter
        if (!type || !['revenue', 'subscriptions', 'users'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid type parameter. Must be one of: revenue, subscriptions, users'
                }
            });
        }

        // Validate format parameter
        if (!format || !['csv', 'excel'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid format parameter. Must be one of: csv, excel'
                }
            });
        }

        // Validate date range if provided
        if (dateFrom && isNaN(dateFrom)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateFrom parameter'
                }
            });
        }

        if (dateTo && isNaN(dateTo)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateTo parameter'
                }
            });
        }

        // Fetch data based on type
        let exportData: any[] = [];
        let headers: string[] = [];
        let filename: string = '';

        if (type === 'revenue') {
            // Fetch revenue data with date range filter
            const revenueData = await adminStorage.getRevenueExportData({ dateFrom, dateTo });
            exportData = revenueData;
            headers = [
                'Payment ID',
                'User Email',
                'Plan',
                'Amount',
                'Currency',
                'Payment Method',
                'Status',
                'Paid At',
                'Created At'
            ];
            filename = `revenue-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
        } else if (type === 'subscriptions') {
            // Fetch subscription data with date range filter
            const subscriptionData = await adminStorage.getSubscriptionExportData({ dateFrom, dateTo });
            exportData = subscriptionData;
            headers = [
                'Subscription ID',
                'User Email',
                'Plan',
                'Status',
                'Billing Cycle',
                'Start Date',
                'End Date',
                'Auto Renew',
                'Created At'
            ];
            filename = `subscriptions-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
        } else if (type === 'users') {
            // Fetch user data with date range filter
            const userData = await adminStorage.getUserDataForExport({
                dateFrom,
                dateTo,
            });
            exportData = userData;
            headers = [
                'User ID',
                'Email',
                'First Name',
                'Last Name',
                'Full Name',
                'Subscription Plan',
                'Status',
                'Registration Date',
                'Last Login',
                'Transaction Count',
                'Budget Count',
                'Goal Count'
            ];
            filename = `users-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'EXPORT_ANALYTICS_DATA',
            resourceType: 'ANALYTICS',
            details: { type, format, dateFrom, dateTo, count: exportData.length },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // Generate export based on format
        if (format === 'csv') {
            // Escape CSV values (handle commas, quotes, newlines)
            const escapeCSV = (value: any): string => {
                if (value === null || value === undefined) {
                    return '';
                }
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            };

            // Build CSV content
            const csvRows = exportData.map(row => {
                if (type === 'revenue') {
                    return [
                        row.id,
                        row.userEmail,
                        row.planName,
                        row.amount,
                        row.currency,
                        row.paymentMethod,
                        row.status,
                        row.paidAt && !isNaN(row.paidAt) ? new Date(row.paidAt * 1000).toISOString() : '',
                        row.createdAt && !isNaN(row.createdAt) ? new Date(row.createdAt * 1000).toISOString() : ''
                    ];
                } else if (type === 'subscriptions') {
                    return [
                        row.id,
                        row.userEmail,
                        row.planName,
                        row.status,
                        row.billingCycle,
                        row.startDate && !isNaN(row.startDate) ? new Date(row.startDate * 1000).toISOString() : '',
                        row.endDate && !isNaN(row.endDate) ? new Date(row.endDate * 1000).toISOString() : '',
                        row.autoRenew ? 'Yes' : 'No',
                        row.createdAt && !isNaN(row.createdAt) ? new Date(row.createdAt * 1000).toISOString() : ''
                    ];
                } else {
                    return [
                        row.id,
                        row.email,
                        row.firstName,
                        row.lastName,
                        row.fullName,
                        row.subscriptionPlanDisplay,
                        row.status,
                        row.registrationDate && !isNaN(row.registrationDate) ? new Date(row.registrationDate * 1000).toISOString() : '',
                        row.lastLogin && !isNaN(row.lastLogin) ? new Date(row.lastLogin * 1000).toISOString() : '',
                        row.transactionCount,
                        row.budgetCount,
                        row.goalCount
                    ];
                }
            });

            const csvContent = [
                headers.map(escapeCSV).join(','),
                ...csvRows.map(row => row.map(escapeCSV).join(','))
            ].join('\n');

            // Set response headers for CSV download
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');

            // Send CSV content
            res.send(csvContent);
        } else if (format === 'excel') {
            // Generate Excel file using jsPDF with autoTable
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Add title
            doc.setFontSize(16);
            doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Export Report`, 14, 15);

            // Add date range if provided
            if (dateFrom || dateTo) {
                doc.setFontSize(10);
                let dateRangeText = 'Date Range: ';
                if (dateFrom) {
                    dateRangeText += `From ${new Date(dateFrom * 1000).toLocaleDateString()}`;
                }
                if (dateTo) {
                    dateRangeText += ` To ${new Date(dateTo * 1000).toLocaleDateString()}`;
                }
                doc.text(dateRangeText, 14, 22);
            }

            // Prepare table data
            const tableData = exportData.map(row => {
                if (type === 'revenue') {
                    return [
                        row.id,
                        row.userEmail,
                        row.planName,
                        row.amount,
                        row.currency,
                        row.paymentMethod,
                        row.status,
                        row.paidAt && !isNaN(row.paidAt) ? new Date(row.paidAt * 1000).toLocaleDateString() : '',
                        row.createdAt && !isNaN(row.createdAt) ? new Date(row.createdAt * 1000).toLocaleDateString() : ''
                    ];
                } else if (type === 'subscriptions') {
                    return [
                        row.id,
                        row.userEmail,
                        row.planName,
                        row.status,
                        row.billingCycle,
                        row.startDate && !isNaN(row.startDate) ? new Date(row.startDate * 1000).toLocaleDateString() : '',
                        row.endDate && !isNaN(row.endDate) ? new Date(row.endDate * 1000).toLocaleDateString() : '',
                        row.autoRenew ? 'Yes' : 'No',
                        row.createdAt && !isNaN(row.createdAt) ? new Date(row.createdAt * 1000).toLocaleDateString() : ''
                    ];
                } else {
                    return [
                        row.id,
                        row.email,
                        row.firstName,
                        row.lastName,
                        row.fullName,
                        row.subscriptionPlanDisplay,
                        row.status,
                        row.registrationDate && !isNaN(row.registrationDate) ? new Date(row.registrationDate * 1000).toLocaleDateString() : '',
                        row.lastLogin && !isNaN(row.lastLogin) ? new Date(row.lastLogin * 1000).toLocaleDateString() : '',
                        row.transactionCount,
                        row.budgetCount,
                        row.goalCount
                    ];
                }
            });

            // Add table
            autoTable(doc, {
                head: [headers],
                body: tableData,
                startY: dateFrom || dateTo ? 28 : 22,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [99, 102, 241], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { top: 10 },
            });

            // Generate PDF buffer
            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Content-Length', pdfBuffer.length.toString());

            // Send PDF content
            res.send(pdfBuffer);
        }
    } catch (error) {
        console.error('Error exporting analytics data:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to export analytics data'
            }
        });
    }
});

// GET /api/admin/payments - Get payment list with pagination, search, and filtering
router.get('/admin/payments', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const pageParam = req.query.page as string;
        const limitParam = req.query.limit as string;
        const page = pageParam ? parseInt(pageParam) : 1;
        const limit = limitParam ? parseInt(limitParam) : 20;
        const search = req.query.search as string;
        const status = req.query.status as string;
        const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

        // Validate pagination parameters
        if (isNaN(page) || page < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Page must be greater than 0'
                }
            });
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be between 1 and 100'
                }
            });
        }

        // Validate status parameter if provided
        if (status && !['pending', 'paid', 'failed', 'refunded'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid status. Must be one of: pending, paid, failed, refunded'
                }
            });
        }

        // Validate date range if provided
        if (dateFrom && isNaN(dateFrom)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateFrom parameter'
                }
            });
        }

        if (dateTo && isNaN(dateTo)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateTo parameter'
                }
            });
        }

        // Fetch payment list from database
        const result = await adminStorage.getPaymentList({
            page,
            limit,
            search,
            status,
            dateFrom,
            dateTo,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_PAYMENT_LIST',
            resourceType: 'PAYMENT',
            details: { page, limit, search, status, dateFrom, dateTo },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching payment list:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch payment list'
            }
        });
    }
});

// GET /api/admin/payments/:id - Get payment details with Midtrans transaction details, invoice, and webhook logs
router.get('/admin/payments/:id', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const paymentId = parseInt(req.params.id);

        if (isNaN(paymentId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid payment ID'
                }
            });
        }

        // Fetch payment details from database
        const paymentDetails = await adminStorage.getPaymentDetails(paymentId);

        if (!paymentDetails) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Payment not found'
                }
            });
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_PAYMENT_DETAILS',
            resourceType: 'PAYMENT',
            resourceId: String(paymentId),
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: paymentDetails,
        });
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch payment details'
            }
        });
    }
});

// Validation schema for invoice generation
const generateInvoiceSchema = z.object({
    paymentId: z.number().int().min(1, 'Payment ID is required'),
});

// POST /api/admin/invoices/generate - Generate invoice for a payment
router.post('/admin/invoices/generate', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate input
        const validatedData = generateInvoiceSchema.parse(req.body);

        // Generate invoice in database
        const invoice = await adminStorage.generateInvoice(validatedData.paymentId);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'GENERATE_INVOICE',
            resourceType: 'INVOICE',
            resourceId: String(invoice.id),
            details: { paymentId: validatedData.paymentId, invoiceNumber: invoice.invoiceNumber },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // Generate PDF invoice
        const doc = new jsPDF();

        // Add company header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 105, 20, { align: 'center' });

        // Add invoice details
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 40);
        doc.text(`Issue Date: ${new Date(invoice.issuedAt * 1000).toLocaleDateString()}`, 20, 46);
        doc.text(`Due Date: ${new Date(invoice.dueAt * 1000).toLocaleDateString()}`, 20, 52);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 58);

        // Add customer details
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', 20, 70);
        doc.setFont('helvetica', 'normal');
        doc.text(`${invoice.user.firstName} ${invoice.user.lastName}`, 20, 76);
        doc.text(invoice.user.email, 20, 82);

        // Add payment details if available
        if (invoice.payment) {
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Details:', 120, 70);
            doc.setFont('helvetica', 'normal');
            doc.text(`Method: ${invoice.payment.paymentMethod}`, 120, 76);
            doc.text(`Status: ${invoice.payment.status}`, 120, 82);
            if (invoice.payment.midtransTransactionId) {
                doc.text(`Transaction ID: ${invoice.payment.midtransTransactionId}`, 120, 88);
            }
        }

        // Add items table
        const tableData = invoice.items.map((item: any) => [
            item.description,
            item.quantity.toString(),
            `${invoice.currency} ${item.unitPrice.toLocaleString()}`,
            `${invoice.currency} ${item.total.toLocaleString()}`,
        ]);

        autoTable(doc, {
            startY: 100,
            head: [['Description', 'Quantity', 'Unit Price', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [66, 139, 202] },
            styles: { fontSize: 10 },
        });

        // Add total
        const finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: ${invoice.currency} ${invoice.amount.toLocaleString()}`, 20, finalY + 15);

        // Add payment status
        if (invoice.paidAt) {
            doc.setFont('helvetica', 'normal');
            doc.text(`Paid on: ${new Date(invoice.paidAt * 1000).toLocaleDateString()}`, 20, finalY + 25);
        }

        // Add footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Thank you for your business!', 105, 280, { align: 'center' });

        // Convert PDF to base64
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        res.json({
            success: true,
            data: {
                invoice,
                pdf: pdfBase64,
            },
            message: 'Invoice generated successfully',
        });
    } catch (error) {
        console.error('Error generating invoice:', error);

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

        if (error instanceof Error) {
            if (error.message === 'Payment not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Payment not found'
                    }
                });
            }
            if (error.message === 'Invoice already exists for this payment') {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_ALREADY_EXISTS',
                        message: 'Invoice already exists for this payment'
                    }
                });
            }
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'User not found'
                    }
                });
            }
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to generate invoice'
            }
        });
    }
});

// Validation schema for payment refund
const refundPaymentSchema = z.object({
    reason: z.string().min(1, 'Refund reason is required'),
    amount: z.number().positive().optional(), // Optional partial refund amount
});

// POST /api/admin/payments/:id/refund - Process payment refund via Midtrans
router.post('/admin/payments/:id/refund', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const paymentId = parseInt(req.params.id);

        if (isNaN(paymentId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid payment ID'
                }
            });
        }

        // Validate input
        const validatedData = refundPaymentSchema.parse(req.body);

        // Process refund
        const refundResult = await adminStorage.refundPayment(
            paymentId,
            validatedData.reason,
            validatedData.amount
        );

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'REFUND_PAYMENT',
            resourceType: 'PAYMENT',
            resourceId: String(paymentId),
            details: {
                reason: validatedData.reason,
                amount: validatedData.amount,
                refundStatus: refundResult.refundStatus
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: refundResult,
            message: 'Payment refunded successfully',
        });
    } catch (error) {
        console.error('Error refunding payment:', error);

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

        if (error instanceof Error) {
            if (error.message === 'Payment not found') {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Payment not found'
                    }
                });
            }
            if (error.message === 'Payment is not in paid status') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_PAYMENT_STATUS',
                        message: 'Only paid payments can be refunded'
                    }
                });
            }
            if (error.message === 'Payment has already been refunded') {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'PAYMENT_ALREADY_REFUNDED',
                        message: 'This payment has already been refunded'
                    }
                });
            }
            if (error.message.includes('Midtrans')) {
                return res.status(502).json({
                    success: false,
                    error: {
                        code: 'EXTERNAL_SERVICE_ERROR',
                        message: error.message
                    }
                });
            }
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to process refund'
            }
        });
    }
});

// POST /api/webhooks/midtrans - Midtrans webhook handler
// NOTE: This endpoint does NOT require admin authentication as it's called by Midtrans
router.post('/webhooks/midtrans', async (req: Request, res: Response) => {
    try {
        console.log('=== MIDTRANS WEBHOOK RECEIVED ===');
        console.log('Payload:', JSON.stringify(req.body, null, 2));

        // Parse webhook notification
        const notification: WebhookNotification = req.body;

        // Validate required fields
        if (!notification.order_id || !notification.transaction_status || !notification.signature_key) {
            console.error('Invalid webhook payload: missing required fields');

            // Log failed webhook
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id || 'unknown',
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status || 'unknown',
                payload: JSON.stringify(req.body),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: 'Missing required fields in webhook payload',
            });

            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid webhook payload'
                }
            });
        }

        // Verify webhook signature
        const isValidSignature = midtransService.verifyWebhookSignature(notification);

        if (!isValidSignature) {
            console.error('Invalid webhook signature');

            // Log failed webhook
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id,
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status,
                payload: JSON.stringify(req.body),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: 'Invalid webhook signature',
            });

            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_SIGNATURE',
                    message: 'Invalid webhook signature'
                }
            });
        }

        console.log('Webhook signature verified successfully');

        // Find payment by Midtrans order ID
        const payment = await adminStorage.getPaymentByMidtransOrderId(notification.order_id);

        if (!payment) {
            console.error(`Payment not found for order ID: ${notification.order_id}`);

            // Log webhook even if payment not found
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id,
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status,
                payload: JSON.stringify(req.body),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: 'Payment not found',
            });

            return res.status(404).json({
                success: false,
                error: {
                    code: 'PAYMENT_NOT_FOUND',
                    message: 'Payment not found'
                }
            });
        }

        console.log(`Payment found: ID ${payment.id}, current status: ${payment.status}`);

        // Determine new payment status based on transaction status
        let newPaymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' = payment.status;
        let shouldActivateSubscription = false;

        switch (notification.transaction_status) {
            case 'capture':
            case 'settlement':
                // Payment successful
                newPaymentStatus = 'paid';
                shouldActivateSubscription = true;
                console.log('Payment successful - will activate subscription');
                break;

            case 'pending':
                // Payment pending
                newPaymentStatus = 'pending';
                console.log('Payment pending');
                break;

            case 'deny':
            case 'expire':
            case 'cancel':
                // Payment failed
                newPaymentStatus = 'failed';
                console.log('Payment failed');
                break;

            case 'refund':
            case 'partial_refund':
                // Payment refunded
                newPaymentStatus = 'refunded';
                console.log('Payment refunded');
                break;

            default:
                console.log(`Unknown transaction status: ${notification.transaction_status}`);
                break;
        }

        // Update payment status in database
        const updatedPayment = await adminStorage.updatePaymentStatus(
            payment.id,
            newPaymentStatus,
            notification.transaction_id,
            notification.settlement_time ? parseInt(notification.settlement_time) : undefined
        );

        console.log(`Payment status updated to: ${newPaymentStatus}`);

        // Activate subscription if payment successful
        if (shouldActivateSubscription && payment.subscriptionId) {
            try {
                await adminStorage.activateSubscriptionAfterPayment(payment.subscriptionId);
                console.log(`Subscription ${payment.subscriptionId} activated successfully`);
            } catch (error) {
                console.error('Error activating subscription:', error);
                // Don't fail the webhook if subscription activation fails
                // Log it for manual review
            }
        }

        // Log successful webhook processing
        await adminStorage.logMidtransWebhook({
            orderId: notification.order_id,
            transactionId: notification.transaction_id,
            eventType: notification.transaction_status,
            payload: JSON.stringify(req.body),
            signature: notification.signature_key,
            status: 'processed',
        });

        console.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===');

        // Return success response to Midtrans
        res.json({
            success: true,
            message: 'Webhook processed successfully',
        });
    } catch (error) {
        console.error('=== WEBHOOK PROCESSING ERROR ===');
        console.error('Error processing webhook:', error);

        // Try to log the error
        try {
            const notification: WebhookNotification = req.body;
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id || 'unknown',
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status || 'unknown',
                payload: JSON.stringify(req.body),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        } catch (logError) {
            console.error('Error logging webhook failure:', logError);
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to process webhook'
            }
        });
    }
});

// GET /api/admin/midtrans/status - Test Midtrans API connection and show credentials status
router.get('/admin/midtrans/status', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Get Midtrans configuration
        const config = midtransService.getConfig();

        // Check if credentials are configured
        const hasServerKey = !!config.serverKey && config.serverKey.length > 0;
        const hasClientKey = !!config.clientKey && config.clientKey.length > 0;
        const isConfigured = hasServerKey && hasClientKey;

        // Test API connection if configured
        let connectionStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
        let connectionMessage = '';
        let apiReachable = false;

        if (isConfigured) {
            try {
                apiReachable = await midtransService.testConnection();
                if (apiReachable) {
                    connectionStatus = 'connected';
                    connectionMessage = 'Midtrans API is reachable and credentials are valid';
                } else {
                    connectionStatus = 'disconnected';
                    connectionMessage = 'Midtrans API is not reachable. Please check your network connection.';
                }
            } catch (error) {
                connectionStatus = 'disconnected';
                connectionMessage = `Failed to connect to Midtrans API: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        } else {
            connectionMessage = 'Midtrans credentials are not configured. Please set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY in environment variables.';
        }

        // Mask sensitive credentials for display
        const maskedServerKey = hasServerKey
            ? config.serverKey.substring(0, 8) + '...' + config.serverKey.substring(config.serverKey.length - 4)
            : 'Not configured';

        const maskedClientKey = hasClientKey
            ? config.clientKey.substring(0, 8) + '...' + config.clientKey.substring(config.clientKey.length - 4)
            : 'Not configured';

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_MIDTRANS_STATUS',
            resourceType: 'MIDTRANS',
            details: { connectionStatus, isConfigured },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: {
                connectionStatus,
                connectionMessage,
                apiReachable,
                credentials: {
                    serverKey: maskedServerKey,
                    clientKey: maskedClientKey,
                    isConfigured,
                    hasServerKey,
                    hasClientKey,
                },
                environment: {
                    isProduction: config.isProduction,
                    apiUrl: config.apiUrl,
                },
                webhookUrl: process.env.MIDTRANS_WEBHOOK_URL || 'Not configured',
            },
        });
    } catch (error) {
        console.error('Error checking Midtrans status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to check Midtrans status'
            }
        });
    }
});

// GET /api/admin/midtrans/webhooks - Get webhook logs with pagination and filtering
router.get('/admin/midtrans/webhooks', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const pageParam = req.query.page as string;
        const limitParam = req.query.limit as string;
        const page = pageParam ? parseInt(pageParam) : 1;
        const limit = limitParam ? parseInt(limitParam) : 20;
        const status = req.query.status as string;
        const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

        // Validate pagination parameters
        if (isNaN(page) || page < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Page must be greater than 0'
                }
            });
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be between 1 and 100'
                }
            });
        }

        // Validate status parameter if provided
        if (status && !['processed', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid status. Must be one of: processed, failed'
                }
            });
        }

        // Validate date parameters if provided
        if (dateFrom && isNaN(dateFrom)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateFrom parameter'
                }
            });
        }

        if (dateTo && isNaN(dateTo)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateTo parameter'
                }
            });
        }

        // Fetch webhook logs from database
        const result = await adminStorage.getWebhookLogs({
            page,
            limit,
            status,
            dateFrom,
            dateTo,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_WEBHOOK_LOGS',
            resourceType: 'MIDTRANS',
            details: { page, limit, status, dateFrom, dateTo },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching webhook logs:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch webhook logs'
            }
        });
    }
});

// System Settings API

// Validation schema for updating settings
const updateSettingSchema = z.object({
    value: z.any(), // Can be string, number, boolean, or JSON
});

// Validation schema for updating feature flags
const updateFeatureFlagSchema = z.object({
    enabled: z.boolean(),
    plans: z.array(z.string()).optional(), // Optional: specific plans this feature is enabled for
});

// GET /api/admin/settings - Get all system settings or filter by category
router.get('/admin/settings', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const category = req.query.category as string;

        // Validate category if provided
        const validCategories = ['general', 'payment', 'email', 'whatsapp', 'features'];
        if (category && !validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
                }
            });
        }

        // Fetch settings from database
        const settings = await adminStorage.getSystemSettings(category);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_SETTINGS',
            resourceType: 'SYSTEM_SETTINGS',
            details: { category },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch system settings'
            }
        });
    }
});

// GET /api/admin/settings/features - Get all feature flags
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "features" as a key
router.get('/admin/settings/features', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Fetch feature flags from database (category = 'features')
        const featureFlags = await adminStorage.getFeatureFlags();

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_FEATURE_FLAGS',
            resourceType: 'FEATURE_FLAGS',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: featureFlags,
        });
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch feature flags'
            }
        });
    }
});

// GET /api/admin/settings/audit-log - Get audit log with pagination and filtering
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "audit-log" as a key
router.get('/admin/settings/audit-log', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Parse query parameters
        const pageParam = req.query.page as string;
        const limitParam = req.query.limit as string;
        const page = pageParam ? parseInt(pageParam) : 1;
        const limit = limitParam ? parseInt(limitParam) : 20;
        const adminId = req.query.adminId as string;
        const action = req.query.action as string;
        const resourceType = req.query.resourceType as string;
        const dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom as string) : undefined;
        const dateTo = req.query.dateTo ? parseInt(req.query.dateTo as string) : undefined;

        // Validate pagination parameters
        if (isNaN(page) || page < 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Page must be greater than 0'
                }
            });
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Limit must be between 1 and 100'
                }
            });
        }

        // Validate date parameters if provided
        if (dateFrom && isNaN(dateFrom)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateFrom parameter'
                }
            });
        }

        if (dateTo && isNaN(dateTo)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid dateTo parameter'
                }
            });
        }

        // Fetch audit log from database
        const result = await adminStorage.getAuditLog({
            page,
            limit,
            adminId,
            action,
            resourceType,
            dateFrom,
            dateTo,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_AUDIT_LOG',
            resourceType: 'AUDIT_LOG',
            details: { page, limit, adminId, action, resourceType, dateFrom, dateTo },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch audit log'
            }
        });
    }
});

// PUT /api/admin/settings/features/:key - Update feature flag by key
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "features" as a key
router.put('/admin/settings/features/:key', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const featureKey = req.params.key;

        // Validate input
        const validatedData = updateFeatureFlagSchema.parse(req.body);

        // Get old feature flag value for audit log
        const oldFeatureFlag = await adminStorage.getSystemSettingByKey(featureKey);

        if (!oldFeatureFlag) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Feature flag not found'
                }
            });
        }

        // Verify it's a feature flag (category = 'features')
        if (oldFeatureFlag.category !== 'features') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Setting is not a feature flag'
                }
            });
        }

        // Build feature flag value object
        const featureFlagValue = {
            enabled: validatedData.enabled,
            plans: validatedData.plans || [], // Empty array means enabled for all plans
        };

        // Update feature flag in database
        const updatedFeatureFlag = await adminStorage.updateSystemSetting(
            featureKey,
            featureFlagValue,
            req.admin.id
        );

        // Log admin activity with old and new values
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPDATE_FEATURE_FLAG',
            resourceType: 'FEATURE_FLAGS',
            resourceId: featureKey,
            details: {
                key: featureKey,
                oldValue: oldFeatureFlag.value,
                newValue: featureFlagValue,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedFeatureFlag,
            message: 'Feature flag updated successfully',
        });
    } catch (error) {
        console.error('Error updating feature flag:', error);

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

        if (error instanceof Error && error.message === 'Setting not found') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Feature flag not found'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update feature flag'
            }
        });
    }
});

// Payment Gateway Configuration API

// Encryption key from environment or generate a default one (should be in env for production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars!!'; // Must be 32 chars
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data
 */
function encryptData(text: string): string {
    try {
        // Ensure key is 32 bytes
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
        const iv = randomBytes(16);
        const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return IV + encrypted data
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedText: string): string {
    try {
        // Ensure key is 32 bytes
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
        const parts = encryptedText.split(':');

        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

// Validation schema for payment gateway configuration
const paymentGatewayConfigSchema = z.object({
    serverKey: z.string().min(1, 'Server key is required'),
    clientKey: z.string().min(1, 'Client key is required'),
    isProduction: z.boolean().default(false),
    webhookUrl: z.string().url('Invalid webhook URL').optional(),
});

// GET /api/admin/settings/payment - Get payment gateway configuration
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "payment" as a key
router.get('/admin/settings/payment', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Always read from environment variables (.env file)
        const envServerKey = getEnvVariable('MIDTRANS_SERVER_KEY') || '';
        const envClientKey = getEnvVariable('MIDTRANS_CLIENT_KEY') || '';
        const envIsProduction = getEnvVariable('MIDTRANS_IS_PRODUCTION') === 'true';
        const envWebhookUrl = getEnvVariable('MIDTRANS_WEBHOOK_URL') || '';

        // Mask credentials for security (show first 8 and last 4 chars)
        const config: any = {
            serverKey: envServerKey.length > 12
                ? envServerKey.substring(0, 8) + '...' + envServerKey.substring(envServerKey.length - 4)
                : envServerKey ? '***' : 'Not configured',
            clientKey: envClientKey.length > 12
                ? envClientKey.substring(0, 8) + '...' + envClientKey.substring(envClientKey.length - 4)
                : envClientKey ? '***' : 'Not configured',
            isProduction: envIsProduction,
            webhookUrl: envWebhookUrl,
            hasServerKey: !!envServerKey,
            hasClientKey: !!envClientKey,
            source: 'environment',
        };

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_PAYMENT_SETTINGS',
            resourceType: 'PAYMENT_SETTINGS',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        console.error('Error fetching payment gateway settings:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch payment gateway settings'
            }
        });
    }
});

// PUT /api/admin/settings/payment - Update payment gateway configuration
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "payment" as a key
router.put('/admin/settings/payment', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate input
        const validatedData = paymentGatewayConfigSchema.parse(req.body);

        // Get old settings for audit log
        const oldConfig: any = {
            serverKey: getEnvVariable('MIDTRANS_SERVER_KEY') || '',
            clientKey: getEnvVariable('MIDTRANS_CLIENT_KEY') || '',
            isProduction: getEnvVariable('MIDTRANS_IS_PRODUCTION') === 'true',
            webhookUrl: getEnvVariable('MIDTRANS_WEBHOOK_URL') || '',
        };

        // Update .env file with new values
        const envUpdates: Record<string, string> = {
            MIDTRANS_SERVER_KEY: validatedData.serverKey,
            MIDTRANS_CLIENT_KEY: validatedData.clientKey,
            MIDTRANS_IS_PRODUCTION: validatedData.isProduction ? 'true' : 'false',
        };

        if (validatedData.webhookUrl) {
            envUpdates.MIDTRANS_WEBHOOK_URL = validatedData.webhookUrl;
        }

        // Write to .env file
        const envUpdateSuccess = updateEnvVariables(envUpdates);

        if (!envUpdateSuccess) {
            return res.status(500).json({
                success: false,
                error: {
                    code: 'ENV_UPDATE_FAILED',
                    message: 'Failed to update .env file. Please check file permissions.'
                }
            });
        }

        // Also save to database for backup (encrypted)
        const encryptedServerKey = encryptData(validatedData.serverKey);
        const encryptedClientKey = encryptData(validatedData.clientKey);

        await adminStorage.upsertSystemSetting({
            category: 'payment',
            key: 'payment.midtrans.server_key',
            value: encryptedServerKey,
            dataType: 'string',
            description: 'Midtrans Server Key (encrypted backup)',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'payment',
            key: 'payment.midtrans.client_key',
            value: encryptedClientKey,
            dataType: 'string',
            description: 'Midtrans Client Key (encrypted backup)',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'payment',
            key: 'payment.midtrans.is_production',
            value: validatedData.isProduction,
            dataType: 'boolean',
            description: 'Midtrans Production Mode',
            updatedBy: req.admin.id,
        });

        if (validatedData.webhookUrl) {
            await adminStorage.upsertSystemSetting({
                category: 'payment',
                key: 'payment.midtrans.webhook_url',
                value: validatedData.webhookUrl,
                dataType: 'string',
                description: 'Midtrans Webhook URL',
                updatedBy: req.admin.id,
            });
        }

        // Log admin activity (don't log actual credentials)
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPDATE_PAYMENT_SETTINGS',
            resourceType: 'PAYMENT_SETTINGS',
            details: {
                isProduction: validatedData.isProduction,
                webhookUrl: validatedData.webhookUrl,
                serverKeyUpdated: true,
                clientKeyUpdated: true,
                savedToEnv: true,
                oldConfig: {
                    isProduction: oldConfig.isProduction,
                    webhookUrl: oldConfig.webhookUrl,
                },
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        // Test Midtrans connection with new credentials
        let connectionTestResult = {
            success: false,
            message: 'Connection test not performed',
        };

        try {
            // Create a temporary Midtrans service instance with new credentials
            const testApiUrl = validatedData.isProduction
                ? 'https://api.midtrans.com/v2'
                : 'https://api.sandbox.midtrans.com/v2';

            // Test connection by making a simple API call
            const testOrderId = `test-${Date.now()}`;
            const authHeader = Buffer.from(validatedData.serverKey + ':').toString('base64');

            const response = await fetch(`${testApiUrl}/${testOrderId}/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${authHeader}`,
                },
            });

            // Even if the order doesn't exist (404), if we get a proper response, credentials are valid
            if (response.status === 404 || response.status === 200) {
                connectionTestResult = {
                    success: true,
                    message: 'Midtrans API connection successful. Credentials are valid and saved to .env file.',
                };
            } else if (response.status === 401) {
                connectionTestResult = {
                    success: false,
                    message: 'Invalid Midtrans credentials. Please check your Server Key. Settings were saved to .env file.',
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                connectionTestResult = {
                    success: false,
                    message: `Midtrans API returned status ${response.status}: ${errorData.status_message || 'Unknown error'}. Settings were saved to .env file.`,
                };
            }
        } catch (error) {
            console.error('Error testing Midtrans connection:', error);
            connectionTestResult = {
                success: false,
                message: `Failed to test connection: ${error instanceof Error ? error.message : 'Unknown error'}. Settings were saved to .env file.`,
            };
        }

        res.json({
            success: true,
            message: 'Payment gateway settings updated successfully in .env file',
            data: {
                isProduction: validatedData.isProduction,
                webhookUrl: validatedData.webhookUrl,
                savedToEnv: envUpdateSuccess,
                connectionTest: connectionTestResult,
            },
        });
    } catch (error) {
        console.error('Error updating payment gateway settings:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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
                message: 'Failed to update payment gateway settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
});

// Email Configuration API

// Validation schema for email settings
const emailConfigSchema = z.object({
    smtpHost: z.string().min(1, 'SMTP host is required'),
    smtpPort: z.number().int().min(1).max(65535, 'SMTP port must be between 1 and 65535'),
    smtpUser: z.string().min(1, 'SMTP user is required'),
    smtpPassword: z.string().min(1, 'SMTP password is required'),
    smtpFrom: z.string().email('Invalid sender email address'),
    smtpSecure: z.boolean().optional().default(false),
});

// GET /api/admin/settings/email - Get email configuration
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "email" as a key
router.get('/admin/settings/email', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Fetch email settings from database
        const emailSettings = await adminStorage.getSystemSettings('email');

        // Build email configuration object
        const emailConfig: any = {
            smtpHost: '',
            smtpPort: 587,
            smtpUser: '',
            smtpFrom: '',
            smtpSecure: false,
        };

        for (const setting of emailSettings) {
            if (setting.key === 'email.smtp.host') {
                emailConfig.smtpHost = setting.value;
            } else if (setting.key === 'email.smtp.port') {
                emailConfig.smtpPort = parseInt(setting.value);
            } else if (setting.key === 'email.smtp.user') {
                emailConfig.smtpUser = setting.value;
            } else if (setting.key === 'email.smtp.password') {
                // Decrypt password before sending (but mask it)
                try {
                    const decryptedPassword = decryptData(setting.value);
                    emailConfig.smtpPassword = '********'; // Mask password
                    emailConfig.hasPassword = decryptedPassword.length > 0;
                } catch (error) {
                    emailConfig.smtpPassword = '';
                    emailConfig.hasPassword = false;
                }
            } else if (setting.key === 'email.smtp.from') {
                emailConfig.smtpFrom = setting.value;
            } else if (setting.key === 'email.smtp.secure') {
                emailConfig.smtpSecure = setting.value === 'true' || setting.value === true;
            }
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_EMAIL_SETTINGS',
            resourceType: 'EMAIL_SETTINGS',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: emailConfig,
        });
    } catch (error) {
        console.error('Error fetching email settings:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch email settings'
            }
        });
    }
});

// PUT /api/admin/settings/email - Update email configuration
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "email" as a key
router.put('/admin/settings/email', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate input
        const validatedData = emailConfigSchema.parse(req.body);

        // Encrypt password before storing
        const encryptedPassword = encryptData(validatedData.smtpPassword);

        // Get old settings for audit log
        const oldSettings = await adminStorage.getSystemSettings('email');
        const oldConfig: any = {};
        for (const setting of oldSettings) {
            if (setting.key === 'email.smtp.host') {
                oldConfig.smtpHost = setting.value;
            } else if (setting.key === 'email.smtp.port') {
                oldConfig.smtpPort = setting.value;
            } else if (setting.key === 'email.smtp.user') {
                oldConfig.smtpUser = setting.value;
            } else if (setting.key === 'email.smtp.from') {
                oldConfig.smtpFrom = setting.value;
            } else if (setting.key === 'email.smtp.secure') {
                oldConfig.smtpSecure = setting.value;
            }
        }

        // Update or create settings in database
        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.host',
            value: validatedData.smtpHost,
            dataType: 'string',
            description: 'SMTP Server Host',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.port',
            value: String(validatedData.smtpPort),
            dataType: 'number',
            description: 'SMTP Server Port',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.user',
            value: validatedData.smtpUser,
            dataType: 'string',
            description: 'SMTP Username',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.password',
            value: encryptedPassword,
            dataType: 'string',
            description: 'SMTP Password (encrypted)',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.from',
            value: validatedData.smtpFrom,
            dataType: 'string',
            description: 'Email Sender Address',
            updatedBy: req.admin.id,
        });

        await adminStorage.upsertSystemSetting({
            category: 'email',
            key: 'email.smtp.secure',
            value: String(validatedData.smtpSecure || false),
            dataType: 'boolean',
            description: 'Use SSL/TLS',
            updatedBy: req.admin.id,
        });

        // Log admin activity (don't log actual password)
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPDATE_EMAIL_SETTINGS',
            resourceType: 'EMAIL_SETTINGS',
            details: {
                smtpHost: validatedData.smtpHost,
                smtpPort: validatedData.smtpPort,
                smtpUser: validatedData.smtpUser,
                smtpFrom: validatedData.smtpFrom,
                smtpSecure: validatedData.smtpSecure,
                passwordUpdated: true,
                oldConfig,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            message: 'Email settings updated successfully',
            data: {
                smtpHost: validatedData.smtpHost,
                smtpPort: validatedData.smtpPort,
                smtpUser: validatedData.smtpUser,
                smtpFrom: validatedData.smtpFrom,
                smtpSecure: validatedData.smtpSecure,
            },
        });
    } catch (error) {
        console.error('Error updating email settings:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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
                message: 'Failed to update email settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
});

// POST /api/admin/settings/email/test - Test email configuration
// IMPORTANT: This route must come BEFORE /admin/settings/:key to avoid matching "email" as a key
router.post('/admin/settings/email/test', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate input
        const testEmailSchema = z.object({
            recipientEmail: z.string().email('Invalid recipient email address'),
        });

        const { recipientEmail } = testEmailSchema.parse(req.body);

        // Fetch email settings from database
        const emailSettings = await adminStorage.getSystemSettings('email');

        // Build email configuration
        let smtpHost = '';
        let smtpPort = 587;
        let smtpUser = '';
        let smtpPassword = '';
        let smtpFrom = '';
        let smtpSecure = false;

        for (const setting of emailSettings) {
            if (setting.key === 'email.smtp.host') {
                smtpHost = setting.value;
            } else if (setting.key === 'email.smtp.port') {
                smtpPort = parseInt(setting.value);
            } else if (setting.key === 'email.smtp.user') {
                smtpUser = setting.value;
            } else if (setting.key === 'email.smtp.password') {
                // Decrypt password
                try {
                    smtpPassword = decryptData(setting.value);
                } catch (error) {
                    console.error('Error decrypting SMTP password:', error);
                }
            } else if (setting.key === 'email.smtp.from') {
                smtpFrom = setting.value;
            } else if (setting.key === 'email.smtp.secure') {
                smtpSecure = setting.value === 'true' || setting.value === true;
            }
        }

        // Validate that all required settings are present
        if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Email settings are incomplete. Please configure SMTP settings first.'
                }
            });
        }

        // Import nodemailer dynamically
        const nodemailer = await import('nodemailer');

        // Create transporter
        const transporter = nodemailer.default.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPassword,
            },
        });

        // Verify connection
        await transporter.verify();

        // Send test email
        const info = await transporter.sendMail({
            from: smtpFrom,
            to: recipientEmail,
            subject: 'Test Email from Monly Admin Panel',
            text: 'This is a test email to verify your SMTP configuration is working correctly.',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Test Email</h2>
                    <p>This is a test email to verify your SMTP configuration is working correctly.</p>
                    <p>If you received this email, your email settings are configured properly.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                        Sent from Monly Admin Panel<br>
                        ${new Date().toLocaleString()}
                    </p>
                </div>
            `,
        });

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'TEST_EMAIL_SETTINGS',
            resourceType: 'EMAIL_SETTINGS',
            details: {
                recipientEmail,
                messageId: info.messageId,
                success: true,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            message: `Test email sent successfully to ${recipientEmail}`,
            data: {
                messageId: info.messageId,
                recipientEmail,
            },
        });
    } catch (error) {
        console.error('Error sending test email:', error);

        // Log failed test attempt
        if (req.admin) {
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'TEST_EMAIL_SETTINGS',
                resourceType: 'EMAIL_SETTINGS',
                details: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }

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

        // Handle specific SMTP errors
        let errorMessage = 'Failed to send test email';
        if (error instanceof Error) {
            if (error.message.includes('EAUTH')) {
                errorMessage = 'Authentication failed. Please check your SMTP username and password.';
            } else if (error.message.includes('ECONNREFUSED')) {
                errorMessage = 'Connection refused. Please check your SMTP host and port.';
            } else if (error.message.includes('ETIMEDOUT')) {
                errorMessage = 'Connection timed out. Please check your SMTP host and port.';
            } else if (error.message.includes('ENOTFOUND')) {
                errorMessage = 'SMTP host not found. Please check your SMTP host.';
            } else {
                errorMessage = error.message;
            }
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'EMAIL_TEST_FAILED',
                message: errorMessage,
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        });
    }
});

// PUT /api/admin/settings/:key - Update system setting by key
// IMPORTANT: This route must come AFTER specific routes like /admin/settings/features/:key and /admin/settings/payment
router.put('/admin/settings/:key', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        const settingKey = req.params.key;

        // Validate input
        const validatedData = updateSettingSchema.parse(req.body);

        // Get old setting value for audit log
        const oldSetting = await adminStorage.getSystemSettingByKey(settingKey);

        if (!oldSetting) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Setting not found'
                }
            });
        }

        // Update setting in database
        const updatedSetting = await adminStorage.updateSystemSetting(
            settingKey,
            validatedData.value,
            req.admin.id
        );

        // Log admin activity with old and new values
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'UPDATE_SETTING',
            resourceType: 'SYSTEM_SETTINGS',
            resourceId: settingKey,
            details: {
                key: settingKey,
                oldValue: oldSetting.value,
                newValue: validatedData.value,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: updatedSetting,
            message: 'Setting updated successfully',
        });
    } catch (error) {
        console.error('Error updating system setting:', error);

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

        if (error instanceof Error && error.message === 'Setting not found') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Setting not found'
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update system setting'
            }
        });
    }
});

// ============================================
// WhatsApp Bot Configuration Endpoints
// ============================================

// GET /api/admin/whatsapp/status - Get WhatsApp Bot connection status
router.get('/admin/whatsapp/status', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Import WhatsApp bot functions
        const { getSingleBotConnectionState } = await import('../whatsapp-single-bot');

        // Get current bot status
        const botState = getSingleBotConnectionState();

        // Prepare response based on bot status
        const response: {
            success: boolean;
            data: {
                connected: boolean;
                status: string;
                phoneNumber?: string;
                qrCode?: string;
                message?: string;
            };
        } = {
            success: true,
            data: {
                connected: botState.connected,
                status: botState.status,
            }
        };

        // If bot is connected, try to get phone number
        if (botState.connected && botState.status === 'ready') {
            try {
                // Import the bot connection to get phone number
                const { initializeSingleWhatsAppBot } = await import('../whatsapp-single-bot');
                const connection = initializeSingleWhatsAppBot();

                // Get phone number if available
                if (connection.client && connection.status === 'ready') {
                    const info = await connection.client.info;
                    if (info && info.wid && info.wid.user) {
                        response.data.phoneNumber = info.wid.user;
                    }
                }
            } catch (error) {
                console.error('Error getting phone number:', error);
                // Continue without phone number
            }

            response.data.message = 'WhatsApp Bot is connected and ready';
        }
        // If waiting for authentication, return QR code
        else if (botState.status === 'qr_received' && botState.qrCode) {
            response.data.qrCode = botState.qrCode;
            response.data.message = 'QR code available for scanning';
        }
        // If bot is disconnected or initializing
        else if (botState.status === 'disconnected') {
            response.data.message = 'WhatsApp Bot is disconnected';
        } else if (botState.status === 'initializing') {
            response.data.message = 'WhatsApp Bot is initializing...';
        } else if (botState.status === 'authenticated') {
            response.data.message = 'WhatsApp Bot is authenticated, loading...';
        } else {
            response.data.message = `WhatsApp Bot status: ${botState.status}`;
        }

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_WHATSAPP_STATUS',
            resourceType: 'WHATSAPP_BOT',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json(response);
    } catch (error) {
        console.error('Error getting WhatsApp Bot status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get WhatsApp Bot status'
            }
        });
    }
});

// POST /api/admin/whatsapp/connect - Initialize/Connect WhatsApp Bot
router.post('/admin/whatsapp/connect', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Import WhatsApp bot functions
        const {
            getSingleBotConnectionState,
            initializeSingleWhatsAppBot,
            reconnectSingleWhatsAppBot
        } = await import('../whatsapp-single-bot');

        // Check current status
        const currentStatus = getSingleBotConnectionState();
        console.log('📱 Current bot status:', currentStatus);

        // If bot is already connected (ready or authenticated), return success immediately
        if (currentStatus.connected && (currentStatus.status === 'ready' || currentStatus.status === 'authenticated')) {
            console.log('✅ Bot already connected, returning status');

            // Log admin activity
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'CONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: { result: 'already_connected', status: currentStatus.status },
                ipAddress: req.ip || req.socket.remoteAddress,
            });

            return res.json({
                success: true,
                data: {
                    status: currentStatus.status,
                    connected: true,
                    message: 'WhatsApp Bot is already connected and ready'
                }
            });
        }

        // If we have a QR code ready for scanning, return it
        if (currentStatus.status === 'qr_received' && currentStatus.qrCode) {
            console.log('📱 QR code available, returning it');

            // Log admin activity
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'CONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: { result: 'qr_code_available', status: currentStatus.status },
                ipAddress: req.ip || req.socket.remoteAddress,
            });

            return res.json({
                success: true,
                data: {
                    status: currentStatus.status,
                    connected: false,
                    qrCode: currentStatus.qrCode,
                    message: 'QR code available for scanning'
                }
            });
        }

        // Bot is disconnected or not initialized, try to start/reconnect
        if (currentStatus.status === 'disconnected') {
            console.log('🔄 Bot disconnected, attempting reconnection...');

            const result = await reconnectSingleWhatsAppBot();

            // Log admin activity
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'CONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'reconnection_attempted',
                    success: result.success,
                    status: result.status
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });

            // Return success for both authenticated and QR code scenarios
            if (result.success || result.qrCode) {
                console.log('✅ Reconnection result:', result);
                return res.json({
                    success: true,
                    data: {
                        status: result.status,
                        connected: result.status === 'ready' || result.status === 'authenticated',
                        qrCode: result.qrCode,
                        message: result.message
                    }
                });
            } else {
                // Even if reconnect "failed", try to generate new QR code
                console.log('🔄 Reconnect failed, attempting fresh initialization...');
                initializeSingleWhatsAppBot();

                // Wait for QR code generation
                await new Promise(resolve => setTimeout(resolve, 3000));

                const newStatus = getSingleBotConnectionState();
                console.log('📱 Fresh init result:', newStatus);

                // Log admin activity
                await adminStorage.logAdminActivity({
                    adminId: req.admin.id,
                    action: 'CONNECT_WHATSAPP_BOT',
                    resourceType: 'WHATSAPP_BOT',
                    details: {
                        result: 'fresh_initialization',
                        status: newStatus.status,
                        qrCodeGenerated: !!newStatus.qrCode
                    },
                    ipAddress: req.ip || req.socket.remoteAddress,
                });

                return res.json({
                    success: !!newStatus.qrCode,
                    data: {
                        status: newStatus.status,
                        connected: newStatus.connected,
                        qrCode: newStatus.qrCode,
                        message: newStatus.qrCode
                            ? 'New QR code generated after reconnection failure'
                            : 'Failed to generate QR code'
                    }
                });
            }
        } else {
            // Bot is in some other state (initializing, authenticating, etc.)
            console.log('🔄 Bot in transitional state, initializing...');
            initializeSingleWhatsAppBot();

            // Wait a bit and return status
            await new Promise(resolve => setTimeout(resolve, 2000));

            const newStatus = getSingleBotConnectionState();
            console.log('📱 Init result:', newStatus);

            // Log admin activity
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'CONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'initialization_started',
                    status: newStatus.status,
                    qrCodeGenerated: !!newStatus.qrCode
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });

            return res.json({
                success: !!newStatus.qrCode || (newStatus.status !== 'disconnected'),
                data: {
                    status: newStatus.status,
                    connected: newStatus.connected,
                    qrCode: newStatus.qrCode,
                    message: newStatus.status === 'qr_received'
                        ? 'QR code generated'
                        : 'Bot initialization started'
                }
            });
        }
    } catch (error) {
        console.error('Error connecting WhatsApp Bot:', error);

        // Log failed admin activity
        if (req.admin) {
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'CONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to connect WhatsApp Bot'
            }
        });
    }
});

// POST /api/admin/whatsapp/disconnect - Disconnect WhatsApp Bot
router.post('/admin/whatsapp/disconnect', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Import WhatsApp bot functions
        const {
            getSingleBotConnectionState,
            disconnectSingleWhatsAppBot
        } = await import('../whatsapp-single-bot');

        // Check current status
        const currentStatus = getSingleBotConnectionState();
        console.log('📱 Current bot status before disconnect:', currentStatus);

        // If bot is already disconnected, return success
        if (currentStatus.status === 'disconnected' || !currentStatus.connected) {
            console.log('✅ Bot already disconnected');

            // Log admin activity
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'DISCONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: { result: 'already_disconnected', status: currentStatus.status },
                ipAddress: req.ip || req.socket.remoteAddress,
            });

            return res.json({
                success: true,
                data: {
                    status: 'disconnected',
                    connected: false,
                    message: 'WhatsApp Bot is already disconnected'
                }
            });
        }

        // Disconnect the bot
        console.log('🔌 Disconnecting WhatsApp Bot...');
        const result = await disconnectSingleWhatsAppBot();

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'DISCONNECT_WHATSAPP_BOT',
            resourceType: 'WHATSAPP_BOT',
            details: {
                result: 'disconnection_attempted',
                success: result.success,
                previousStatus: currentStatus.status
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        if (result.success) {
            console.log('✅ Bot disconnected successfully');
            return res.json({
                success: true,
                data: {
                    status: 'disconnected',
                    connected: false,
                    message: result.message || 'WhatsApp Bot disconnected successfully'
                }
            });
        } else {
            console.error('❌ Failed to disconnect bot:', result.message);
            return res.status(500).json({
                success: false,
                error: {
                    code: 'DISCONNECT_FAILED',
                    message: result.message || 'Failed to disconnect WhatsApp Bot'
                }
            });
        }
    } catch (error) {
        console.error('Error disconnecting WhatsApp Bot:', error);

        // Log failed admin activity
        if (req.admin) {
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'DISCONNECT_WHATSAPP_BOT',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to disconnect WhatsApp Bot'
            }
        });
    }
});

// GET /api/admin/whatsapp/statistics - Get WhatsApp Bot statistics
router.get('/admin/whatsapp/statistics', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Get statistics from database
        const statistics = await adminStorage.getWhatsAppBotStatistics();

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'VIEW_WHATSAPP_STATISTICS',
            resourceType: 'WHATSAPP_BOT',
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        res.json({
            success: true,
            data: statistics,
        });
    } catch (error) {
        console.error('Error fetching WhatsApp Bot statistics:', error);

        // Log failed admin activity
        if (req.admin) {
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'VIEW_WHATSAPP_STATISTICS',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch WhatsApp Bot statistics'
            }
        });
    }
});

// POST /api/admin/whatsapp/test - Send test message via WhatsApp Bot
router.post('/admin/whatsapp/test', requireAdminAuth, async (req: AdminAuthRequest, res: Response) => {
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

        // Validate request body
        const testMessageSchema = z.object({
            phoneNumber: z.string().min(1, 'Phone number is required'),
            message: z.string().min(1, 'Message is required'),
        });

        const validatedData = testMessageSchema.parse(req.body);

        // Import WhatsApp bot functions
        const { sendSingleBotMessage, getSingleBotConnectionState } = await import('../whatsapp-single-bot');

        // Check if bot is connected
        const botState = getSingleBotConnectionState();
        if (!botState.connected) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'BOT_NOT_CONNECTED',
                    message: 'WhatsApp Bot is not connected. Please connect the bot first.'
                }
            });
        }

        // Format phone number (ensure it has country code)
        let formattedNumber = validatedData.phoneNumber.replace(/\D/g, ''); // Remove non-digits

        // If number doesn't start with country code, assume Indonesian number
        if (!formattedNumber.startsWith('62') && formattedNumber.startsWith('0')) {
            formattedNumber = '62' + formattedNumber.substring(1);
        }

        // Send test message
        const result = await sendSingleBotMessage(formattedNumber, validatedData.message);

        // Log admin activity
        await adminStorage.logAdminActivity({
            adminId: req.admin.id,
            action: 'SEND_TEST_MESSAGE',
            resourceType: 'WHATSAPP_BOT',
            details: {
                phoneNumber: formattedNumber,
                messageLength: validatedData.message.length,
                success: result.success
            },
            ipAddress: req.ip || req.socket.remoteAddress,
        });

        if (result.success) {
            res.json({
                success: true,
                message: 'Test message sent successfully',
                data: {
                    phoneNumber: formattedNumber,
                    deliveryStatus: 'sent'
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: {
                    code: 'MESSAGE_SEND_FAILED',
                    message: result.message || 'Failed to send test message'
                }
            });
        }
    } catch (error) {
        console.error('Error sending test message:', error);

        // Log failed admin activity
        if (req.admin) {
            await adminStorage.logAdminActivity({
                adminId: req.admin.id,
                action: 'SEND_TEST_MESSAGE',
                resourceType: 'WHATSAPP_BOT',
                details: {
                    result: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                ipAddress: req.ip || req.socket.remoteAddress,
            });
        }

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
                message: 'Failed to send test message'
            }
        });
    }
});

export default router;
