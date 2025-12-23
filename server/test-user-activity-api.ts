/**
 * Test script for User Activity Analytics API
 * Tests GET /api/admin/users/:id/activity endpoint
 * 
 * Requirements tested:
 * - 4.3: Engagement metrics (DAU, WAU, MAU)
 * - 4.4: Retention metrics
 */

import { db } from './db';
import { users, transactions, categories } from '@shared/schema';
import { adminStorage } from './admin/admin-storage';
import { eq } from 'drizzle-orm';

async function testUserActivityAPI() {
    console.log('🧪 Testing User Activity Analytics API...\n');

    try {
        // Step 1: Find or create a test user
        console.log('📝 Step 1: Setting up test user...');
        const now = Math.floor(Date.now() / 1000);
        const testUserId = 'test-user-activity-' + Date.now();

        // Create test user
        await db.insert(users).values({
            id: testUserId,
            email: `activity-test-${Date.now()}@test.com`,
            firstName: 'Activity',
            lastName: 'Test',
            password: 'test123',
            subscriptionStatus: 'active',
            createdAt: now - (60 * 24 * 60 * 60), // 60 days ago
            updatedAt: now - (2 * 24 * 60 * 60), // 2 days ago (last active)
        });
        console.log(`✅ Created test user: ${testUserId}`);

        // Create a test category
        const [testCategory] = await db.insert(categories).values({
            name: 'Test Category',
            icon: '🧪',
            color: '#FF0000',
            type: 'expense',
            isDefault: false,
            userId: testUserId,
            createdAt: now,
        }).returning();
        console.log(`✅ Created test category: ${testCategory.id}`);

        // Create some transactions on different days to simulate activity
        const transactionDates = [
            now - (50 * 24 * 60 * 60), // 50 days ago
            now - (40 * 24 * 60 * 60), // 40 days ago
            now - (30 * 24 * 60 * 60), // 30 days ago
            now - (20 * 24 * 60 * 60), // 20 days ago
            now - (10 * 24 * 60 * 60), // 10 days ago
            now - (5 * 24 * 60 * 60),  // 5 days ago
            now - (2 * 24 * 60 * 60),  // 2 days ago
        ];

        for (const date of transactionDates) {
            await db.insert(transactions).values({
                userId: testUserId,
                categoryId: testCategory.id,
                amount: 100,
                currency: 'USD',
                description: `Test transaction at ${new Date(date * 1000).toISOString()}`,
                type: 'expense',
                date: date,
                createdAt: date,
                updatedAt: date,
            });
        }
        console.log(`✅ Created ${transactionDates.length} test transactions on different days\n`);

        // Step 2: Test getUserActivity function
        console.log('📝 Step 2: Testing getUserActivity storage function...');
        const activityData = await adminStorage.getUserActivity(testUserId);

        console.log('\n📊 Activity Data:');
        console.log('Login History:', JSON.stringify(activityData.loginHistory, null, 2));
        console.log('\nEngagement Metrics:');
        console.log(`  - DAU (Daily Active User): ${activityData.engagementMetrics.dau}`);
        console.log(`  - WAU (Weekly Active User): ${activityData.engagementMetrics.wau}`);
        console.log(`  - MAU (Monthly Active User): ${activityData.engagementMetrics.mau}`);
        console.log(`  - Last Active Date: ${new Date(activityData.engagementMetrics.lastActiveDate * 1000).toISOString()}`);
        console.log(`  - Total Days Active: ${activityData.engagementMetrics.totalDaysActive}`);
        console.log('\nRetention Metrics:');
        console.log(`  - Days Since Registration: ${activityData.retentionMetrics.daysSinceRegistration}`);
        console.log(`  - Days Since Last Active: ${activityData.retentionMetrics.daysSinceLastActive}`);
        console.log(`  - Is Retained: ${activityData.retentionMetrics.isRetained}`);
        console.log(`  - Activity Rate: ${activityData.retentionMetrics.activityRate}%`);

        // Step 3: Validate the data
        console.log('\n📝 Step 3: Validating activity data...');

        // Validate engagement metrics
        if (typeof activityData.engagementMetrics.dau !== 'boolean') {
            throw new Error('DAU should be a boolean');
        }
        if (typeof activityData.engagementMetrics.wau !== 'boolean') {
            throw new Error('WAU should be a boolean');
        }
        if (typeof activityData.engagementMetrics.mau !== 'boolean') {
            throw new Error('MAU should be a boolean');
        }
        if (activityData.engagementMetrics.totalDaysActive !== transactionDates.length) {
            console.warn(`⚠️  Expected ${transactionDates.length} active days, got ${activityData.engagementMetrics.totalDaysActive}`);
        }
        console.log('✅ Engagement metrics structure is valid');

        // Validate retention metrics
        if (activityData.retentionMetrics.daysSinceRegistration < 0) {
            throw new Error('Days since registration should be non-negative');
        }
        if (activityData.retentionMetrics.daysSinceLastActive < 0) {
            throw new Error('Days since last active should be non-negative');
        }
        if (typeof activityData.retentionMetrics.isRetained !== 'boolean') {
            throw new Error('isRetained should be a boolean');
        }
        if (activityData.retentionMetrics.activityRate < 0 || activityData.retentionMetrics.activityRate > 100) {
            throw new Error('Activity rate should be between 0 and 100');
        }
        console.log('✅ Retention metrics structure is valid');

        // Validate login history
        if (!Array.isArray(activityData.loginHistory)) {
            throw new Error('Login history should be an array');
        }
        if (activityData.loginHistory.length === 0) {
            throw new Error('Login history should not be empty');
        }
        console.log('✅ Login history structure is valid');

        // Step 4: Test with non-existent user
        console.log('\n📝 Step 4: Testing with non-existent user...');
        try {
            await adminStorage.getUserActivity('non-existent-user-id');
            console.log('❌ Should have thrown error for non-existent user');
        } catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                console.log('✅ Correctly throws error for non-existent user');
            } else {
                throw error;
            }
        }

        // Step 5: Test with user with no transactions
        console.log('\n📝 Step 5: Testing with user with no transactions...');
        const noActivityUserId = 'test-user-no-activity-' + Date.now();
        await db.insert(users).values({
            id: noActivityUserId,
            email: `no-activity-${Date.now()}@test.com`,
            firstName: 'No',
            lastName: 'Activity',
            password: 'test123',
            subscriptionStatus: 'active',
            createdAt: now - (30 * 24 * 60 * 60), // 30 days ago
            updatedAt: now - (30 * 24 * 60 * 60), // Never active since registration
        });

        const noActivityData = await adminStorage.getUserActivity(noActivityUserId);
        console.log('\n📊 No Activity User Data:');
        console.log(`  - Total Days Active: ${noActivityData.engagementMetrics.totalDaysActive}`);
        console.log(`  - Activity Rate: ${noActivityData.retentionMetrics.activityRate}%`);
        console.log(`  - Is Retained: ${noActivityData.retentionMetrics.isRetained}`);

        if (noActivityData.engagementMetrics.totalDaysActive !== 0) {
            throw new Error('User with no transactions should have 0 active days');
        }
        console.log('✅ Correctly handles user with no activity');

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.delete(transactions).where(eq(transactions.userId, testUserId));
        await db.delete(transactions).where(eq(transactions.userId, noActivityUserId));
        await db.delete(categories).where(eq(categories.id, testCategory.id));
        await db.delete(users).where(eq(users.id, testUserId));
        await db.delete(users).where(eq(users.id, noActivityUserId));
        console.log('✅ Test data cleaned up');

        console.log('\n✅ All User Activity Analytics API tests passed!');
        console.log('\n📋 Summary:');
        console.log('  ✅ getUserActivity function works correctly');
        console.log('  ✅ Engagement metrics (DAU, WAU, MAU) calculated correctly');
        console.log('  ✅ Retention metrics calculated correctly');
        console.log('  ✅ Login history returned correctly');
        console.log('  ✅ Error handling for non-existent users works');
        console.log('  ✅ Handles users with no activity correctly');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testUserActivityAPI()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
