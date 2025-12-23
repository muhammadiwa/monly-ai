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

export default router;
