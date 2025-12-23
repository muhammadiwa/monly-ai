import { db } from "../db";
import { adminUsers, adminActivityLogs, users, userSubscriptions, subscriptionPlans, payments, invoices, midtransWebhookLogs, transactions, budgets, goals } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";

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

    // Dashboard Metrics Functions

    // Get user metrics
    async getUserMetrics(): Promise<{
        total: number;
        active: number;
        newThisMonth: number;
        growthRate: number;
    }> {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthStartTimestamp = Math.floor(startOfMonth.getTime() / 1000);

        // Total users
        const totalUsersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
        const total = totalUsersResult[0]?.count || 0;

        // Active users (logged in within last 30 days)
        const activeUsersResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .where(sql`${users.updatedAt} >= ${thirtyDaysAgo}`);
        const active = activeUsersResult[0]?.count || 0;

        // New users this month
        const newUsersResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .where(sql`${users.createdAt} >= ${monthStartTimestamp}`);
        const newThisMonth = newUsersResult[0]?.count || 0;

        // Growth rate (compare last 30 days vs previous 30 days)
        const last30DaysResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .where(sql`${users.createdAt} >= ${thirtyDaysAgo}`);
        const last30Days = last30DaysResult[0]?.count || 0;

        const previous30DaysResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(users)
            .where(sql`${users.createdAt} >= ${sixtyDaysAgo} AND ${users.createdAt} < ${thirtyDaysAgo}`);
        const previous30Days = previous30DaysResult[0]?.count || 0;

        const growthRate = previous30Days > 0
            ? ((last30Days - previous30Days) / previous30Days) * 100
            : 0;

        return {
            total,
            active,
            newThisMonth,
            growthRate: Math.round(growthRate * 100) / 100, // Round to 2 decimal places
        };
    }

    // Get subscription metrics
    async getSubscriptionMetrics(): Promise<{
        total: number;
        byPlan: Record<string, number>;
        churnRate: number;
        conversionRate: number;
    }> {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

        // Total active subscriptions
        const totalResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.status, 'active'));
        const total = totalResult[0]?.count || 0;

        // Subscriptions by plan
        const byPlanResult = await db
            .select({
                planName: subscriptionPlans.name,
                count: sql<number>`COUNT(*)`,
            })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(userSubscriptions.status, 'active'))
            .groupBy(subscriptionPlans.name);

        const byPlan: Record<string, number> = {};
        byPlanResult.forEach(row => {
            byPlan[row.planName] = row.count;
        });

        // Churn rate (cancelled in last 30 days / total active at start of period)
        const cancelledLast30DaysResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(sql`${userSubscriptions.cancelledAt} >= ${thirtyDaysAgo}`);
        const cancelledLast30Days = cancelledLast30DaysResult[0]?.count || 0;

        const churnRate = total > 0 ? (cancelledLast30Days / (total + cancelledLast30Days)) * 100 : 0;

        // Conversion rate (paid subscriptions / total users)
        const totalUsersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
        const totalUsers = totalUsersResult[0]?.count || 0;

        const paidSubscriptionsResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(sql`${userSubscriptions.status} = 'active' AND ${subscriptionPlans.name} != 'free'`);
        const paidSubscriptions = paidSubscriptionsResult[0]?.count || 0;

        const conversionRate = totalUsers > 0 ? (paidSubscriptions / totalUsers) * 100 : 0;

        return {
            total,
            byPlan,
            churnRate: Math.round(churnRate * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
        };
    }

    // Get revenue metrics
    async getRevenueMetrics(): Promise<{
        mrr: number;
        totalRevenue: number;
        revenueGrowth: number;
        revenueByPlan: Record<string, number>;
    }> {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60);

        // Calculate MRR from active subscriptions
        const activeSubscriptionsResult = await db
            .select({
                billingCycle: userSubscriptions.billingCycle,
                priceMonthly: subscriptionPlans.priceMonthly,
                priceYearly: subscriptionPlans.priceYearly,
            })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(userSubscriptions.status, 'active'));

        let mrr = 0;
        activeSubscriptionsResult.forEach(sub => {
            if (sub.billingCycle === 'monthly') {
                mrr += sub.priceMonthly;
            } else if (sub.billingCycle === 'yearly') {
                mrr += sub.priceYearly / 12; // Normalize yearly to monthly
            }
        });

        // Total revenue from paid payments
        const totalRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(eq(payments.status, 'paid'));
        const totalRevenue = totalRevenueResult[0]?.total || 0;

        // Revenue growth (last 30 days vs previous 30 days)
        const last30DaysRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(sql`${payments.status} = 'paid' AND ${payments.paidAt} >= ${thirtyDaysAgo}`);
        const last30DaysRevenue = last30DaysRevenueResult[0]?.total || 0;

        const previous30DaysRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(sql`${payments.status} = 'paid' AND ${payments.paidAt} >= ${sixtyDaysAgo} AND ${payments.paidAt} < ${thirtyDaysAgo}`);
        const previous30DaysRevenue = previous30DaysRevenueResult[0]?.total || 0;

        const revenueGrowth = previous30DaysRevenue > 0
            ? ((last30DaysRevenue - previous30DaysRevenue) / previous30DaysRevenue) * 100
            : 0;

        // Revenue by plan
        const revenueByPlanResult = await db
            .select({
                planName: subscriptionPlans.name,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .innerJoin(userSubscriptions, eq(payments.subscriptionId, userSubscriptions.id))
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(payments.status, 'paid'))
            .groupBy(subscriptionPlans.name);

        const revenueByPlan: Record<string, number> = {};
        revenueByPlanResult.forEach(row => {
            revenueByPlan[row.planName] = row.total;
        });

        return {
            mrr: Math.round(mrr * 100) / 100,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            revenueByPlan,
        };
    }

    // Get system health metrics
    async getSystemHealthMetrics(): Promise<{
        databaseSize: number;
        apiResponseTime: number;
        errorRate: number;
        uptime: number;
    }> {
        // Database size (in MB)
        const dbSizeResult = await db.select({
            pageCount: sql<number>`(SELECT page_count FROM pragma_page_count())`,
            pageSize: sql<number>`(SELECT page_size FROM pragma_page_size())`,
        }).from(users).limit(1);

        const pageCount = dbSizeResult[0]?.pageCount || 0;
        const pageSize = dbSizeResult[0]?.pageSize || 0;
        const databaseSize = (pageCount * pageSize) / (1024 * 1024); // Convert to MB

        // API response time (simple query timing)
        const startTime = Date.now();
        await db.select().from(users).limit(1);
        const apiResponseTime = Date.now() - startTime;

        // Error rate (placeholder - would need proper error tracking)
        const errorRate = 0;

        // Uptime (placeholder - would need process uptime tracking)
        const uptime = process.uptime();

        return {
            databaseSize: Math.round(databaseSize * 100) / 100,
            apiResponseTime,
            errorRate,
            uptime: Math.round(uptime),
        };
    }

    // Get recent activity
    async getRecentActivity(): Promise<{
        newUsers: any[];
        newSubscriptions: any[];
        recentPayments: any[];
    }> {
        // Recent users (last 10)
        // Use COALESCE to handle null createdAt by falling back to updatedAt or current time
        const newUsers = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
                createdAt: sql<number>`COALESCE(${users.createdAt}, ${users.updatedAt}, ${Math.floor(Date.now() / 1000)})`.as('createdAt'),
            })
            .from(users)
            .orderBy(sql`COALESCE(${users.createdAt}, ${users.updatedAt}, 0) DESC`)
            .limit(10);

        // Recent subscriptions (last 10)
        const newSubscriptions = await db
            .select({
                id: userSubscriptions.id,
                userId: userSubscriptions.userId,
                planId: userSubscriptions.planId,
                status: userSubscriptions.status,
                billingCycle: userSubscriptions.billingCycle,
                createdAt: userSubscriptions.createdAt,
                userEmail: users.email,
                userFirstName: users.firstName,
                userLastName: users.lastName,
                planName: subscriptionPlans.name,
                planDisplayName: subscriptionPlans.displayName,
            })
            .from(userSubscriptions)
            .innerJoin(users, eq(userSubscriptions.userId, users.id))
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .orderBy(desc(userSubscriptions.createdAt))
            .limit(10);

        // Recent payments (last 10)
        const recentPayments = await db
            .select({
                id: payments.id,
                userId: payments.userId,
                amount: payments.amount,
                currency: payments.currency,
                status: payments.status,
                paymentMethod: payments.paymentMethod,
                paidAt: payments.paidAt,
                createdAt: payments.createdAt,
                userEmail: users.email,
                userFirstName: users.firstName,
                userLastName: users.lastName,
            })
            .from(payments)
            .innerJoin(users, eq(payments.userId, users.id))
            .orderBy(desc(payments.createdAt))
            .limit(10);

        return {
            newUsers,
            newSubscriptions,
            recentPayments,
        };
    }

    // Get chart data for revenue trends
    async getRevenueChartData(period: 'week' | 'month' | 'year'): Promise<{
        labels: string[];
        data: number[];
    }> {
        const now = Math.floor(Date.now() / 1000);
        let startTime: number;
        let groupByFormat: string;
        let intervals: number;

        // Determine time range and grouping based on period
        if (period === 'week') {
            startTime = now - (7 * 24 * 60 * 60); // 7 days ago
            groupByFormat = '%Y-%m-%d'; // Group by day
            intervals = 7;
        } else if (period === 'month') {
            startTime = now - (30 * 24 * 60 * 60); // 30 days ago
            groupByFormat = '%Y-%m-%d'; // Group by day
            intervals = 30;
        } else {
            // year
            startTime = now - (365 * 24 * 60 * 60); // 365 days ago
            groupByFormat = '%Y-%m'; // Group by month
            intervals = 12;
        }

        // Query revenue grouped by time period
        const revenueData = await db
            .select({
                period: sql<string>`strftime(${groupByFormat}, datetime(${payments.paidAt}, 'unixepoch'))`,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(sql`${payments.status} = 'paid' AND ${payments.paidAt} >= ${startTime}`)
            .groupBy(sql`strftime(${groupByFormat}, datetime(${payments.paidAt}, 'unixepoch'))`)
            .orderBy(sql`strftime(${groupByFormat}, datetime(${payments.paidAt}, 'unixepoch'))`);

        // Create a map of period -> revenue
        const revenueMap = new Map<string, number>();
        revenueData.forEach(row => {
            if (row.period) {
                revenueMap.set(row.period, row.total);
            }
        });

        // Generate labels and data arrays with all periods (fill missing with 0)
        const labels: string[] = [];
        const data: number[] = [];

        if (period === 'year') {
            // Generate last 12 months
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const label = date.toISOString().slice(0, 7); // YYYY-MM format
                labels.push(label);
                data.push(revenueMap.get(label) || 0);
            }
        } else {
            // Generate days for week or month
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const label = date.toISOString().slice(0, 10); // YYYY-MM-DD format
                labels.push(label);
                data.push(revenueMap.get(label) || 0);
            }
        }

        return { labels, data };
    }

    // Get chart data for user growth
    async getUserGrowthChartData(period: 'week' | 'month' | 'year'): Promise<{
        labels: string[];
        data: number[];
    }> {
        const now = Math.floor(Date.now() / 1000);
        let startTime: number;
        let groupByFormat: string;
        let intervals: number;

        // Determine time range and grouping based on period
        if (period === 'week') {
            startTime = now - (7 * 24 * 60 * 60);
            groupByFormat = '%Y-%m-%d';
            intervals = 7;
        } else if (period === 'month') {
            startTime = now - (30 * 24 * 60 * 60);
            groupByFormat = '%Y-%m-%d';
            intervals = 30;
        } else {
            // year
            startTime = now - (365 * 24 * 60 * 60);
            groupByFormat = '%Y-%m';
            intervals = 12;
        }

        // Query new users grouped by time period
        const userData = await db
            .select({
                period: sql<string>`strftime(${groupByFormat}, datetime(COALESCE(${users.createdAt}, ${users.updatedAt}), 'unixepoch'))`,
                count: sql<number>`COUNT(*)`,
            })
            .from(users)
            .where(sql`COALESCE(${users.createdAt}, ${users.updatedAt}) >= ${startTime}`)
            .groupBy(sql`strftime(${groupByFormat}, datetime(COALESCE(${users.createdAt}, ${users.updatedAt}), 'unixepoch'))`)
            .orderBy(sql`strftime(${groupByFormat}, datetime(COALESCE(${users.createdAt}, ${users.updatedAt}), 'unixepoch'))`);

        // Create a map of period -> user count
        const userMap = new Map<string, number>();
        userData.forEach(row => {
            if (row.period) {
                userMap.set(row.period, row.count);
            }
        });

        // Generate labels and data arrays with all periods (fill missing with 0)
        const labels: string[] = [];
        const data: number[] = [];

        if (period === 'year') {
            // Generate last 12 months
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const label = date.toISOString().slice(0, 7);
                labels.push(label);
                data.push(userMap.get(label) || 0);
            }
        } else {
            // Generate days for week or month
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const label = date.toISOString().slice(0, 10);
                labels.push(label);
                data.push(userMap.get(label) || 0);
            }
        }

        return { labels, data };
    }

    // Get chart data for subscription trends
    async getSubscriptionTrendChartData(period: 'week' | 'month' | 'year'): Promise<{
        labels: string[];
        data: number[];
    }> {
        const now = Math.floor(Date.now() / 1000);
        let startTime: number;
        let groupByFormat: string;
        let intervals: number;

        // Determine time range and grouping based on period
        if (period === 'week') {
            startTime = now - (7 * 24 * 60 * 60);
            groupByFormat = '%Y-%m-%d';
            intervals = 7;
        } else if (period === 'month') {
            startTime = now - (30 * 24 * 60 * 60);
            groupByFormat = '%Y-%m-%d';
            intervals = 30;
        } else {
            // year
            startTime = now - (365 * 24 * 60 * 60);
            groupByFormat = '%Y-%m';
            intervals = 12;
        }

        // Query new subscriptions grouped by time period
        const subscriptionData = await db
            .select({
                period: sql<string>`strftime(${groupByFormat}, datetime(${userSubscriptions.createdAt}, 'unixepoch'))`,
                count: sql<number>`COUNT(*)`,
            })
            .from(userSubscriptions)
            .where(sql`${userSubscriptions.createdAt} >= ${startTime}`)
            .groupBy(sql`strftime(${groupByFormat}, datetime(${userSubscriptions.createdAt}, 'unixepoch'))`)
            .orderBy(sql`strftime(${groupByFormat}, datetime(${userSubscriptions.createdAt}, 'unixepoch'))`);

        // Create a map of period -> subscription count
        const subscriptionMap = new Map<string, number>();
        subscriptionData.forEach(row => {
            if (row.period) {
                subscriptionMap.set(row.period, row.count);
            }
        });

        // Generate labels and data arrays with all periods (fill missing with 0)
        const labels: string[] = [];
        const data: number[] = [];

        if (period === 'year') {
            // Generate last 12 months
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const label = date.toISOString().slice(0, 7);
                labels.push(label);
                data.push(subscriptionMap.get(label) || 0);
            }
        } else {
            // Generate days for week or month
            for (let i = intervals - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const label = date.toISOString().slice(0, 10);
                labels.push(label);
                data.push(subscriptionMap.get(label) || 0);
            }
        }

        return { labels, data };
    }

    // Get user list with pagination, search, and filtering
    async getUserList(params: {
        page?: number;
        limit?: number;
        search?: string;
        plan?: string;
        status?: string;
    }): Promise<{
        users: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions: any[] = [];

        // Search by name, email, or user ID
        if (params.search) {
            const searchTerm = `%${params.search}%`;
            conditions.push(
                sql`(
                    ${users.email} LIKE ${searchTerm} OR
                    ${users.firstName} LIKE ${searchTerm} OR
                    ${users.lastName} LIKE ${searchTerm} OR
                    ${users.id} LIKE ${searchTerm}
                )`
            );
        }

        // Filter by subscription status
        if (params.status) {
            conditions.push(eq(users.subscriptionStatus, params.status));
        }

        // Build WHERE clause
        const whereClause = conditions.length > 0
            ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
            : sql``;

        // Get total count using raw SQL
        const countQuery = sql`
            SELECT COUNT(*) as count
            FROM ${users}
            ${params.plan ? sql`LEFT JOIN ${subscriptionPlans} ON ${users.subscriptionPlanId} = ${subscriptionPlans.id}` : sql``}
            ${whereClause}
            ${params.plan ? sql`AND ${subscriptionPlans.name} = ${params.plan}` : sql``}
        `;
        const countResult = await db.all(countQuery);
        const total = (countResult[0] as any)?.count || 0;

        // Build main query with joins
        let mainQuery;

        if (params.plan) {
            // Filter by subscription plan name
            mainQuery = sql`
                SELECT 
                    ${users.id},
                    ${users.email},
                    ${users.firstName},
                    ${users.lastName},
                    ${users.subscriptionStatus},
                    ${users.createdAt},
                    ${users.updatedAt},
                    ${subscriptionPlans.name} as subscriptionPlan,
                    ${subscriptionPlans.displayName} as subscriptionPlanDisplay,
                    (SELECT COUNT(*) FROM ${transactions} WHERE ${transactions.userId} = ${users.id}) as transactionCount
                FROM ${users}
                LEFT JOIN ${subscriptionPlans} ON ${users.subscriptionPlanId} = ${subscriptionPlans.id}
                ${whereClause}
                ${params.plan ? sql`AND ${subscriptionPlans.name} = ${params.plan}` : sql``}
                ORDER BY ${users.createdAt} DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            mainQuery = sql`
                SELECT 
                    ${users.id},
                    ${users.email},
                    ${users.firstName},
                    ${users.lastName},
                    ${users.subscriptionStatus},
                    ${users.createdAt},
                    ${users.updatedAt},
                    ${subscriptionPlans.name} as subscriptionPlan,
                    ${subscriptionPlans.displayName} as subscriptionPlanDisplay,
                    (SELECT COUNT(*) FROM ${transactions} WHERE ${transactions.userId} = ${users.id}) as transactionCount
                FROM ${users}
                LEFT JOIN ${subscriptionPlans} ON ${users.subscriptionPlanId} = ${subscriptionPlans.id}
                ${whereClause}
                ORDER BY ${users.createdAt} DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

        const result = await db.all(mainQuery);
        const userList = result.map((row: any) => ({
            id: row.id,
            name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'N/A',
            email: row.email || 'N/A',
            subscriptionPlan: row.subscriptionPlan || 'free',
            subscriptionPlanDisplay: row.subscriptionPlanDisplay || 'Free',
            status: row.subscriptionStatus || 'free',
            registrationDate: row.createdAt,
            lastLogin: row.updatedAt,
            transactionCount: row.transactionCount || 0,
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            users: userList,
            total,
            page,
            totalPages,
        };
    }

    // Get revenue analytics
    async getRevenueAnalytics(): Promise<{
        mrr: number;
        arr: number;
        totalRevenue: number;
        revenueGrowth: number;
        revenueByPlan: Record<string, number>;
        revenueByMethod: Record<string, number>;
    }> {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60);

        // Calculate MRR from active subscriptions
        const activeSubscriptionsResult = await db
            .select({
                billingCycle: userSubscriptions.billingCycle,
                priceMonthly: subscriptionPlans.priceMonthly,
                priceYearly: subscriptionPlans.priceYearly,
            })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(userSubscriptions.status, 'active'));

        let mrr = 0;
        activeSubscriptionsResult.forEach(sub => {
            if (sub.billingCycle === 'monthly') {
                mrr += sub.priceMonthly;
            } else if (sub.billingCycle === 'yearly') {
                mrr += sub.priceYearly / 12; // Normalize yearly to monthly
            }
        });

        // Calculate ARR (Annual Recurring Revenue)
        const arr = mrr * 12;

        // Total revenue from paid payments
        const totalRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(eq(payments.status, 'paid'));
        const totalRevenue = totalRevenueResult[0]?.total || 0;

        // Revenue growth (last 30 days vs previous 30 days)
        const last30DaysRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(sql`${payments.status} = 'paid' AND ${payments.paidAt} >= ${thirtyDaysAgo}`);
        const last30DaysRevenue = last30DaysRevenueResult[0]?.total || 0;

        const previous30DaysRevenueResult = await db
            .select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(sql`${payments.status} = 'paid' AND ${payments.paidAt} >= ${sixtyDaysAgo} AND ${payments.paidAt} < ${thirtyDaysAgo}`);
        const previous30DaysRevenue = previous30DaysRevenueResult[0]?.total || 0;

        const revenueGrowth = previous30DaysRevenue > 0
            ? ((last30DaysRevenue - previous30DaysRevenue) / previous30DaysRevenue) * 100
            : 0;

        // Revenue breakdown by plan
        const revenueByPlanResult = await db
            .select({
                planName: subscriptionPlans.name,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .innerJoin(userSubscriptions, eq(payments.subscriptionId, userSubscriptions.id))
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(payments.status, 'paid'))
            .groupBy(subscriptionPlans.name);

        const revenueByPlan: Record<string, number> = {};
        revenueByPlanResult.forEach(row => {
            revenueByPlan[row.planName] = row.total;
        });

        // Revenue breakdown by payment method
        const revenueByMethodResult = await db
            .select({
                paymentMethod: payments.paymentMethod,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments)
            .where(eq(payments.status, 'paid'))
            .groupBy(payments.paymentMethod);

        const revenueByMethod: Record<string, number> = {};
        revenueByMethodResult.forEach(row => {
            revenueByMethod[row.paymentMethod] = row.total;
        });

        return {
            mrr: Math.round(mrr * 100) / 100,
            arr: Math.round(arr * 100) / 100,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            revenueGrowth: Math.round(revenueGrowth * 100) / 100,
            revenueByPlan,
            revenueByMethod,
        };
    }

    // Get user details by ID
    async getUserDetails(userId: string): Promise<any> {
        // Fetch user profile
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

        if (!user) {
            return null;
        }

        // Fetch user subscription details
        const subscriptionResult = await db
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
            })
            .from(userSubscriptions)
            .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(userSubscriptions.userId, userId))
            .orderBy(desc(userSubscriptions.createdAt))
            .limit(1);

        const subscription = subscriptionResult[0] || null;

        // Fetch usage statistics
        const transactionCountResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(transactions)
            .where(eq(transactions.userId, userId));
        const transactionCount = transactionCountResult[0]?.count || 0;

        const budgetCountResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(budgets)
            .where(eq(budgets.userId, userId));
        const budgetCount = budgetCountResult[0]?.count || 0;

        const goalCountResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(goals)
            .where(eq(goals.userId, userId));
        const goalCount = goalCountResult[0]?.count || 0;

        // Fetch login history (using updatedAt as proxy for last login)
        // In a real system, you'd have a separate login_history table
        const loginHistory = [
            {
                timestamp: user.updatedAt,
                ipAddress: 'N/A',
                device: 'N/A',
            }
        ];

        return {
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
            email: user.email || 'N/A',
            subscriptionPlan: subscription?.planName || 'free',
            subscriptionPlanDisplay: subscription?.planDisplayName || 'Free',
            status: user.subscriptionStatus || 'free',
            registrationDate: user.createdAt,
            lastLogin: user.updatedAt,
            profile: {
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: null, // Not in current schema
                profileImageUrl: user.profileImageUrl,
            },
            subscription: subscription ? {
                plan: subscription.planName,
                planDisplay: subscription.planDisplayName,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                status: subscription.status,
                autoRenew: Boolean(subscription.autoRenew),
                billingCycle: subscription.billingCycle,
                price: subscription.billingCycle === 'monthly'
                    ? subscription.priceMonthly
                    : subscription.priceYearly,
            } : null,
            usage: {
                transactionCount,
                budgetCount,
                goalCount,
                accountCount: 0, // Not tracked in current schema
            },
            activity: {
                loginHistory,
                lastActive: user.updatedAt,
            },
        };
    }

    // Suspend user account
    async suspendUser(userId: string, reason: string): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        // Update user status to suspended
        await db
            .update(users)
            .set({
                subscriptionStatus: 'suspended',
                updatedAt: now,
            })
            .where(eq(users.id, userId));

        // Cancel all active subscriptions
        await db
            .update(userSubscriptions)
            .set({
                status: 'cancelled',
                cancelledAt: now,
                cancellationReason: `Account suspended: ${reason}`,
                updatedAt: now,
            })
            .where(sql`${userSubscriptions.userId} = ${userId} AND ${userSubscriptions.status} = 'active'`);
    }

    // Activate user account
    async activateUser(userId: string): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        // Update user status to active (or free if no subscription)
        await db
            .update(users)
            .set({
                subscriptionStatus: 'active',
                updatedAt: now,
            })
            .where(eq(users.id, userId));
    }

    // Soft delete user account
    async deleteUser(userId: string, reason: string): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        // Update user status to deleted and anonymize personal data
        await db
            .update(users)
            .set({
                subscriptionStatus: 'deleted',
                email: `deleted_${userId}@deleted.local`,
                firstName: 'Deleted',
                lastName: 'User',
                profileImageUrl: null,
                updatedAt: now,
            })
            .where(eq(users.id, userId));

        // Cancel all active subscriptions
        await db
            .update(userSubscriptions)
            .set({
                status: 'cancelled',
                cancelledAt: now,
                cancellationReason: `Account deleted: ${reason}`,
                updatedAt: now,
            })
            .where(sql`${userSubscriptions.userId} = ${userId} AND ${userSubscriptions.status} = 'active'`);

        // Note: Transaction data is preserved for compliance
        // WhatsApp integrations and other data remain for audit purposes
    }

    // Get user data for export with filtering and date range
    async getUserDataForExport(params: {
        search?: string;
        plan?: string;
        status?: string;
        dateFrom?: number;
        dateTo?: number;
    }): Promise<any[]> {
        // Build WHERE conditions
        const conditions: any[] = [];

        // Search by name, email, or user ID
        if (params.search) {
            const searchTerm = `%${params.search}%`;
            conditions.push(
                sql`(
                    ${users.email} LIKE ${searchTerm} OR
                    ${users.firstName} LIKE ${searchTerm} OR
                    ${users.lastName} LIKE ${searchTerm} OR
                    ${users.id} LIKE ${searchTerm}
                )`
            );
        }

        // Filter by subscription status
        if (params.status) {
            conditions.push(eq(users.subscriptionStatus, params.status));
        }

        // Filter by date range (registration date)
        if (params.dateFrom) {
            conditions.push(sql`${users.createdAt} >= ${params.dateFrom}`);
        }

        if (params.dateTo) {
            conditions.push(sql`${users.createdAt} <= ${params.dateTo}`);
        }

        // Build WHERE clause
        const whereClause = conditions.length > 0
            ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
            : sql``;

        // Build main query with joins
        let mainQuery;

        if (params.plan) {
            // Filter by subscription plan name
            mainQuery = sql`
                SELECT 
                    ${users.id},
                    ${users.email},
                    ${users.firstName},
                    ${users.lastName},
                    ${users.subscriptionStatus},
                    ${users.createdAt},
                    ${users.updatedAt},
                    ${subscriptionPlans.name} as subscriptionPlan,
                    ${subscriptionPlans.displayName} as subscriptionPlanDisplay,
                    (SELECT COUNT(*) FROM ${transactions} WHERE ${transactions.userId} = ${users.id}) as transactionCount,
                    (SELECT COUNT(*) FROM ${budgets} WHERE ${budgets.userId} = ${users.id}) as budgetCount,
                    (SELECT COUNT(*) FROM ${goals} WHERE ${goals.userId} = ${users.id}) as goalCount
                FROM ${users}
                LEFT JOIN ${subscriptionPlans} ON ${users.subscriptionPlanId} = ${subscriptionPlans.id}
                ${whereClause}
                ${params.plan ? sql`AND ${subscriptionPlans.name} = ${params.plan}` : sql``}
                ORDER BY ${users.createdAt} DESC
            `;
        } else {
            mainQuery = sql`
                SELECT 
                    ${users.id},
                    ${users.email},
                    ${users.firstName},
                    ${users.lastName},
                    ${users.subscriptionStatus},
                    ${users.createdAt},
                    ${users.updatedAt},
                    ${subscriptionPlans.name} as subscriptionPlan,
                    ${subscriptionPlans.displayName} as subscriptionPlanDisplay,
                    (SELECT COUNT(*) FROM ${transactions} WHERE ${transactions.userId} = ${users.id}) as transactionCount,
                    (SELECT COUNT(*) FROM ${budgets} WHERE ${budgets.userId} = ${users.id}) as budgetCount,
                    (SELECT COUNT(*) FROM ${goals} WHERE ${goals.userId} = ${users.id}) as goalCount
                FROM ${users}
                LEFT JOIN ${subscriptionPlans} ON ${users.subscriptionPlanId} = ${subscriptionPlans.id}
                ${whereClause}
                ORDER BY ${users.createdAt} DESC
            `;
        }

        const result = await db.all(mainQuery);

        return result.map((row: any) => ({
            id: row.id,
            email: row.email || 'N/A',
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            fullName: `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'N/A',
            subscriptionPlan: row.subscriptionPlan || 'free',
            subscriptionPlanDisplay: row.subscriptionPlanDisplay || 'Free',
            status: row.subscriptionStatus || 'free',
            registrationDate: row.createdAt,
            lastLogin: row.updatedAt,
            transactionCount: row.transactionCount || 0,
            budgetCount: row.budgetCount || 0,
            goalCount: row.goalCount || 0,
        }));
    }

    // Get user activity analytics
    async getUserActivity(userId: string): Promise<{
        loginHistory: Array<{
            timestamp: number;
            ipAddress: string;
            device: string;
        }>;
        engagementMetrics: {
            dau: boolean; // Daily Active User (active in last 24 hours)
            wau: boolean; // Weekly Active User (active in last 7 days)
            mau: boolean; // Monthly Active User (active in last 30 days)
            lastActiveDate: number;
            totalDaysActive: number;
        };
        retentionMetrics: {
            daysSinceRegistration: number;
            daysSinceLastActive: number;
            isRetained: boolean; // Active in last 30 days
            activityRate: number; // Percentage of days active since registration
        };
    }> {
        const now = Math.floor(Date.now() / 1000);
        const oneDayAgo = now - (24 * 60 * 60);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

        // Fetch user data
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

        if (!user) {
            throw new Error('User not found');
        }

        // Login history - using updatedAt as proxy for activity
        // In a real system, you'd have a separate login_history or user_activity_logs table
        const loginHistory = [
            {
                timestamp: user.updatedAt || user.createdAt || now,
                ipAddress: 'N/A', // Would come from login_history table
                device: 'N/A', // Would come from login_history table
            }
        ];

        // Calculate engagement metrics
        const lastActiveDate = user.updatedAt || user.createdAt || now;
        const dau = lastActiveDate >= oneDayAgo;
        const wau = lastActiveDate >= sevenDaysAgo;
        const mau = lastActiveDate >= thirtyDaysAgo;

        // Count total days with activity (transactions created)
        // This gives us a proxy for how many days the user has been active
        const activityDaysResult = await db
            .select({
                count: sql<number>`COUNT(DISTINCT DATE(datetime(${transactions.createdAt}, 'unixepoch')))`,
            })
            .from(transactions)
            .where(eq(transactions.userId, userId));
        const totalDaysActive = activityDaysResult[0]?.count || 0;

        // Calculate retention metrics
        const registrationDate = user.createdAt || now;
        const daysSinceRegistration = Math.floor((now - registrationDate) / (24 * 60 * 60));
        const daysSinceLastActive = Math.floor((now - lastActiveDate) / (24 * 60 * 60));
        const isRetained = mau; // User is retained if they're a MAU

        // Activity rate: percentage of days active since registration
        const activityRate = daysSinceRegistration > 0
            ? (totalDaysActive / daysSinceRegistration) * 100
            : 0;

        return {
            loginHistory,
            engagementMetrics: {
                dau,
                wau,
                mau,
                lastActiveDate,
                totalDaysActive,
            },
            retentionMetrics: {
                daysSinceRegistration,
                daysSinceLastActive,
                isRetained,
                activityRate: Math.round(activityRate * 100) / 100,
            },
        };
    }

    // Subscription Plans CRUD Operations

    // Get all subscription plans
    async getAllPlans(): Promise<any[]> {
        const plans = await db
            .select()
            .from(subscriptionPlans)
            .orderBy(subscriptionPlans.priceMonthly);

        return plans.map(plan => ({
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            price: {
                monthly: plan.priceMonthly,
                yearly: plan.priceYearly,
            },
            currency: plan.currency,
            features: JSON.parse(plan.features),
            limits: JSON.parse(plan.limits),
            isActive: Boolean(plan.isActive),
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
        }));
    }

    // Get subscription plan by ID
    async getPlanById(planId: number): Promise<any | null> {
        const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId));

        if (!plan) {
            return null;
        }

        return {
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            price: {
                monthly: plan.priceMonthly,
                yearly: plan.priceYearly,
            },
            currency: plan.currency,
            features: JSON.parse(plan.features),
            limits: JSON.parse(plan.limits),
            isActive: Boolean(plan.isActive),
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
        };
    }

    // Create subscription plan
    async createPlan(data: {
        name: string;
        displayName: string;
        description?: string;
        priceMonthly: number;
        priceYearly: number;
        currency: string;
        features: any[];
        limits: any;
        isActive?: boolean;
    }): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        const planData = {
            name: data.name,
            displayName: data.displayName,
            description: data.description || null,
            priceMonthly: data.priceMonthly,
            priceYearly: data.priceYearly,
            currency: data.currency,
            features: JSON.stringify(data.features),
            limits: JSON.stringify(data.limits),
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.insert(subscriptionPlans).values(planData).returning();

        const createdPlan = result[0];

        return {
            id: createdPlan.id,
            name: createdPlan.name,
            displayName: createdPlan.displayName,
            description: createdPlan.description,
            price: {
                monthly: createdPlan.priceMonthly,
                yearly: createdPlan.priceYearly,
            },
            currency: createdPlan.currency,
            features: JSON.parse(createdPlan.features),
            limits: JSON.parse(createdPlan.limits),
            isActive: Boolean(createdPlan.isActive),
            createdAt: createdPlan.createdAt,
            updatedAt: createdPlan.updatedAt,
        };
    }

    // Update subscription plan
    async updatePlan(planId: number, updates: {
        name?: string;
        displayName?: string;
        description?: string;
        priceMonthly?: number;
        priceYearly?: number;
        currency?: string;
        features?: any[];
        limits?: any;
        isActive?: boolean;
    }): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Build update object
        const updateData: any = {
            updatedAt: now,
        };

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.priceMonthly !== undefined) updateData.priceMonthly = updates.priceMonthly;
        if (updates.priceYearly !== undefined) updateData.priceYearly = updates.priceYearly;
        if (updates.currency !== undefined) updateData.currency = updates.currency;
        if (updates.features !== undefined) updateData.features = JSON.stringify(updates.features);
        if (updates.limits !== undefined) updateData.limits = JSON.stringify(updates.limits);
        if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

        await db
            .update(subscriptionPlans)
            .set(updateData)
            .where(eq(subscriptionPlans.id, planId));

        // Fetch and return updated plan
        const updatedPlan = await this.getPlanById(planId);
        if (!updatedPlan) {
            throw new Error('Plan not found after update');
        }

        return updatedPlan;
    }

    // Delete subscription plan (soft delete by setting isActive to false)
    async deletePlan(planId: number): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        // Check if plan has active subscriptions
        const activeSubscriptionsResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(sql`${userSubscriptions.planId} = ${planId} AND ${userSubscriptions.status} = 'active'`);

        const activeSubscriptions = activeSubscriptionsResult[0]?.count || 0;

        if (activeSubscriptions > 0) {
            throw new Error(`Cannot delete plan with ${activeSubscriptions} active subscriptions. Deactivate the plan instead.`);
        }

        // Soft delete by setting isActive to false
        await db
            .update(subscriptionPlans)
            .set({
                isActive: false,
                updatedAt: now,
            })
            .where(eq(subscriptionPlans.id, planId));
    }

    // Get subscription list with pagination, search, and filtering
    async getSubscriptionList(params: {
        page?: number;
        limit?: number;
        search?: string;
        plan?: string;
        status?: string;
    }): Promise<{
        subscriptions: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions: any[] = [];

        // Search by user name, email, or subscription ID
        if (params.search) {
            const searchTerm = `%${params.search}%`;
            conditions.push(
                sql`(
                    ${users.email} LIKE ${searchTerm} OR
                    ${users.firstName} LIKE ${searchTerm} OR
                    ${users.lastName} LIKE ${searchTerm} OR
                    ${userSubscriptions.id} = ${params.search}
                )`
            );
        }

        // Filter by subscription status
        if (params.status) {
            conditions.push(eq(userSubscriptions.status, params.status as 'active' | 'expired' | 'cancelled' | 'pending'));
        }

        // Build WHERE clause
        const whereClause = conditions.length > 0
            ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
            : sql``;

        // Get total count using raw SQL
        const countQuery = sql`
            SELECT COUNT(*) as count
            FROM ${userSubscriptions}
            INNER JOIN ${users} ON ${userSubscriptions.userId} = ${users.id}
            INNER JOIN ${subscriptionPlans} ON ${userSubscriptions.planId} = ${subscriptionPlans.id}
            ${whereClause}
            ${params.plan ? sql`AND ${subscriptionPlans.name} = ${params.plan}` : sql``}
        `;
        const countResult = await db.all(countQuery);
        const total = (countResult[0] as any)?.count || 0;

        // Build main query with joins
        const mainQuery = sql`
            SELECT 
                ${userSubscriptions.id} as id,
                ${userSubscriptions.userId} as userId,
                ${userSubscriptions.planId} as planId,
                ${userSubscriptions.status} as status,
                ${userSubscriptions.billingCycle} as billingCycle,
                ${userSubscriptions.startDate} as startDate,
                ${userSubscriptions.endDate} as endDate,
                ${userSubscriptions.autoRenew} as autoRenew,
                ${userSubscriptions.createdAt} as createdAt,
                ${userSubscriptions.updatedAt} as updatedAt,
                ${users.email} as userEmail,
                ${users.firstName} as userFirstName,
                ${users.lastName} as userLastName,
                ${subscriptionPlans.name} as planName,
                ${subscriptionPlans.displayName} as planDisplayName,
                ${subscriptionPlans.priceMonthly} as planPriceMonthly,
                ${subscriptionPlans.priceYearly} as planPriceYearly
            FROM ${userSubscriptions}
            INNER JOIN ${users} ON ${userSubscriptions.userId} = ${users.id}
            INNER JOIN ${subscriptionPlans} ON ${userSubscriptions.planId} = ${subscriptionPlans.id}
            ${whereClause}
            ${params.plan ? sql`AND ${subscriptionPlans.name} = ${params.plan}` : sql``}
            ORDER BY ${userSubscriptions.createdAt} DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const result = await db.all(mainQuery);
        const subscriptionList = result.map((row: any) => ({
            id: row.id,
            userId: row.userId,
            user: {
                id: row.userId,
                email: row.userEmail || 'N/A',
                name: `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || 'N/A',
                firstName: row.userFirstName || '',
                lastName: row.userLastName || '',
            },
            plan: {
                id: row.planId,
                name: row.planName,
                displayName: row.planDisplayName,
                priceMonthly: row.planPriceMonthly,
                priceYearly: row.planPriceYearly,
            },
            status: row.status,
            billingCycle: row.billingCycle,
            startDate: row.startDate,
            endDate: row.endDate,
            autoRenew: Boolean(row.autoRenew),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            // Calculate next billing date (if active and auto-renew)
            nextBilling: row.status === 'active' && row.autoRenew ? row.endDate : null,
        }));

        const totalPages = Math.ceil(total / limit);

        return {
            subscriptions: subscriptionList,
            total,
            page,
            totalPages,
        };
    }

    // Get subscription details by ID with payment history and invoices
    async getSubscriptionDetails(subscriptionId: number): Promise<any | null> {
        const now = Math.floor(Date.now() / 1000);

        // Fetch subscription with user and plan details
        const subscriptionQuery = sql`
            SELECT 
                ${userSubscriptions.id} as id,
                ${userSubscriptions.userId} as userId,
                ${userSubscriptions.planId} as planId,
                ${userSubscriptions.status} as status,
                ${userSubscriptions.billingCycle} as billingCycle,
                ${userSubscriptions.startDate} as startDate,
                ${userSubscriptions.endDate} as endDate,
                ${userSubscriptions.autoRenew} as autoRenew,
                ${userSubscriptions.cancelledAt} as cancelledAt,
                ${userSubscriptions.cancellationReason} as cancellationReason,
                ${userSubscriptions.createdAt} as createdAt,
                ${userSubscriptions.updatedAt} as updatedAt,
                ${users.id} as userId,
                ${users.email} as userEmail,
                ${users.firstName} as userFirstName,
                ${users.lastName} as userLastName,
                ${subscriptionPlans.id} as planId,
                ${subscriptionPlans.name} as planName,
                ${subscriptionPlans.displayName} as planDisplayName,
                ${subscriptionPlans.description} as planDescription,
                ${subscriptionPlans.priceMonthly} as planPriceMonthly,
                ${subscriptionPlans.priceYearly} as planPriceYearly,
                ${subscriptionPlans.currency} as planCurrency,
                ${subscriptionPlans.features} as planFeatures,
                ${subscriptionPlans.limits} as planLimits
            FROM ${userSubscriptions}
            INNER JOIN ${users} ON ${userSubscriptions.userId} = ${users.id}
            INNER JOIN ${subscriptionPlans} ON ${userSubscriptions.planId} = ${subscriptionPlans.id}
            WHERE ${userSubscriptions.id} = ${subscriptionId}
        `;

        const subscriptionResult = await db.all(subscriptionQuery);

        if (subscriptionResult.length === 0) {
            return null;
        }

        const row: any = subscriptionResult[0];

        // Fetch payment history for this subscription
        const paymentHistoryQuery = sql`
            SELECT 
                ${payments.id} as id,
                ${payments.amount} as amount,
                ${payments.currency} as currency,
                ${payments.paymentMethod} as paymentMethod,
                ${payments.status} as status,
                ${payments.midtransTransactionId} as midtransTransactionId,
                ${payments.midtransOrderId} as midtransOrderId,
                ${payments.paidAt} as paidAt,
                ${payments.createdAt} as createdAt
            FROM ${payments}
            WHERE ${payments.subscriptionId} = ${subscriptionId}
            ORDER BY ${payments.createdAt} DESC
        `;

        const paymentHistory = await db.all(paymentHistoryQuery);

        // Fetch invoices related to this subscription
        const invoicesQuery = sql`
            SELECT 
                ${invoices.id} as id,
                ${invoices.invoiceNumber} as invoiceNumber,
                ${invoices.amount} as amount,
                ${invoices.currency} as currency,
                ${invoices.status} as status,
                ${invoices.issuedAt} as issuedAt,
                ${invoices.dueAt} as dueAt,
                ${invoices.paidAt} as paidAt,
                ${invoices.items} as items
            FROM ${invoices}
            WHERE ${invoices.paymentId} IN (
                SELECT ${payments.id}
                FROM ${payments}
                WHERE ${payments.subscriptionId} = ${subscriptionId}
            )
            ORDER BY ${invoices.issuedAt} DESC
        `;

        const invoicesList = await db.all(invoicesQuery);

        // Calculate renewal status and next billing date
        const isActive = row.status === 'active';
        const willRenew = isActive && Boolean(row.autoRenew);
        const nextBillingDate = willRenew ? row.endDate : null;
        const daysUntilRenewal = nextBillingDate ? Math.floor((nextBillingDate - now) / (24 * 60 * 60)) : null;

        // Determine renewal status message
        let renewalStatus = 'N/A';
        if (row.status === 'cancelled') {
            renewalStatus = 'Cancelled';
        } else if (row.status === 'expired') {
            renewalStatus = 'Expired';
        } else if (row.status === 'pending') {
            renewalStatus = 'Pending Payment';
        } else if (isActive && willRenew) {
            renewalStatus = `Will renew on ${new Date(nextBillingDate! * 1000).toLocaleDateString()}`;
        } else if (isActive && !willRenew) {
            renewalStatus = `Will expire on ${new Date(row.endDate * 1000).toLocaleDateString()}`;
        }

        return {
            id: row.id,
            user: {
                id: row.userId,
                email: row.userEmail || 'N/A',
                name: `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || 'N/A',
                firstName: row.userFirstName || '',
                lastName: row.userLastName || '',
            },
            plan: {
                id: row.planId,
                name: row.planName,
                displayName: row.planDisplayName,
                description: row.planDescription,
                priceMonthly: row.planPriceMonthly,
                priceYearly: row.planPriceYearly,
                currency: row.planCurrency,
                features: JSON.parse(row.planFeatures || '[]'),
                limits: JSON.parse(row.planLimits || '{}'),
            },
            status: row.status,
            billingCycle: row.billingCycle,
            startDate: row.startDate,
            endDate: row.endDate,
            autoRenew: Boolean(row.autoRenew),
            cancelledAt: row.cancelledAt,
            cancellationReason: row.cancellationReason,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            renewalStatus: {
                status: renewalStatus,
                nextBillingDate,
                daysUntilRenewal,
                willRenew,
            },
            paymentHistory: paymentHistory.map((payment: any) => ({
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                midtransTransactionId: payment.midtransTransactionId,
                midtransOrderId: payment.midtransOrderId,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
            })),
            invoices: invoicesList.map((invoice: any) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                currency: invoice.currency,
                status: invoice.status,
                issuedAt: invoice.issuedAt,
                dueAt: invoice.dueAt,
                paidAt: invoice.paidAt,
                items: JSON.parse(invoice.items || '[]'),
            })),
        };
    }

    // Extend subscription by adding days to end date
    async extendSubscription(subscriptionId: number, days: number, reason: string): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Fetch current subscription
        const [subscription] = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId));

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Calculate new end date
        const daysInSeconds = days * 24 * 60 * 60;
        const newEndDate = subscription.endDate + daysInSeconds;

        // Update subscription
        await db
            .update(userSubscriptions)
            .set({
                endDate: newEndDate,
                updatedAt: now,
            })
            .where(eq(userSubscriptions.id, subscriptionId));

        // Fetch and return updated subscription
        return await this.getSubscriptionDetails(subscriptionId);
    }

    // Upgrade subscription to a higher plan
    async upgradeSubscription(subscriptionId: number, newPlanId: number): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Fetch current subscription
        const [subscription] = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId));

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Fetch new plan
        const [newPlan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, newPlanId));

        if (!newPlan) {
            throw new Error('New plan not found');
        }

        // Update subscription with new plan
        await db
            .update(userSubscriptions)
            .set({
                planId: newPlanId,
                updatedAt: now,
            })
            .where(eq(userSubscriptions.id, subscriptionId));

        // Update user's subscription plan ID
        await db
            .update(users)
            .set({
                subscriptionPlanId: newPlanId,
                updatedAt: now,
            })
            .where(eq(users.id, subscription.userId));

        // Fetch and return updated subscription
        return await this.getSubscriptionDetails(subscriptionId);
    }

    // Downgrade subscription to a lower plan
    async downgradeSubscription(subscriptionId: number, newPlanId: number): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Fetch current subscription
        const [subscription] = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId));

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Fetch new plan
        const [newPlan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, newPlanId));

        if (!newPlan) {
            throw new Error('New plan not found');
        }

        // Update subscription with new plan
        await db
            .update(userSubscriptions)
            .set({
                planId: newPlanId,
                updatedAt: now,
            })
            .where(eq(userSubscriptions.id, subscriptionId));

        // Update user's subscription plan ID
        await db
            .update(users)
            .set({
                subscriptionPlanId: newPlanId,
                updatedAt: now,
            })
            .where(eq(users.id, subscription.userId));

        // Fetch and return updated subscription
        return await this.getSubscriptionDetails(subscriptionId);
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId: number, reason: string): Promise<void> {
        const now = Math.floor(Date.now() / 1000);

        // Fetch current subscription
        const [subscription] = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId));

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Update subscription status to cancelled
        await db
            .update(userSubscriptions)
            .set({
                status: 'cancelled',
                autoRenew: false,
                cancelledAt: now,
                cancellationReason: reason,
                updatedAt: now,
            })
            .where(eq(userSubscriptions.id, subscriptionId));

        // Update user's subscription status
        await db
            .update(users)
            .set({
                subscriptionStatus: 'cancelled',
                updatedAt: now,
            })
            .where(eq(users.id, subscription.userId));
    }

    // Get subscription analytics
    async getSubscriptionAnalytics(): Promise<{
        total: number;
        active: number;
        cancelled: number;
        churnRate: number;
        conversionRate: number;
        byPlan: Record<string, number>;
    }> {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

        // Total subscriptions (all time)
        const totalResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions);
        const total = totalResult[0]?.count || 0;

        // Active subscriptions
        const activeResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.status, 'active'));
        const active = activeResult[0]?.count || 0;

        // Cancelled subscriptions
        const cancelledResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.status, 'cancelled'));
        const cancelled = cancelledResult[0]?.count || 0;

        // Churn rate (cancelled in last 30 days / total active at start of period)
        const cancelledLast30DaysResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .where(sql`${userSubscriptions.cancelledAt} >= ${thirtyDaysAgo}`);
        const cancelledLast30Days = cancelledLast30DaysResult[0]?.count || 0;

        const churnRate = active > 0 ? (cancelledLast30Days / (active + cancelledLast30Days)) * 100 : 0;

        // Conversion rate (paid subscriptions / total users)
        const totalUsersResult = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
        const totalUsers = totalUsersResult[0]?.count || 0;

        const paidSubscriptionsResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(sql`${userSubscriptions.status} = 'active' AND ${subscriptionPlans.name} != 'free'`);
        const paidSubscriptions = paidSubscriptionsResult[0]?.count || 0;

        const conversionRate = totalUsers > 0 ? (paidSubscriptions / totalUsers) * 100 : 0;

        // Subscriptions by plan (active only)
        const byPlanResult = await db
            .select({
                planName: subscriptionPlans.name,
                count: sql<number>`COUNT(*)`,
            })
            .from(userSubscriptions)
            .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(userSubscriptions.status, 'active'))
            .groupBy(subscriptionPlans.name);

        const byPlan: Record<string, number> = {};
        byPlanResult.forEach(row => {
            byPlan[row.planName] = row.count;
        });

        return {
            total,
            active,
            cancelled,
            churnRate: Math.round(churnRate * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
            byPlan,
        };
    }

    // Get payment list with pagination, search, and filtering
    async getPaymentList(params: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
        dateFrom?: number;
        dateTo?: number;
    }) {
        const { page, limit, search, status, dateFrom, dateTo } = params;
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions = [];

        // Search by user name, email, transaction ID, or invoice number
        if (search && search.trim().length > 0) {
            const searchTerm = `%${search.trim()}%`;
            conditions.push(
                sql`(
                    ${users.firstName} LIKE ${searchTerm} OR
                    ${users.lastName} LIKE ${searchTerm} OR
                    ${users.email} LIKE ${searchTerm} OR
                    ${payments.midtransTransactionId} LIKE ${searchTerm} OR
                    ${payments.midtransOrderId} LIKE ${searchTerm} OR
                    ${invoices.invoiceNumber} LIKE ${searchTerm}
                )`
            );
        }

        // Filter by status
        if (status && ['pending', 'paid', 'failed', 'refunded'].includes(status)) {
            conditions.push(eq(payments.status, status as any));
        }

        // Filter by date range
        if (dateFrom) {
            conditions.push(sql`${payments.createdAt} >= ${dateFrom}`);
        }
        if (dateTo) {
            conditions.push(sql`${payments.createdAt} <= ${dateTo}`);
        }

        // Combine conditions
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(payments)
            .leftJoin(users, eq(payments.userId, users.id))
            .leftJoin(invoices, eq(payments.id, invoices.paymentId))
            .where(whereClause);

        const total = countResult[0]?.count || 0;
        const totalPages = Math.ceil(total / limit);

        // Get paginated payment list with user and subscription details
        const paymentList = await db
            .select({
                id: payments.id,
                userId: payments.userId,
                subscriptionId: payments.subscriptionId,
                amount: payments.amount,
                currency: payments.currency,
                paymentMethod: payments.paymentMethod,
                status: payments.status,
                midtransTransactionId: payments.midtransTransactionId,
                midtransOrderId: payments.midtransOrderId,
                paidAt: payments.paidAt,
                createdAt: payments.createdAt,
                updatedAt: payments.updatedAt,
                // User details
                userEmail: users.email,
                userFirstName: users.firstName,
                userLastName: users.lastName,
                // Subscription details
                subscriptionPlanId: userSubscriptions.planId,
                subscriptionStatus: userSubscriptions.status,
                // Plan details
                planName: subscriptionPlans.name,
                planDisplayName: subscriptionPlans.displayName,
                // Invoice details
                invoiceNumber: invoices.invoiceNumber,
                invoiceStatus: invoices.status,
            })
            .from(payments)
            .leftJoin(users, eq(payments.userId, users.id))
            .leftJoin(userSubscriptions, eq(payments.subscriptionId, userSubscriptions.id))
            .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .leftJoin(invoices, eq(payments.id, invoices.paymentId))
            .where(whereClause)
            .orderBy(desc(payments.createdAt))
            .limit(limit)
            .offset(offset);

        // Format the results
        const formattedPayments = paymentList.map(payment => ({
            id: payment.id,
            userId: payment.userId,
            subscriptionId: payment.subscriptionId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            midtransTransactionId: payment.midtransTransactionId,
            midtransOrderId: payment.midtransOrderId,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            user: {
                email: payment.userEmail,
                firstName: payment.userFirstName,
                lastName: payment.userLastName,
                fullName: `${payment.userFirstName || ''} ${payment.userLastName || ''}`.trim() || payment.userEmail || 'Unknown',
            },
            subscription: payment.subscriptionId ? {
                id: payment.subscriptionId,
                planId: payment.subscriptionPlanId,
                status: payment.subscriptionStatus,
                planName: payment.planName,
                planDisplayName: payment.planDisplayName,
            } : null,
            invoice: payment.invoiceNumber ? {
                invoiceNumber: payment.invoiceNumber,
                status: payment.invoiceStatus,
            } : null,
        }));

        return {
            payments: formattedPayments,
            total,
            page,
            totalPages,
            limit,
        };
    }

    // Get payment details with Midtrans transaction details, related invoice, subscription, and webhook logs
    async getPaymentDetails(paymentId: number) {
        // Fetch payment with user, subscription, and invoice details
        const paymentResult = await db
            .select({
                // Payment details
                id: payments.id,
                userId: payments.userId,
                subscriptionId: payments.subscriptionId,
                amount: payments.amount,
                currency: payments.currency,
                paymentMethod: payments.paymentMethod,
                status: payments.status,
                midtransTransactionId: payments.midtransTransactionId,
                midtransOrderId: payments.midtransOrderId,
                paidAt: payments.paidAt,
                createdAt: payments.createdAt,
                updatedAt: payments.updatedAt,
                // User details
                userEmail: users.email,
                userFirstName: users.firstName,
                userLastName: users.lastName,
                userProfileImageUrl: users.profileImageUrl,
                // Subscription details
                subscriptionPlanId: userSubscriptions.planId,
                subscriptionStatus: userSubscriptions.status,
                subscriptionBillingCycle: userSubscriptions.billingCycle,
                subscriptionStartDate: userSubscriptions.startDate,
                subscriptionEndDate: userSubscriptions.endDate,
                subscriptionAutoRenew: userSubscriptions.autoRenew,
                // Plan details
                planName: subscriptionPlans.name,
                planDisplayName: subscriptionPlans.displayName,
                planDescription: subscriptionPlans.description,
                planPriceMonthly: subscriptionPlans.priceMonthly,
                planPriceYearly: subscriptionPlans.priceYearly,
            })
            .from(payments)
            .leftJoin(users, eq(payments.userId, users.id))
            .leftJoin(userSubscriptions, eq(payments.subscriptionId, userSubscriptions.id))
            .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (paymentResult.length === 0) {
            return null;
        }

        const payment = paymentResult[0];

        // Fetch related invoice if exists
        const invoiceResult = await db
            .select()
            .from(invoices)
            .where(eq(invoices.paymentId, paymentId))
            .limit(1);

        const invoice = invoiceResult.length > 0 ? invoiceResult[0] : null;

        // Fetch webhook logs for this payment (by order ID)
        let webhookLogs: any[] = [];
        if (payment.midtransOrderId) {
            webhookLogs = await db
                .select()
                .from(midtransWebhookLogs)
                .where(eq(midtransWebhookLogs.orderId, payment.midtransOrderId))
                .orderBy(desc(midtransWebhookLogs.createdAt));
        }

        // Format the response
        return {
            id: payment.id,
            userId: payment.userId,
            subscriptionId: payment.subscriptionId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            midtransTransactionId: payment.midtransTransactionId,
            midtransOrderId: payment.midtransOrderId,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            user: {
                id: payment.userId,
                email: payment.userEmail,
                firstName: payment.userFirstName,
                lastName: payment.userLastName,
                fullName: `${payment.userFirstName || ''} ${payment.userLastName || ''}`.trim() || payment.userEmail || 'Unknown',
                profileImageUrl: payment.userProfileImageUrl,
            },
            subscription: payment.subscriptionId ? {
                id: payment.subscriptionId,
                planId: payment.subscriptionPlanId,
                status: payment.subscriptionStatus,
                billingCycle: payment.subscriptionBillingCycle,
                startDate: payment.subscriptionStartDate,
                endDate: payment.subscriptionEndDate,
                autoRenew: Boolean(payment.subscriptionAutoRenew),
                plan: {
                    name: payment.planName,
                    displayName: payment.planDisplayName,
                    description: payment.planDescription,
                    priceMonthly: payment.planPriceMonthly,
                    priceYearly: payment.planPriceYearly,
                },
            } : null,
            invoice: invoice ? {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                currency: invoice.currency,
                items: JSON.parse(invoice.items),
                status: invoice.status,
                issuedAt: invoice.issuedAt,
                dueAt: invoice.dueAt,
                paidAt: invoice.paidAt,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
            } : null,
            webhookLogs: webhookLogs.map(log => ({
                id: log.id,
                orderId: log.orderId,
                transactionId: log.transactionId,
                eventType: log.eventType,
                payload: JSON.parse(log.payload),
                signature: log.signature,
                status: log.status,
                errorMessage: log.errorMessage,
                createdAt: log.createdAt,
            })),
        };
    }

    // Generate invoice for a payment
    async generateInvoice(paymentId: number): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Check if payment exists
        const payment = await db.select()
            .from(payments)
            .where(eq(payments.id, paymentId))
            .get();

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if invoice already exists for this payment
        const existingInvoice = await db.select()
            .from(invoices)
            .where(eq(invoices.paymentId, paymentId))
            .get();

        if (existingInvoice) {
            throw new Error('Invoice already exists for this payment');
        }

        // Get user details
        const user = await db.select()
            .from(users)
            .where(eq(users.id, payment.userId))
            .get();

        if (!user) {
            throw new Error('User not found');
        }

        // Get subscription details if payment is for a subscription
        let subscriptionDetails = null;
        if (payment.subscriptionId) {
            const subscription = await db.select()
                .from(userSubscriptions)
                .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
                .where(eq(userSubscriptions.id, payment.subscriptionId))
                .get();

            if (subscription) {
                subscriptionDetails = {
                    planName: subscription.subscription_plans?.displayName || 'Unknown Plan',
                    billingCycle: subscription.user_subscriptions.billingCycle,
                    startDate: subscription.user_subscriptions.startDate,
                    endDate: subscription.user_subscriptions.endDate,
                };
            }
        }

        // Generate invoice number (format: INV-YYYYMMDD-XXXX)
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        // Get count of invoices created today to generate sequential number
        const startOfDay = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000);
        const endOfDay = startOfDay + 86400;

        const todayInvoicesCount = await db.select({ count: sql<number>`count(*)` })
            .from(invoices)
            .where(and(
                sql`${invoices.createdAt} >= ${startOfDay}`,
                sql`${invoices.createdAt} < ${endOfDay}`
            ))
            .get();

        const sequentialNumber = String((todayInvoicesCount?.count || 0) + 1).padStart(4, '0');
        const invoiceNumber = `INV-${dateStr}-${sequentialNumber}`;

        // Prepare invoice items
        const items = [];
        if (subscriptionDetails) {
            items.push({
                description: `${subscriptionDetails.planName} - ${subscriptionDetails.billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
                quantity: 1,
                unitPrice: payment.amount,
                total: payment.amount,
            });
        } else {
            items.push({
                description: 'Payment',
                quantity: 1,
                unitPrice: payment.amount,
                total: payment.amount,
            });
        }

        // Create invoice in database
        const newInvoice = await db.insert(invoices).values({
            invoiceNumber,
            userId: payment.userId,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            items: JSON.stringify(items),
            status: payment.status === 'paid' ? 'paid' : 'draft',
            issuedAt: now,
            dueAt: now + (7 * 24 * 60 * 60), // Due in 7 days
            paidAt: payment.paidAt || null,
            createdAt: now,
            updatedAt: now,
        }).returning().get();

        // Return invoice with user and payment details
        return {
            id: newInvoice.id,
            invoiceNumber: newInvoice.invoiceNumber,
            amount: newInvoice.amount,
            currency: newInvoice.currency,
            items: JSON.parse(newInvoice.items),
            status: newInvoice.status,
            issuedAt: newInvoice.issuedAt,
            dueAt: newInvoice.dueAt,
            paidAt: newInvoice.paidAt,
            createdAt: newInvoice.createdAt,
            updatedAt: newInvoice.updatedAt,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            },
            payment: {
                id: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                midtransTransactionId: payment.midtransTransactionId,
                midtransOrderId: payment.midtransOrderId,
                paidAt: payment.paidAt,
            },
            subscription: subscriptionDetails,
        };
    }

    // Refund a payment via Midtrans
    async refundPayment(
        paymentId: number,
        reason: string,
        amount?: number
    ): Promise<any> {
        const now = Math.floor(Date.now() / 1000);

        // Check if payment exists
        const payment = await db.select()
            .from(payments)
            .where(eq(payments.id, paymentId))
            .get();

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if payment has already been refunded
        if (payment.status === 'refunded') {
            throw new Error('Payment has already been refunded');
        }

        // Check if payment is in paid status
        if (payment.status !== 'paid') {
            throw new Error('Payment is not in paid status');
        }

        // Check if payment has Midtrans order ID
        if (!payment.midtransOrderId) {
            throw new Error('Payment does not have a Midtrans order ID');
        }

        try {
            // Import Midtrans service
            const { midtransService } = await import('../services/midtrans-service');

            // Process refund via Midtrans API
            const refundResponse = await midtransService.refundTransaction(
                payment.midtransOrderId,
                amount, // Optional partial refund amount
                reason
            );

            // Update payment status in database
            await db.update(payments)
                .set({
                    status: 'refunded',
                    updatedAt: now,
                })
                .where(eq(payments.id, paymentId))
                .run();

            // Update subscription status if payment is for a subscription
            if (payment.subscriptionId) {
                const subscription = await db.select()
                    .from(userSubscriptions)
                    .where(eq(userSubscriptions.id, payment.subscriptionId))
                    .get();

                if (subscription) {
                    // Cancel subscription if it's active
                    if (subscription.status === 'active') {
                        await db.update(userSubscriptions)
                            .set({
                                status: 'cancelled',
                                cancelledAt: now,
                                cancellationReason: `Payment refunded: ${reason}`,
                                updatedAt: now,
                            })
                            .where(eq(userSubscriptions.id, payment.subscriptionId))
                            .run();
                    }
                }
            }

            // Get updated payment details
            const updatedPayment = await db.select()
                .from(payments)
                .where(eq(payments.id, paymentId))
                .get();

            // TODO: Send refund confirmation email to user
            // This would be implemented in a separate email service

            return {
                payment: updatedPayment,
                refundStatus: refundResponse.transaction_status,
                refundAmount: amount || payment.amount,
                reason,
                midtransResponse: refundResponse,
            };
        } catch (error) {
            console.error('Error processing refund via Midtrans:', error);
            throw new Error(`Midtrans refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get payment by Midtrans order ID
    async getPaymentByMidtransOrderId(orderId: string) {
        const payment = await db.select()
            .from(payments)
            .where(eq(payments.midtransOrderId, orderId))
            .get();

        return payment;
    }

    // Update payment status
    async updatePaymentStatus(
        paymentId: number,
        status: 'pending' | 'paid' | 'failed' | 'refunded',
        transactionId?: string,
        paidAt?: number
    ) {
        const now = Math.floor(Date.now() / 1000);

        const updateData: any = {
            status,
            updatedAt: now,
        };

        if (transactionId) {
            updateData.midtransTransactionId = transactionId;
        }

        if (paidAt) {
            updateData.paidAt = paidAt;
        } else if (status === 'paid' && !paidAt) {
            // If status is paid but no paidAt provided, use current timestamp
            updateData.paidAt = now;
        }

        await db.update(payments)
            .set(updateData)
            .where(eq(payments.id, paymentId))
            .run();

        // Get updated payment
        const updatedPayment = await db.select()
            .from(payments)
            .where(eq(payments.id, paymentId))
            .get();

        return updatedPayment;
    }

    // Activate subscription after successful payment
    async activateSubscriptionAfterPayment(subscriptionId: number) {
        const now = Math.floor(Date.now() / 1000);

        // Get subscription details
        const subscription = await db.select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId))
            .get();

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Update subscription status to active
        await db.update(userSubscriptions)
            .set({
                status: 'active',
                updatedAt: now,
            })
            .where(eq(userSubscriptions.id, subscriptionId))
            .run();

        // Update user's subscription plan ID and status
        await db.update(users)
            .set({
                subscriptionPlanId: subscription.planId,
                subscriptionStatus: 'active',
                updatedAt: now,
            })
            .where(eq(users.id, subscription.userId))
            .run();

        console.log(`Subscription ${subscriptionId} activated for user ${subscription.userId}`);
    }

    // Log Midtrans webhook
    async logMidtransWebhook(data: {
        orderId: string;
        transactionId?: string;
        eventType: string;
        payload: string;
        signature?: string;
        status: 'processed' | 'failed';
        errorMessage?: string;
    }) {
        const now = Math.floor(Date.now() / 1000);

        await db.insert(midtransWebhookLogs).values({
            orderId: data.orderId,
            transactionId: data.transactionId || null,
            eventType: data.eventType,
            payload: data.payload,
            signature: data.signature || null,
            status: data.status,
            errorMessage: data.errorMessage || null,
            createdAt: now,
        }).run();
    }

    // Get webhook logs with pagination and filtering
    async getWebhookLogs(options: {
        page: number;
        limit: number;
        status?: string;
        dateFrom?: number;
        dateTo?: number;
    }) {
        const { page, limit, status, dateFrom, dateTo } = options;
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions = [];

        if (status && (status === 'processed' || status === 'failed')) {
            conditions.push(eq(midtransWebhookLogs.status, status));
        }

        if (dateFrom) {
            conditions.push(sql`${midtransWebhookLogs.createdAt} >= ${dateFrom}`);
        }

        if (dateTo) {
            conditions.push(sql`${midtransWebhookLogs.createdAt} <= ${dateTo}`);
        }

        // Build WHERE clause
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Fetch total count
        const countQuery = whereClause
            ? db.select({ count: sql<number>`count(*)` }).from(midtransWebhookLogs).where(whereClause)
            : db.select({ count: sql<number>`count(*)` }).from(midtransWebhookLogs);

        const countResult = await countQuery;
        const total = countResult[0]?.count || 0;

        // Fetch webhook logs
        const logsQuery = db
            .select()
            .from(midtransWebhookLogs)
            .orderBy(desc(midtransWebhookLogs.createdAt))
            .limit(limit)
            .offset(offset);

        const logs = whereClause
            ? await logsQuery.where(whereClause)
            : await logsQuery;

        return {
            logs: logs.map(log => ({
                id: log.id,
                orderId: log.orderId,
                transactionId: log.transactionId,
                eventType: log.eventType,
                payload: log.payload,
                signature: log.signature,
                status: log.status,
                errorMessage: log.errorMessage,
                createdAt: log.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
}

// Export singleton instance
export const adminStorage = new AdminStorage();
