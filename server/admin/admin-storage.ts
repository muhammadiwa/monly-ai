import { db } from "../db";
import { adminUsers, adminActivityLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AdminUserData {
    id: string;
    email: string;
    name: string;
    password: string;
    role: 'super_admin' | 'admin' | 'support';
    lastLogin?: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface CreateAdminData {
    id: string;
    email: string;
    name: string;
    password: string;
    role?: 'super_admin' | 'admin' | 'support';
}

export interface AdminActivityLogData {
    adminId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
}

export class AdminStorage {
    // Get admin by email
    async getAdminByEmail(email: string): Promise<AdminUserData | undefined> {
        const result = await db
            .select()
            .from(adminUsers)
            .where(eq(adminUsers.email, email))
            .limit(1);

        return result[0] as AdminUserData | undefined;
    }

    // Get admin by ID
    async getAdminById(id: string): Promise<AdminUserData | undefined> {
        const result = await db
            .select()
            .from(adminUsers)
            .where(eq(adminUsers.id, id))
            .limit(1);

        return result[0] as AdminUserData | undefined;
    }

    // Create admin user
    async createAdmin(data: CreateAdminData): Promise<AdminUserData> {
        const now = Math.floor(Date.now() / 1000);

        const adminData = {
            id: data.id,
            email: data.email,
            name: data.name,
            password: data.password,
            role: data.role || 'admin' as const,
            lastLogin: null,
            createdAt: now,
            updatedAt: now,
        };

        await db.insert(adminUsers).values(adminData);

        return adminData as AdminUserData;
    }

    // Update admin user
    async updateAdmin(id: string, updates: Partial<AdminUserData>): Promise<AdminUserData> {
        const now = Math.floor(Date.now() / 1000);

        await db
            .update(adminUsers)
            .set({
                ...updates,
                updatedAt: now,
            })
            .where(eq(adminUsers.id, id));

        const updated = await this.getAdminById(id);
        if (!updated) {
            throw new Error('Admin not found after update');
        }

        return updated;
    }

    // Update last login timestamp
    async updateLastLogin(id: string): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        await db
            .update(adminUsers)
            .set({
                lastLogin: now,
                updatedAt: now,
            })
            .where(eq(adminUsers.id, id));
    }

    // Log admin activity
    async logAdminActivity(data: AdminActivityLogData): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        await db.insert(adminActivityLogs).values({
            adminId: data.adminId,
            action: data.action,
            resourceType: data.resourceType,
            resourceId: data.resourceId || null,
            details: data.details ? JSON.stringify(data.details) : null,
            ipAddress: data.ipAddress || null,
            createdAt: now,
        });
    }
}

// Export singleton instance
export const adminStorage = new AdminStorage();
