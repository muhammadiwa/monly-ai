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

export default router;
