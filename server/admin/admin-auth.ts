import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'fallback-admin-secret';
const SALT_ROUNDS = 12; // Higher security for admin passwords

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'support';
}

export interface AdminAuthRequest extends Request {
    admin?: AdminUser;
}

// Hash password with higher cost factor for admin
export async function hashAdminPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyAdminPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token for admin
export function generateAdminToken(admin: AdminUser, rememberMe: boolean = false): string {
    return jwt.sign(
        {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            type: 'admin', // Distinguish admin tokens from user tokens
            rememberMe // Include rememberMe flag in token
        },
        ADMIN_JWT_SECRET,
        { expiresIn: rememberMe ? '7d' : '1h' } // 7 days if remember me, otherwise 1 hour
    );
}

// Verify JWT token
export function verifyAdminToken(token: string): AdminUser | null {
    try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;

        // Verify it's an admin token
        if (decoded.type !== 'admin') {
            return null;
        }

        return {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
        };
    } catch (error) {
        return null;
    }
}

// Admin authentication middleware
export function requireAdminAuth(req: AdminAuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Admin access token required'
            }
        });
    }

    const admin = verifyAdminToken(token);
    if (!admin) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Invalid or expired admin token'
            }
        });
    }

    req.admin = admin;
    next();
}

// Role-based authorization middleware
export function requireAdminRole(...allowedRoles: Array<'super_admin' | 'admin' | 'support'>) {
    return (req: AdminAuthRequest, res: Response, next: NextFunction) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin authentication required'
                }
            });
        }

        if (!allowedRoles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Insufficient permissions for this action'
                }
            });
        }

        next();
    };
}
