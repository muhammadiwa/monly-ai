import { db } from "../db";
import { adminUsers, adminActivityLogs, users, userSubscriptions, subscriptionPlans, payments, transactions, budgets, goals } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

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
}

// Export singleton instance
export const adminStorage = new AdminStorage();
