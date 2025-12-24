/**
 * Test Subscription Actions API
 * 
 * This script tests all subscription management action endpoints:
 * - PUT /api/admin/subscriptions/:id/extend
 * - PUT /api/admin/subscriptions/:id/upgrade
 * - PUT /api/admin/subscriptions/:id/downgrade
 * - PUT /api/admin/subscriptions/:id/cancel
 */

import { db } from './db';
import { userSubscriptions, subscriptionPlans, users, adminUsers } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function testSubscriptionActionsAPI() {
    console.log('🧪 Testing Subscription Actions API...\n');

    try {
        // 1. Get or create admin user
        let admin = await db.select().from(adminUsers).where(eq(adminUsers.email, 'admin@test.com')).limit(1);

        if (admin.length === 0) {
            console.log('📝 Creating test admin user...');
            const hashedPassword = await bcrypt.hash('admin123', 12);
            const now = Math.floor(Date.now() / 1000);

            const [newAdmin] = await db.insert(adminUsers).values({
                id: `admin-${Date.now()}`,
                email: 'admin@test.com',
                name: 'Test Admin',
                password: hashedPassword,
                role: 'admin',
                createdAt: now,
                updatedAt: now,
            }).returning();

            admin = [newAdmin];
            console.log('✅ Created admin user');
        } else {
            console.log('✅ Using existing admin user');
        }

        // Generate admin token
        const adminToken = jwt.sign(
            { id: admin[0].id, email: admin[0].email, role: admin[0].role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        console.log('✅ Generated admin token\n');

        // 2. Get test user and subscription
        const testUser = await db.select().from(users).limit(1);

        if (testUser.length === 0) {
            console.log('❌ No users found');
            return;
        }

        const subscription = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.userId, testUser[0].id))
            .limit(1);

        if (subscription.length === 0) {
            console.log('❌ No subscription found for user');
            return;
        }

        const subscriptionId = subscription[0].id;
        console.log('📊 Testing with subscription ID:', subscriptionId);
        console.log('   User:', testUser[0].email);
        console.log('   Current Status:', subscription[0].status);
        console.log('   Current End Date:', new Date(subscription[0].endDate * 1000).toLocaleDateString());

        // 3. Test Extend Subscription
        console.log('\n🧪 Test 1: Extend Subscription');
        try {
            const extendResponse = await fetch(`http://localhost:5000/api/admin/subscriptions/${subscriptionId}/extend`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    days: 15,
                    reason: 'Test extension via API'
                }),
            });

            if (extendResponse.ok) {
                const extendData = await extendResponse.json();
                console.log('✅ Extend subscription successful');
                console.log('   New End Date:', new Date(extendData.data.endDate * 1000).toLocaleDateString());
            } else {
                const error = await extendResponse.json();
                console.log('❌ Extend failed:', error.error?.message);
            }
        } catch (error) {
            console.log('⚠️  Server not running. Start server with: npm run dev');
        }

        // 4. Test Upgrade Subscription
        console.log('\n🧪 Test 2: Upgrade Subscription');
        const plans = await db.select().from(subscriptionPlans);
        const currentPlan = plans.find(p => p.id === subscription[0].planId);
        const higherPlan = plans.find(p => p.id !== subscription[0].planId && p.id > subscription[0].planId);

        if (higherPlan) {
            try {
                const upgradeResponse = await fetch(`http://localhost:5000/api/admin/subscriptions/${subscriptionId}/upgrade`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        planId: higherPlan.id,
                        reason: 'Test upgrade via API'
                    }),
                });

                if (upgradeResponse.ok) {
                    const upgradeData = await upgradeResponse.json();
                    console.log('✅ Upgrade subscription successful');
                    console.log('   From:', currentPlan?.displayName);
                    console.log('   To:', higherPlan.displayName);
                } else {
                    const error = await upgradeResponse.json();
                    console.log('❌ Upgrade failed:', error.error?.message);
                }
            } catch (error) {
                console.log('⚠️  Server not running');
            }
        } else {
            console.log('⚠️  No higher plan available for upgrade test');
        }

        // 5. Test Downgrade Subscription
        console.log('\n🧪 Test 3: Downgrade Subscription');
        const lowerPlan = plans.find(p => p.id !== subscription[0].planId && p.id < subscription[0].planId);

        if (lowerPlan) {
            try {
                const downgradeResponse = await fetch(`http://localhost:5000/api/admin/subscriptions/${subscriptionId}/downgrade`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        planId: lowerPlan.id,
                        reason: 'Test downgrade via API'
                    }),
                });

                if (downgradeResponse.ok) {
                    const downgradeData = await downgradeResponse.json();
                    console.log('✅ Downgrade subscription successful');
                    console.log('   To:', lowerPlan.displayName);
                } else {
                    const error = await downgradeResponse.json();
                    console.log('❌ Downgrade failed:', error.error?.message);
                }
            } catch (error) {
                console.log('⚠️  Server not running');
            }
        } else {
            console.log('⚠️  No lower plan available for downgrade test');
        }

        // 6. Test Cancel Subscription
        console.log('\n🧪 Test 4: Cancel Subscription');
        try {
            const cancelResponse = await fetch(`http://localhost:5000/api/admin/subscriptions/${subscriptionId}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reason: 'Test cancellation via API'
                }),
            });

            if (cancelResponse.ok) {
                const cancelData = await cancelResponse.json();
                console.log('✅ Cancel subscription successful');
                console.log('   Status:', cancelData.data.status);
                console.log('   Auto Renew:', cancelData.data.autoRenew ? 'Yes' : 'No');
            } else {
                const error = await cancelResponse.json();
                console.log('❌ Cancel failed:', error.error?.message);
            }
        } catch (error) {
            console.log('⚠️  Server not running');
        }

        console.log('\n✅ All subscription action tests completed!');
        console.log('\n📝 Summary:');
        console.log('   - Extend: Adds days to subscription end date');
        console.log('   - Upgrade: Changes to a higher-tier plan');
        console.log('   - Downgrade: Changes to a lower-tier plan');
        console.log('   - Cancel: Cancels subscription and disables auto-renewal');

    } catch (error) {
        console.error('❌ Error testing subscription actions API:', error);
    }
}

// Run the test
testSubscriptionActionsAPI()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
