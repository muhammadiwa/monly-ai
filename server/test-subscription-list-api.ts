/**
 * Test script for Subscription List API endpoint
 * Tests GET /api/admin/subscriptions with pagination, search, and filtering
 */

import { db } from './db';
import { adminUsers, users, subscriptionPlans, userSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function testSubscriptionListAPI() {
    console.log('🧪 Testing Subscription List API...\n');

    try {
        // 1. Setup: Create test admin user
        console.log('1️⃣ Setting up test admin user...');
        const adminId = 'test-admin-' + Date.now();
        const adminEmail = `admin-${Date.now()}@test.com`;
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);

        await db.insert(adminUsers).values({
            id: adminId,
            email: adminEmail,
            name: 'Test Admin',
            password: hashedPassword,
            role: 'admin',
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
        });
        console.log('✅ Test admin created:', adminEmail);

        // 2. Login to get admin token
        console.log('\n2️⃣ Logging in as admin...');
        const loginResponse = await fetch('http://localhost:5000/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: adminEmail,
                password: 'TestPassword123!',
            }),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Admin logged in successfully');

        // 3. Setup: Create test users and subscriptions
        console.log('\n3️⃣ Setting up test data...');

        // Get existing plans
        const plans = await db.select().from(subscriptionPlans);
        if (plans.length === 0) {
            throw new Error('No subscription plans found. Run seed-admin-data.ts first.');
        }
        console.log(`✅ Found ${plans.length} subscription plans`);

        // Create test users with subscriptions
        const testUsers = [];
        const testSubscriptions = [];
        const now = Math.floor(Date.now() / 1000);

        for (let i = 0; i < 5; i++) {
            const userId = `test-user-sub-${Date.now()}-${i}`;
            const userEmail = `user-sub-${Date.now()}-${i}@test.com`;

            // Create user
            await db.insert(users).values({
                id: userId,
                email: userEmail,
                firstName: `Test${i}`,
                lastName: `User${i}`,
                password: await bcrypt.hash('password123', 10),
                subscriptionStatus: 'active',
                subscriptionPlanId: plans[i % plans.length].id,
                createdAt: now - (i * 86400), // Stagger creation dates
                updatedAt: now,
            });
            testUsers.push({ id: userId, email: userEmail });

            // Create subscription
            const billingCycle = i % 2 === 0 ? 'monthly' : 'yearly';
            const status = i === 4 ? 'cancelled' : 'active'; // Last one is cancelled

            const subscriptionResult = await db.insert(userSubscriptions).values({
                userId: userId,
                planId: plans[i % plans.length].id,
                status: status,
                billingCycle: billingCycle,
                startDate: now - (30 * 86400), // Started 30 days ago
                endDate: now + (30 * 86400), // Ends in 30 days
                autoRenew: i !== 4, // Last one doesn't auto-renew
                cancelledAt: i === 4 ? now - (5 * 86400) : null,
                cancellationReason: i === 4 ? 'Test cancellation' : null,
                createdAt: now - (i * 86400),
                updatedAt: now,
            }).returning();

            testSubscriptions.push(subscriptionResult[0]);
        }
        console.log(`✅ Created ${testUsers.length} test users with subscriptions`);

        // 4. Test: Get all subscriptions (no filters)
        console.log('\n4️⃣ Testing GET /api/admin/subscriptions (no filters)...');
        const allSubsResponse = await fetch('http://localhost:5000/api/admin/subscriptions?page=1&limit=10', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!allSubsResponse.ok) {
            throw new Error(`Failed to fetch subscriptions: ${allSubsResponse.status} ${await allSubsResponse.text()}`);
        }

        const allSubsData = await allSubsResponse.json();
        console.log('✅ Response:', JSON.stringify(allSubsData, null, 2));

        if (!allSubsData.success) {
            throw new Error('Response success is false');
        }
        if (!allSubsData.data.subscriptions || !Array.isArray(allSubsData.data.subscriptions)) {
            throw new Error('Response does not contain subscriptions array');
        }
        console.log(`✅ Found ${allSubsData.data.subscriptions.length} subscriptions`);
        console.log(`✅ Total: ${allSubsData.data.total}, Page: ${allSubsData.data.page}, Total Pages: ${allSubsData.data.totalPages}`);

        // 5. Test: Search by user email
        console.log('\n5️⃣ Testing search by user email...');
        const searchEmail = testUsers[0].email.split('@')[0]; // Get part before @
        const searchResponse = await fetch(`http://localhost:5000/api/admin/subscriptions?search=${searchEmail}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!searchResponse.ok) {
            throw new Error(`Search failed: ${searchResponse.status} ${await searchResponse.text()}`);
        }

        const searchData = await searchResponse.json();
        console.log('✅ Search results:', JSON.stringify(searchData.data, null, 2));

        if (searchData.data.subscriptions.length === 0) {
            console.log('⚠️  Warning: Search returned no results');
        } else {
            console.log(`✅ Found ${searchData.data.subscriptions.length} subscriptions matching search`);
        }

        // 6. Test: Filter by status
        console.log('\n6️⃣ Testing filter by status (active)...');
        const statusResponse = await fetch('http://localhost:5000/api/admin/subscriptions?status=active', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!statusResponse.ok) {
            throw new Error(`Status filter failed: ${statusResponse.status} ${await statusResponse.text()}`);
        }

        const statusData = await statusResponse.json();
        console.log('✅ Active subscriptions:', statusData.data.total);

        // Verify all returned subscriptions are active
        const allActive = statusData.data.subscriptions.every((sub: any) => sub.status === 'active');
        if (!allActive) {
            throw new Error('Not all returned subscriptions have active status');
        }
        console.log('✅ All returned subscriptions have active status');

        // 7. Test: Filter by plan
        console.log('\n7️⃣ Testing filter by plan...');
        const planName = plans[0].name;
        const planResponse = await fetch(`http://localhost:5000/api/admin/subscriptions?plan=${planName}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!planResponse.ok) {
            throw new Error(`Plan filter failed: ${planResponse.status} ${await planResponse.text()}`);
        }

        const planData = await planResponse.json();
        console.log(`✅ Subscriptions for plan "${planName}":`, planData.data.total);

        // Verify all returned subscriptions are for the specified plan
        if (planData.data.subscriptions.length > 0) {
            const allMatchPlan = planData.data.subscriptions.every((sub: any) => sub.plan.name === planName);
            if (!allMatchPlan) {
                throw new Error('Not all returned subscriptions match the specified plan');
            }
            console.log('✅ All returned subscriptions match the specified plan');
        }

        // 8. Test: Pagination
        console.log('\n8️⃣ Testing pagination...');
        const page1Response = await fetch('http://localhost:5000/api/admin/subscriptions?page=1&limit=2', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!page1Response.ok) {
            throw new Error(`Pagination failed: ${page1Response.status} ${await page1Response.text()}`);
        }

        const page1Data = await page1Response.json();
        console.log(`✅ Page 1: ${page1Data.data.subscriptions.length} subscriptions`);
        console.log(`✅ Total pages: ${page1Data.data.totalPages}`);

        if (page1Data.data.totalPages > 1) {
            const page2Response = await fetch('http://localhost:5000/api/admin/subscriptions?page=2&limit=2', {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!page2Response.ok) {
                throw new Error(`Page 2 failed: ${page2Response.status} ${await page2Response.text()}`);
            }

            const page2Data = await page2Response.json();
            console.log(`✅ Page 2: ${page2Data.data.subscriptions.length} subscriptions`);

            // Verify different subscriptions on different pages
            const page1Ids = page1Data.data.subscriptions.map((s: any) => s.id);
            const page2Ids = page2Data.data.subscriptions.map((s: any) => s.id);
            const overlap = page1Ids.some((id: number) => page2Ids.includes(id));
            if (overlap) {
                throw new Error('Pages contain overlapping subscriptions');
            }
            console.log('✅ Pages contain different subscriptions');
        }

        // 9. Test: Verify subscription data structure
        console.log('\n9️⃣ Testing subscription data structure...');
        if (allSubsData.data.subscriptions.length > 0) {
            const subscription = allSubsData.data.subscriptions[0];
            console.log('Sample subscription:', JSON.stringify(subscription, null, 2));

            // Verify required fields
            const requiredFields = ['id', 'userId', 'user', 'plan', 'status', 'billingCycle', 'startDate', 'endDate', 'autoRenew', 'createdAt'];
            for (const field of requiredFields) {
                if (!(field in subscription)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            console.log('✅ All required fields present');

            // Verify user object structure
            if (!subscription.user.id || !subscription.user.email || !subscription.user.name) {
                throw new Error('User object missing required fields');
            }
            console.log('✅ User object structure valid');

            // Verify plan object structure
            if (!subscription.plan.id || !subscription.plan.name || !subscription.plan.displayName) {
                throw new Error('Plan object missing required fields');
            }
            console.log('✅ Plan object structure valid');
        }

        // 10. Test: Invalid parameters
        console.log('\n🔟 Testing invalid parameters...');

        // Invalid limit
        const invalidLimitResponse = await fetch('http://localhost:5000/api/admin/subscriptions?limit=200', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (invalidLimitResponse.ok) {
            throw new Error('Should reject limit > 100');
        }
        console.log('✅ Correctly rejects invalid limit parameter');

        // Invalid status
        const invalidStatusResponse = await fetch('http://localhost:5000/api/admin/subscriptions?status=invalid', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (invalidStatusResponse.ok) {
            throw new Error('Should reject invalid status');
        }
        console.log('✅ Correctly rejects invalid status parameter');

        // 11. Test: Unauthorized access
        console.log('\n1️⃣1️⃣ Testing unauthorized access...');
        const unauthorizedResponse = await fetch('http://localhost:5000/api/admin/subscriptions', {
            headers: { 'Authorization': 'Bearer invalid-token' },
        });
        if (unauthorizedResponse.ok) {
            throw new Error('Should reject invalid token');
        }
        console.log('✅ Correctly rejects unauthorized access');

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        try {
            // Delete subscriptions first (foreign key constraint)
            for (const user of testUsers) {
                await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, user.id));
            }
            console.log('✅ Subscriptions deleted');

            // Then delete users
            for (const user of testUsers) {
                await db.delete(users).where(eq(users.id, user.id));
            }
            console.log('✅ Users deleted');

            await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
            console.log('✅ Admin user deleted');
            console.log('✅ Test data cleaned up');
        } catch (cleanupError) {
            console.error('⚠️  Cleanup error (non-critical):', cleanupError);
            console.log('⚠️  Some test data may remain in database');
        }

        console.log('\n✅ All Subscription List API tests passed! 🎉');
        return true;

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testSubscriptionListAPI()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
