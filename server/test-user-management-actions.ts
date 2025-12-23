/**
 * Test script for User Management Actions API
 * Tests suspend, activate, and delete user endpoints
 */

import { db } from './db';
import { users, userSubscriptions, subscriptionPlans } from '@shared/schema';
import { eq } from 'drizzle-orm';

const API_BASE = 'http://localhost:5000/api';

// Test admin credentials
const ADMIN_EMAIL = 'admin@monly.app';
const ADMIN_PASSWORD = 'Admin123!@#';

interface TestResult {
    test: string;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

function logResult(test: string, passed: boolean, message: string) {
    results.push({ test, passed, message });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
}

async function adminLogin(): Promise<string> {
    const response = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
        }),
    });

    const data = await response.json();
    if (!data.success || !data.token) {
        throw new Error('Admin login failed');
    }

    return data.token;
}

async function createTestUser(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const testUserId = `test-user-${Date.now()}`;

    await db.insert(users).values({
        id: testUserId,
        email: `${testUserId}@test.com`,
        firstName: 'Test',
        lastName: 'User',
        password: 'test123',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
    });

    console.log(`Created test user: ${testUserId}`);
    return testUserId;
}

async function createTestSubscription(userId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysLater = now + (30 * 24 * 60 * 60);

    // Get free plan ID
    const [freePlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, 'free'))
        .limit(1);

    if (!freePlan) {
        throw new Error('Free plan not found');
    }

    await db.insert(userSubscriptions).values({
        userId,
        planId: freePlan.id,
        status: 'active',
        billingCycle: 'monthly',
        startDate: now,
        endDate: thirtyDaysLater,
        autoRenew: true,
        createdAt: now,
        updatedAt: now,
    });

    console.log(`Created test subscription for user: ${userId}`);
}

async function cleanupTestUser(userId: string): Promise<void> {
    // Delete subscriptions
    await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));

    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    console.log(`Cleaned up test user: ${userId}`);
}

async function testSuspendUser(token: string, userId: string): Promise<void> {
    console.log('\n--- Testing Suspend User ---');

    // Test suspend without reason (should fail)
    const response1 = await fetch(`${API_BASE}/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
    });

    const data1 = await response1.json();
    logResult(
        'Suspend without reason',
        !data1.success && data1.error?.code === 'VALIDATION_ERROR',
        data1.success ? 'Should have failed validation' : 'Correctly rejected'
    );

    // Test suspend with reason (should succeed)
    const response2 = await fetch(`${API_BASE}/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            reason: 'Violation of terms of service',
        }),
    });

    const data2 = await response2.json();
    logResult(
        'Suspend with reason',
        data2.success === true,
        data2.success ? 'User suspended successfully' : `Failed: ${data2.error?.message}`
    );

    // Verify user status in database
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

    logResult(
        'User status updated to suspended',
        user.subscriptionStatus === 'suspended',
        user.subscriptionStatus === 'suspended' ? 'Status correctly updated' : `Status is ${user.subscriptionStatus}`
    );

    // Verify subscriptions cancelled
    const subscriptions = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId));

    const allCancelled = subscriptions.every(sub => sub.status === 'cancelled');
    logResult(
        'Subscriptions cancelled',
        allCancelled,
        allCancelled ? 'All subscriptions cancelled' : 'Some subscriptions still active'
    );
}

async function testActivateUser(token: string, userId: string): Promise<void> {
    console.log('\n--- Testing Activate User ---');

    // Test activate user (should succeed)
    const response = await fetch(`${API_BASE}/admin/users/${userId}/activate`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await response.json();
    logResult(
        'Activate user',
        data.success === true,
        data.success ? 'User activated successfully' : `Failed: ${data.error?.message}`
    );

    // Verify user status in database
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

    logResult(
        'User status updated to active',
        user.subscriptionStatus === 'active',
        user.subscriptionStatus === 'active' ? 'Status correctly updated' : `Status is ${user.subscriptionStatus}`
    );
}

async function testDeleteUser(token: string, userId: string): Promise<void> {
    console.log('\n--- Testing Delete User ---');

    // Test delete without reason (should fail)
    const response1 = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
    });

    const data1 = await response1.json();
    logResult(
        'Delete without reason',
        !data1.success && data1.error?.code === 'VALIDATION_ERROR',
        data1.success ? 'Should have failed validation' : 'Correctly rejected'
    );

    // Test delete with reason (should succeed)
    const response2 = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            reason: 'User requested account deletion',
        }),
    });

    const data2 = await response2.json();
    logResult(
        'Delete with reason',
        data2.success === true,
        data2.success ? 'User deleted successfully' : `Failed: ${data2.error?.message}`
    );

    // Verify user data anonymized in database
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

    logResult(
        'User status updated to deleted',
        user.subscriptionStatus === 'deleted',
        user.subscriptionStatus === 'deleted' ? 'Status correctly updated' : `Status is ${user.subscriptionStatus}`
    );

    logResult(
        'User email anonymized',
        user.email?.includes('deleted'),
        user.email?.includes('deleted') ? 'Email anonymized' : `Email is ${user.email}`
    );

    logResult(
        'User name anonymized',
        user.firstName === 'Deleted' && user.lastName === 'User',
        user.firstName === 'Deleted' ? 'Name anonymized' : `Name is ${user.firstName} ${user.lastName}`
    );
}

async function testNonExistentUser(token: string): Promise<void> {
    console.log('\n--- Testing Non-Existent User ---');

    const fakeUserId = 'non-existent-user-id';

    // Test suspend non-existent user
    const response1 = await fetch(`${API_BASE}/admin/users/${fakeUserId}/suspend`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Test' }),
    });

    const data1 = await response1.json();
    logResult(
        'Suspend non-existent user',
        !data1.success && data1.error?.code === 'RESOURCE_NOT_FOUND',
        data1.error?.code === 'RESOURCE_NOT_FOUND' ? 'Correctly returned 404' : 'Should have returned 404'
    );

    // Test activate non-existent user
    const response2 = await fetch(`${API_BASE}/admin/users/${fakeUserId}/activate`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    const data2 = await response2.json();
    logResult(
        'Activate non-existent user',
        !data2.success && data2.error?.code === 'RESOURCE_NOT_FOUND',
        data2.error?.code === 'RESOURCE_NOT_FOUND' ? 'Correctly returned 404' : 'Should have returned 404'
    );

    // Test delete non-existent user
    const response3 = await fetch(`${API_BASE}/admin/users/${fakeUserId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Test' }),
    });

    const data3 = await response3.json();
    logResult(
        'Delete non-existent user',
        !data3.success && data3.error?.code === 'RESOURCE_NOT_FOUND',
        data3.error?.code === 'RESOURCE_NOT_FOUND' ? 'Correctly returned 404' : 'Should have returned 404'
    );
}

async function testUnauthorizedAccess(): Promise<void> {
    console.log('\n--- Testing Unauthorized Access ---');

    const testUserId = 'any-user-id';

    // Test suspend without token
    const response1 = await fetch(`${API_BASE}/admin/users/${testUserId}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test' }),
    });

    const data1 = await response1.json();
    logResult(
        'Suspend without auth token',
        !data1.success && (data1.error?.code === 'UNAUTHORIZED' || response1.status === 401),
        data1.error?.code === 'UNAUTHORIZED' ? 'Correctly returned unauthorized error' : `Returned ${response1.status}`
    );

    // Test activate without token
    const response2 = await fetch(`${API_BASE}/admin/users/${testUserId}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
    });

    const data2 = await response2.json();
    logResult(
        'Activate without auth token',
        !data2.success && (data2.error?.code === 'UNAUTHORIZED' || response2.status === 401),
        data2.error?.code === 'UNAUTHORIZED' ? 'Correctly returned unauthorized error' : `Returned ${response2.status}`
    );

    // Test delete without token
    const response3 = await fetch(`${API_BASE}/admin/users/${testUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test' }),
    });

    const data3 = await response3.json();
    logResult(
        'Delete without auth token',
        !data3.success && (data3.error?.code === 'UNAUTHORIZED' || response3.status === 401),
        data3.error?.code === 'UNAUTHORIZED' ? 'Correctly returned unauthorized error' : `Returned ${response3.status}`
    );
}

async function runTests() {
    console.log('🧪 Testing User Management Actions API\n');
    console.log('='.repeat(60));

    let token: string;
    let testUserId: string;

    try {
        // Login as admin
        console.log('\n📝 Logging in as admin...');
        token = await adminLogin();
        console.log('✅ Admin login successful\n');

        // Test unauthorized access
        await testUnauthorizedAccess();

        // Create test user
        console.log('\n📝 Creating test user...');
        testUserId = await createTestUser();
        await createTestSubscription(testUserId);

        // Run tests
        await testSuspendUser(token, testUserId);
        await testActivateUser(token, testUserId);
        await testDeleteUser(token, testUserId);
        await testNonExistentUser(token);

        // Cleanup
        console.log('\n📝 Cleaning up test data...');
        await cleanupTestUser(testUserId);

    } catch (error) {
        console.error('\n❌ Test execution failed:', error);

        // Try to cleanup if test user was created
        if (testUserId) {
            try {
                await cleanupTestUser(testUserId);
            } catch (cleanupError) {
                console.error('Failed to cleanup test user:', cleanupError);
            }
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.test}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
