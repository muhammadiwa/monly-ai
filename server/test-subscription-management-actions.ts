/**
 * Test script for Subscription Management Actions API
 * Tests: extend, upgrade, downgrade, and cancel subscription endpoints
 */

import { db } from './db';
import { users, subscriptionPlans, userSubscriptions, adminUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:5000/api';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

// Helper function to log test results
function logTest(name: string, passed: boolean, error?: string) {
    results.push({ name, passed, error });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (error) {
        console.log(`  Error: ${error}`);
    }
}

// Helper function to make API requests
async function apiRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    token?: string
): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return { status: response.status, data };
}

// Setup test data
async function setupTestData() {
    console.log('\n📦 Setting up test data...\n');

    const now = Math.floor(Date.now() / 1000);

    // Create admin user
    const adminId = `admin-test-${Date.now()}`;
    const adminEmail = `admin-test-${Date.now()}@test.com`;
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await db.insert(adminUsers).values({
        id: adminId,
        email: adminEmail,
        name: 'Test Admin',
        password: hashedPassword,
        role: 'admin',
        createdAt: now,
        updatedAt: now,
    });

    // Create test user
    const userId = `user-test-${Date.now()}`;
    await db.insert(users).values({
        id: userId,
        email: `user-${Date.now()}@test.com`,
        firstName: 'Test',
        lastName: 'User',
        password: 'test123',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
    });

    // Create subscription plans
    const timestamp = Date.now();
    const freePlanId = await db.insert(subscriptionPlans).values({
        name: `free-${timestamp}`,
        displayName: 'Free Plan',
        description: 'Basic features',
        priceMonthly: 0,
        priceYearly: 0,
        currency: 'IDR',
        features: JSON.stringify(['Basic tracking']),
        limits: JSON.stringify({
            transactionLimit: 50,
            accountLimit: 1,
            budgetLimit: 3,
            goalLimit: 3,
            aiInsights: false,
            advancedReports: false,
            prioritySupport: false,
            apiAccess: false,
        }),
        isActive: true,
        createdAt: now,
        updatedAt: now,
    }).returning({ id: subscriptionPlans.id });

    const premiumPlanId = await db.insert(subscriptionPlans).values({
        name: `premium-${timestamp}`,
        displayName: 'Premium Plan',
        description: 'Advanced features',
        priceMonthly: 99000,
        priceYearly: 990000,
        currency: 'IDR',
        features: JSON.stringify(['Unlimited tracking', 'AI insights']),
        limits: JSON.stringify({
            transactionLimit: -1,
            accountLimit: 5,
            budgetLimit: 10,
            goalLimit: 10,
            aiInsights: true,
            advancedReports: true,
            prioritySupport: false,
            apiAccess: false,
        }),
        isActive: true,
        createdAt: now,
        updatedAt: now,
    }).returning({ id: subscriptionPlans.id });

    const businessPlanId = await db.insert(subscriptionPlans).values({
        name: `business-${timestamp}`,
        displayName: 'Business Plan',
        description: 'Enterprise features',
        priceMonthly: 199000,
        priceYearly: 1990000,
        currency: 'IDR',
        features: JSON.stringify(['Everything in Premium', 'Priority support', 'API access']),
        limits: JSON.stringify({
            transactionLimit: -1,
            accountLimit: -1,
            budgetLimit: -1,
            goalLimit: -1,
            aiInsights: true,
            advancedReports: true,
            prioritySupport: true,
            apiAccess: true,
        }),
        isActive: true,
        createdAt: now,
        updatedAt: now,
    }).returning({ id: subscriptionPlans.id });

    // Create active subscription
    const thirtyDaysFromNow = now + (30 * 24 * 60 * 60);
    const subscriptionId = await db.insert(userSubscriptions).values({
        userId: userId,
        planId: freePlanId[0].id,
        status: 'active',
        billingCycle: 'monthly',
        startDate: now,
        endDate: thirtyDaysFromNow,
        autoRenew: true,
        createdAt: now,
        updatedAt: now,
    }).returning({ id: userSubscriptions.id });

    console.log('✅ Test data created successfully\n');

    return {
        adminId,
        adminEmail,
        userId,
        freePlanId: freePlanId[0].id,
        premiumPlanId: premiumPlanId[0].id,
        businessPlanId: businessPlanId[0].id,
        subscriptionId: subscriptionId[0].id,
    };
}

// Cleanup test data
async function cleanupTestData(testData: any) {
    console.log('\n🧹 Cleaning up test data...\n');

    try {
        // Delete in reverse order of creation
        await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, testData.userId));
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, testData.freePlanId));
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, testData.premiumPlanId));
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, testData.businessPlanId));
        await db.delete(users).where(eq(users.id, testData.userId));
        await db.delete(adminUsers).where(eq(adminUsers.id, testData.adminId));

        console.log('✅ Test data cleaned up successfully\n');
    } catch (error) {
        console.error('❌ Error cleaning up test data:', error);
    }
}

// Run tests
async function runTests() {
    console.log('🧪 Starting Subscription Management Actions API Tests\n');
    console.log('='.repeat(60));

    let testData: any;
    let adminToken: string;

    try {
        // Setup
        testData = await setupTestData();

        // Login as admin
        console.log('🔐 Logging in as admin...\n');
        const loginResponse = await apiRequest('/admin/auth/login', 'POST', {
            email: testData.adminEmail,
            password: 'admin123',
        });

        if (loginResponse.status !== 200 || !loginResponse.data.success) {
            throw new Error('Failed to login as admin');
        }

        adminToken = loginResponse.data.token;
        console.log('✅ Admin login successful\n');

        // Test 1: Extend subscription
        console.log('Test 1: Extend Subscription');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/extend`,
                'PUT',
                {
                    days: 30,
                    reason: 'Customer loyalty reward',
                },
                adminToken
            );

            if (response.status === 200 && response.data.success) {
                logTest('Extend subscription', true);
                console.log('  Extended by 30 days');
                console.log(`  New end date: ${new Date(response.data.data.endDate * 1000).toLocaleDateString()}`);
            } else {
                logTest('Extend subscription', false, JSON.stringify(response.data));
            }
        } catch (error: any) {
            logTest('Extend subscription', false, error.message);
        }

        // Test 2: Upgrade subscription
        console.log('\nTest 2: Upgrade Subscription');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/upgrade`,
                'PUT',
                {
                    newPlanId: testData.premiumPlanId,
                },
                adminToken
            );

            if (response.status === 200 && response.data.success) {
                logTest('Upgrade subscription', true);
                console.log(`  Upgraded to: ${response.data.data.plan.displayName}`);
            } else {
                logTest('Upgrade subscription', false, JSON.stringify(response.data));
            }
        } catch (error: any) {
            logTest('Upgrade subscription', false, error.message);
        }

        // Test 3: Downgrade subscription
        console.log('\nTest 3: Downgrade Subscription');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/downgrade`,
                'PUT',
                {
                    newPlanId: testData.freePlanId,
                },
                adminToken
            );

            if (response.status === 200 && response.data.success) {
                logTest('Downgrade subscription', true);
                console.log(`  Downgraded to: ${response.data.data.plan.displayName}`);
            } else {
                logTest('Downgrade subscription', false, JSON.stringify(response.data));
            }
        } catch (error: any) {
            logTest('Downgrade subscription', false, error.message);
        }

        // Test 4: Cancel subscription
        console.log('\nTest 4: Cancel Subscription');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/cancel`,
                'PUT',
                {
                    reason: 'User requested cancellation',
                },
                adminToken
            );

            if (response.status === 200 && response.data.success) {
                logTest('Cancel subscription', true);
                console.log('  Subscription cancelled successfully');
            } else {
                logTest('Cancel subscription', false, JSON.stringify(response.data));
            }
        } catch (error: any) {
            logTest('Cancel subscription', false, error.message);
        }

        // Test 5: Validation - Invalid subscription ID
        console.log('\nTest 5: Validation - Invalid Subscription ID');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/invalid/extend`,
                'PUT',
                {
                    days: 30,
                    reason: 'Test',
                },
                adminToken
            );

            if (response.status === 400 && response.data.error?.code === 'VALIDATION_ERROR') {
                logTest('Invalid subscription ID validation', true);
            } else {
                logTest('Invalid subscription ID validation', false, 'Should return 400 validation error');
            }
        } catch (error: any) {
            logTest('Invalid subscription ID validation', false, error.message);
        }

        // Test 6: Validation - Missing reason for extend
        console.log('\nTest 6: Validation - Missing Reason for Extend');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/extend`,
                'PUT',
                {
                    days: 30,
                },
                adminToken
            );

            if (response.status === 400 && response.data.error?.code === 'VALIDATION_ERROR') {
                logTest('Missing reason validation', true);
            } else {
                logTest('Missing reason validation', false, 'Should return 400 validation error');
            }
        } catch (error: any) {
            logTest('Missing reason validation', false, error.message);
        }

        // Test 7: Validation - Invalid days value
        console.log('\nTest 7: Validation - Invalid Days Value');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/extend`,
                'PUT',
                {
                    days: 0,
                    reason: 'Test',
                },
                adminToken
            );

            if (response.status === 400 && response.data.error?.code === 'VALIDATION_ERROR') {
                logTest('Invalid days value validation', true);
            } else {
                logTest('Invalid days value validation', false, 'Should return 400 validation error');
            }
        } catch (error: any) {
            logTest('Invalid days value validation', false, error.message);
        }

        // Test 8: Authorization - No token
        console.log('\nTest 8: Authorization - No Token');
        console.log('-'.repeat(60));
        try {
            const response = await apiRequest(
                `/admin/subscriptions/${testData.subscriptionId}/extend`,
                'PUT',
                {
                    days: 30,
                    reason: 'Test',
                }
            );

            if (response.status === 401 && response.data.error?.code === 'UNAUTHORIZED') {
                logTest('No token authorization', true);
            } else {
                logTest('No token authorization', false, 'Should return 401 unauthorized');
            }
        } catch (error: any) {
            logTest('No token authorization', false, error.message);
        }

    } catch (error: any) {
        console.error('\n❌ Test suite failed:', error.message);
    } finally {
        // Cleanup
        if (testData) {
            await cleanupTestData(testData);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}`);
            if (r.error) {
                console.log(`    ${r.error}`);
            }
        });
    }

    console.log('\n' + '='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
