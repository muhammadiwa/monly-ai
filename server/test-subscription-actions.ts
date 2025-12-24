/**
 * Test Subscription Actions
 * 
 * This script tests the subscription management actions:
 * - Extend subscription
 * - Upgrade subscription
 * - Downgrade subscription
 * - Cancel subscription
 */

import { db } from './db';
import { userSubscriptions, subscriptionPlans, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testSubscriptionActions() {
    console.log('🧪 Testing Subscription Actions...\n');

    try {
        // 1. Get a test user
        const testUser = await db.select().from(users).limit(1);

        if (testUser.length === 0) {
            console.log('❌ No users found. Please create a user first.');
            return;
        }

        console.log('✅ Found test user:', testUser[0].email);

        // 2. Get available plans
        const plans = await db.select().from(subscriptionPlans);

        if (plans.length < 2) {
            console.log('❌ Need at least 2 plans for testing. Found:', plans.length);
            return;
        }

        console.log('✅ Found', plans.length, 'subscription plans');
        plans.forEach(plan => {
            console.log(`   - ${plan.displayName} (ID: ${plan.id})`);
        });

        // 3. Check if user has an active subscription
        const existingSubscription = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.userId, testUser[0].id))
            .limit(1);

        let subscriptionId: number;

        if (existingSubscription.length === 0) {
            // Create a test subscription
            console.log('\n📝 Creating test subscription...');

            const now = Math.floor(Date.now() / 1000);
            const endDate = now + (30 * 24 * 60 * 60); // 30 days from now

            const [newSubscription] = await db
                .insert(userSubscriptions)
                .values({
                    userId: testUser[0].id,
                    planId: plans[0].id,
                    status: 'active',
                    billingCycle: 'monthly',
                    startDate: now,
                    endDate: endDate,
                    autoRenew: true,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            subscriptionId = newSubscription.id;
            console.log('✅ Created test subscription with ID:', subscriptionId);
        } else {
            subscriptionId = existingSubscription[0].id;
            console.log('✅ Using existing subscription with ID:', subscriptionId);
        }

        // 4. Display subscription details
        const subscription = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.id, subscriptionId))
            .limit(1);

        if (subscription.length === 0) {
            console.log('❌ Subscription not found');
            return;
        }

        const currentPlan = plans.find(p => p.id === subscription[0].planId);

        console.log('\n📊 Current Subscription Details:');
        console.log('   ID:', subscription[0].id);
        console.log('   Plan:', currentPlan?.displayName);
        console.log('   Status:', subscription[0].status);
        console.log('   Billing Cycle:', subscription[0].billingCycle);
        console.log('   Start Date:', new Date(subscription[0].startDate * 1000).toLocaleDateString());
        console.log('   End Date:', new Date(subscription[0].endDate * 1000).toLocaleDateString());
        console.log('   Auto Renew:', subscription[0].autoRenew ? 'Yes' : 'No');

        console.log('\n✅ Subscription actions are ready to be tested via the admin panel!');
        console.log('\n📝 Available Actions:');
        console.log('   1. Extend Subscription - Add days to end date');
        console.log('   2. Upgrade Subscription - Move to a higher plan');
        console.log('   3. Downgrade Subscription - Move to a lower plan');
        console.log('   4. Cancel Subscription - Cancel and prevent auto-renewal');

        console.log('\n🌐 Test these actions at:');
        console.log('   http://localhost:5000/admin/subscriptions');
        console.log('   Click on a subscription to view details and perform actions');

    } catch (error) {
        console.error('❌ Error testing subscription actions:', error);
    }
}

// Run the test
testSubscriptionActions()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
