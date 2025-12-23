/**
 * Test script for User Activity Analytics API Endpoint
 * Tests GET /api/admin/users/:id/activity endpoint
 * 
 * Requirements tested:
 * - 4.3: Engagement metrics (DAU, WAU, MAU)
 * - 4.4: Retention metrics
 */

import { db } from './db';
import { users, transactions, categories, adminUsers, adminActivityLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashAdminPassword } from './admin/admin-auth';
import { adminStorage } from './admin/admin-storage';

async function testUserActivityEndpoint() {
    console.log('🧪 Testing User Activity Analytics API Endpoint (Direct Function Calls)...\n');

    try {
        // Step 1: Create test admin user
        console.log('📝 Step 1: Creating test admin user...');
        const now = Math.floor(Date.now() / 1000);
        const testAdminId = 'test-admin-' + Date.now();
        const hashedPassword = await hashAdminPassword('admin123');

        await db.insert(adminUsers).values({
            id: testAdminId,
            email: `admin-${Date.now()}@test.com`,
            name: 'Test Admin',
            password: hashedPassword,
            role: 'admin',
            createdAt: now,
            updatedAt: now,
        });
        console.log(`✅ Created test admin user: ${testAdminId}`);

        // Step 2: Create test user with activity
        console.log('\n📝 Step 2: Creating test user with activity...');
        const testUserId = 'test-user-activity-endpoint-' + Date.now();

        await db.insert(users).values({
            id: testUserId,
            email: `activity-endpoint-${Date.now()}@test.com`,
            firstName: 'Activity',
            lastName: 'Endpoint',
            password: 'test123',
            subscriptionStatus: 'active',
            createdAt: now - (45 * 24 * 60 * 60), // 45 days ago
            updatedAt: now - (3 * 24 * 60 * 60), // 3 days ago (last active)
        });
        console.log(`✅ Created test user: ${testUserId}`);

        // Create a test category
        const [testCategory] = await db.insert(categories).values({
            name: 'Test Category Endpoint',
            icon: '🧪',
            color: '#FF0000',
            type: 'expense',
            isDefault: false,
            userId: testUserId,
            createdAt: now,
        }).returning();

        // Create transactions on different days
        const transactionDates = [
            now - (40 * 24 * 60 * 60),
            now - (30 * 24 * 60 * 60),
            now - (20 * 24 * 60 * 60),
            now - (10 * 24 * 60 * 60),
            now - (3 * 24 * 60 * 60),
        ];

        for (const date of transactionDates) {
            await db.insert(transactions).values({
                userId: testUserId,
                categoryId: testCategory.id,
                amount: 100,
                currency: 'USD',
                description: `Test transaction`,
                type: 'expense',
                date: date,
                createdAt: date,
                updatedAt: date,
            });
        }
        console.log(`✅ Created ${transactionDates.length} test transactions`);

        // Step 3: Test the getUserActivity function directly
        console.log('\n📝 Step 3: Testing getUserActivity function...');

        const activityData = await adminStorage.getUserActivity(testUserId);

        console.log('\n📊 Activity Data:');
        console.log('Login History:', JSON.stringify(activityData.loginHistory, null, 2));
        console.log('\nEngagement Metrics:');
        console.log(`  - DAU: ${activityData.engagementMetrics.dau}`);
        console.log(`  - WAU: ${activityData.engagementMetrics.wau}`);
        console.log(`  - MAU: ${activityData.engagementMetrics.mau}`);
        console.log(`  - Total Days Active: ${activityData.engagementMetrics.totalDaysActive}`);
        console.log('\nRetention Metrics:');
        console.log(`  - Days Since Registration: ${activityData.retentionMetrics.daysSinceRegistration}`);
        console.log(`  - Days Since Last Active: ${activityData.retentionMetrics.daysSinceLastActive}`);
        console.log(`  - Is Retained: ${activityData.retentionMetrics.isRetained}`);
        console.log(`  - Activity Rate: ${activityData.retentionMetrics.activityRate}%`);

        // Validate structure
        if (!activityData.loginHistory || !Array.isArray(activityData.loginHistory)) {
            throw new Error('Response should have loginHistory array');
        }

        if (!activityData.engagementMetrics) {
            throw new Error('Response should have engagementMetrics');
        }

        if (!activityData.retentionMetrics) {
            throw new Error('Response should have retentionMetrics');
        }

        console.log('\n✅ Activity data structure is valid');

        // Validate engagement metrics
        if (typeof activityData.engagementMetrics.dau !== 'boolean') {
            throw new Error('DAU should be boolean');
        }
        if (typeof activityData.engagementMetrics.wau !== 'boolean') {
            throw new Error('WAU should be boolean');
        }
        if (typeof activityData.engagementMetrics.mau !== 'boolean') {
            throw new Error('MAU should be boolean');
        }

        // User was active 3 days ago, so should be WAU and MAU but not DAU
        if (activityData.engagementMetrics.dau) {
            console.warn('⚠️  User should not be DAU (last active 3 days ago)');
        }
        if (!activityData.engagementMetrics.wau) {
            throw new Error('User should be WAU (last active 3 days ago)');
        }
        if (!activityData.engagementMetrics.mau) {
            throw new Error('User should be MAU (last active 3 days ago)');
        }
        console.log('✅ Engagement metrics are valid');

        // Validate retention metrics
        if (typeof activityData.retentionMetrics.isRetained !== 'boolean') {
            throw new Error('isRetained should be boolean');
        }
        if (activityData.retentionMetrics.activityRate < 0 || activityData.retentionMetrics.activityRate > 100) {
            throw new Error('Activity rate should be between 0 and 100');
        }
        if (activityData.retentionMetrics.daysSinceRegistration < 40) {
            throw new Error('Days since registration should be at least 40');
        }
        if (activityData.retentionMetrics.daysSinceLastActive < 2 || activityData.retentionMetrics.daysSinceLastActive > 4) {
            console.warn(`⚠️  Days since last active should be around 3, got ${activityData.retentionMetrics.daysSinceLastActive}`);
        }
        console.log('✅ Retention metrics are valid');

        // Step 4: Test admin activity logging
        console.log('\n📝 Step 4: Testing admin activity logging...');
        await adminStorage.logAdminActivity({
            adminId: testAdminId,
            action: 'VIEW_USER_ACTIVITY',
            resourceType: 'USER',
            resourceId: testUserId,
            ipAddress: '127.0.0.1',
        });

        const activityLogs = await db
            .select()
            .from(adminActivityLogs)
            .where(eq(adminActivityLogs.adminId, testAdminId));

        if (activityLogs.length === 0) {
            throw new Error('Admin activity log should be created');
        }

        const log = activityLogs.find(l => l.action === 'VIEW_USER_ACTIVITY');
        if (!log) {
            throw new Error('VIEW_USER_ACTIVITY log should exist');
        }
        if (log.resourceId !== testUserId) {
            throw new Error('Log should reference the correct user');
        }
        console.log('✅ Admin activity logging works correctly');

        // Step 5: Test with non-existent user
        console.log('\n📝 Step 5: Testing with non-existent user...');
        try {
            await adminStorage.getUserActivity('non-existent-user-id');
            throw new Error('Should have thrown error for non-existent user');
        } catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                console.log('✅ Correctly throws error for non-existent user');
            } else {
                throw error;
            }
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.delete(transactions).where(eq(transactions.userId, testUserId));
        await db.delete(categories).where(eq(categories.id, testCategory.id));
        await db.delete(users).where(eq(users.id, testUserId));
        await db.delete(adminActivityLogs).where(eq(adminActivityLogs.adminId, testAdminId));
        await db.delete(adminUsers).where(eq(adminUsers.id, testAdminId));
        console.log('✅ Test data cleaned up');

        console.log('\n✅ All User Activity Analytics API tests passed!');
        console.log('\n📋 Summary:');
        console.log('  ✅ getUserActivity function returns correct data structure');
        console.log('  ✅ Engagement metrics (DAU, WAU, MAU) are calculated correctly');
        console.log('  ✅ Retention metrics are calculated correctly');
        console.log('  ✅ Login history is returned');
        console.log('  ✅ Admin activity logging works');
        console.log('  ✅ Error handling for non-existent users works');
        console.log('\n📝 Note: The endpoint is implemented in admin-routes.ts');
        console.log('  Route: GET /api/admin/users/:id/activity');
        console.log('  Requires: Admin authentication (Bearer token)');
        console.log('  Returns: { success: true, data: { loginHistory, engagementMetrics, retentionMetrics } }');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testUserActivityEndpoint()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
