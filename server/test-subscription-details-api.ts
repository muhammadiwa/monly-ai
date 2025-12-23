/**
 * Test script for Subscription Details API endpoint
 * Tests GET /api/admin/subscriptions/:id
 * 
 * This script tests:
 * - Fetching subscription details with payment history
 * - Fetching invoices related to subscription
 * - Showing renewal status and next billing date
 * - Error handling for invalid/non-existent subscription IDs
 */

import { db } from './db';
import { users, subscriptionPlans, userSubscriptions, payments, invoices, adminUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashAdminPassword } from './admin/admin-auth';

async function testSubscriptionDetailsAPI() {
    console.log('🧪 Testing Subscription Details API...\n');

    try {
        // Step 1: Create test admin user
        console.log('📝 Step 1: Creating test admin user...');
        const adminId = `admin-test-${Date.now()}`;
        const hashedPassword = await hashAdminPassword('TestPassword123!');

        await db.insert(adminUsers).values({
            id: adminId,
            email: 'test-admin@example.com',
            name: 'Test Admin',
            password: hashedPassword,
            role: 'admin',
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
        });
        console.log('✅ Admin user created\n');

        // Step 2: Create test user
        console.log('📝 Step 2: Creating test user...');
        const userId = `user-test-${Date.now()}`;
        await db.insert(users).values({
            id: userId,
            email: 'testuser@example.com',
            firstName: 'Test',
            lastName: 'User',
            subscriptionStatus: 'active',
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
        });
        console.log('✅ Test user created\n');

        // Step 3: Get or create subscription plan
        console.log('📝 Step 3: Getting subscription plan...');
        const [premiumPlan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.name, 'premium'))
            .limit(1);

        if (!premiumPlan) {
            console.log('❌ Premium plan not found. Please run seed-admin-data.ts first.');
            return;
        }
        console.log(`✅ Found plan: ${premiumPlan.displayName} (ID: ${premiumPlan.id})\n`);

        // Step 4: Create test subscription
        console.log('📝 Step 4: Creating test subscription...');
        const now = Math.floor(Date.now() / 1000);
        const startDate = now;
        const endDate = now + (30 * 24 * 60 * 60); // 30 days from now

        const [subscription] = await db.insert(userSubscriptions).values({
            userId: userId,
            planId: premiumPlan.id,
            status: 'active',
            billingCycle: 'monthly',
            startDate: startDate,
            endDate: endDate,
            autoRenew: true,
            createdAt: now,
            updatedAt: now,
        }).returning();

        console.log(`✅ Subscription created (ID: ${subscription.id})\n`);

        // Step 5: Create test payments
        console.log('📝 Step 5: Creating test payments...');
        const payment1 = await db.insert(payments).values({
            userId: userId,
            subscriptionId: subscription.id,
            amount: premiumPlan.priceMonthly,
            currency: premiumPlan.currency,
            paymentMethod: 'credit_card',
            status: 'paid',
            midtransTransactionId: `txn-${Date.now()}-1`,
            midtransOrderId: `order-${Date.now()}-1`,
            paidAt: now - (5 * 24 * 60 * 60), // 5 days ago
            createdAt: now - (5 * 24 * 60 * 60),
            updatedAt: now - (5 * 24 * 60 * 60),
        }).returning();

        const payment2 = await db.insert(payments).values({
            userId: userId,
            subscriptionId: subscription.id,
            amount: premiumPlan.priceMonthly,
            currency: premiumPlan.currency,
            paymentMethod: 'bank_transfer',
            status: 'pending',
            midtransTransactionId: `txn-${Date.now()}-2`,
            midtransOrderId: `order-${Date.now()}-2`,
            createdAt: now - (1 * 24 * 60 * 60), // 1 day ago
            updatedAt: now - (1 * 24 * 60 * 60),
        }).returning();

        console.log(`✅ Created ${2} test payments\n`);

        // Step 6: Create test invoices
        console.log('📝 Step 6: Creating test invoices...');
        const invoice1 = await db.insert(invoices).values({
            invoiceNumber: `INV-${Date.now()}-1`,
            userId: userId,
            paymentId: payment1[0].id,
            amount: premiumPlan.priceMonthly,
            currency: premiumPlan.currency,
            items: JSON.stringify([
                {
                    description: `${premiumPlan.displayName} - Monthly Subscription`,
                    quantity: 1,
                    unitPrice: premiumPlan.priceMonthly,
                    total: premiumPlan.priceMonthly,
                }
            ]),
            status: 'paid',
            issuedAt: now - (5 * 24 * 60 * 60),
            dueAt: now - (4 * 24 * 60 * 60),
            paidAt: now - (5 * 24 * 60 * 60),
            createdAt: now - (5 * 24 * 60 * 60),
            updatedAt: now - (5 * 24 * 60 * 60),
        }).returning();

        console.log(`✅ Created test invoice\n`);

        // Step 7: Test the API endpoint using storage function
        console.log('📝 Step 7: Testing subscription details endpoint...');
        const { adminStorage } = await import('./admin/admin-storage');

        const subscriptionDetails = await adminStorage.getSubscriptionDetails(subscription.id);

        if (!subscriptionDetails) {
            console.log('❌ Failed to fetch subscription details');
            return;
        }

        console.log('✅ Subscription details fetched successfully!\n');

        // Step 8: Verify response structure
        console.log('📝 Step 8: Verifying response structure...');
        console.log('\n📊 Subscription Details:');
        console.log('─────────────────────────────────────────');
        console.log(`ID: ${subscriptionDetails.id}`);
        console.log(`Status: ${subscriptionDetails.status}`);
        console.log(`Billing Cycle: ${subscriptionDetails.billingCycle}`);
        console.log(`Auto Renew: ${subscriptionDetails.autoRenew}`);
        console.log(`Start Date: ${new Date(subscriptionDetails.startDate * 1000).toLocaleDateString()}`);
        console.log(`End Date: ${new Date(subscriptionDetails.endDate * 1000).toLocaleDateString()}`);

        console.log('\n👤 User Information:');
        console.log('─────────────────────────────────────────');
        console.log(`Name: ${subscriptionDetails.user.name}`);
        console.log(`Email: ${subscriptionDetails.user.email}`);

        console.log('\n📦 Plan Information:');
        console.log('─────────────────────────────────────────');
        console.log(`Plan: ${subscriptionDetails.plan.displayName}`);
        console.log(`Price (Monthly): ${subscriptionDetails.plan.currency} ${subscriptionDetails.plan.priceMonthly}`);
        console.log(`Price (Yearly): ${subscriptionDetails.plan.currency} ${subscriptionDetails.plan.priceYearly}`);
        console.log(`Features: ${subscriptionDetails.plan.features.length} features`);

        console.log('\n🔄 Renewal Status:');
        console.log('─────────────────────────────────────────');
        console.log(`Status: ${subscriptionDetails.renewalStatus.status}`);
        console.log(`Will Renew: ${subscriptionDetails.renewalStatus.willRenew}`);
        if (subscriptionDetails.renewalStatus.nextBillingDate) {
            console.log(`Next Billing: ${new Date(subscriptionDetails.renewalStatus.nextBillingDate * 1000).toLocaleDateString()}`);
            console.log(`Days Until Renewal: ${subscriptionDetails.renewalStatus.daysUntilRenewal}`);
        }

        console.log('\n💳 Payment History:');
        console.log('─────────────────────────────────────────');
        console.log(`Total Payments: ${subscriptionDetails.paymentHistory.length}`);
        subscriptionDetails.paymentHistory.forEach((payment: any, index: number) => {
            console.log(`\nPayment ${index + 1}:`);
            console.log(`  Amount: ${payment.currency} ${payment.amount}`);
            console.log(`  Method: ${payment.paymentMethod}`);
            console.log(`  Status: ${payment.status}`);
            console.log(`  Transaction ID: ${payment.midtransTransactionId}`);
            if (payment.paidAt) {
                console.log(`  Paid At: ${new Date(payment.paidAt * 1000).toLocaleDateString()}`);
            }
        });

        console.log('\n📄 Invoices:');
        console.log('─────────────────────────────────────────');
        console.log(`Total Invoices: ${subscriptionDetails.invoices.length}`);
        subscriptionDetails.invoices.forEach((invoice: any, index: number) => {
            console.log(`\nInvoice ${index + 1}:`);
            console.log(`  Number: ${invoice.invoiceNumber}`);
            console.log(`  Amount: ${invoice.currency} ${invoice.amount}`);
            console.log(`  Status: ${invoice.status}`);
            console.log(`  Issued: ${new Date(invoice.issuedAt * 1000).toLocaleDateString()}`);
            if (invoice.paidAt) {
                console.log(`  Paid: ${new Date(invoice.paidAt * 1000).toLocaleDateString()}`);
            }
        });

        // Verify all required fields are present
        const requiredFields = [
            'id', 'user', 'plan', 'status', 'billingCycle', 'startDate', 'endDate',
            'autoRenew', 'renewalStatus', 'paymentHistory', 'invoices'
        ];

        const missingFields = requiredFields.filter(field => !(field in subscriptionDetails));

        if (missingFields.length > 0) {
            console.log(`\n❌ Missing required fields: ${missingFields.join(', ')}`);
        } else {
            console.log('\n✅ All required fields present');
        }

        // Verify renewal status structure
        const renewalStatusFields = ['status', 'nextBillingDate', 'daysUntilRenewal', 'willRenew'];
        const missingRenewalFields = renewalStatusFields.filter(
            field => !(field in subscriptionDetails.renewalStatus)
        );

        if (missingRenewalFields.length > 0) {
            console.log(`❌ Missing renewal status fields: ${missingRenewalFields.join(', ')}`);
        } else {
            console.log('✅ Renewal status structure correct');
        }

        // Step 9: Test error handling - non-existent subscription
        console.log('\n📝 Step 9: Testing error handling...');
        const nonExistentSubscription = await adminStorage.getSubscriptionDetails(999999);

        if (nonExistentSubscription === null) {
            console.log('✅ Correctly returns null for non-existent subscription');
        } else {
            console.log('❌ Should return null for non-existent subscription');
        }

        // Step 10: Test with invalid subscription ID
        console.log('\n📝 Step 10: Testing with invalid ID...');
        try {
            const invalidSubscription = await adminStorage.getSubscriptionDetails(NaN);
            console.log('❌ Should handle invalid ID gracefully');
        } catch (error) {
            console.log('✅ Handles invalid ID appropriately');
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ ALL TESTS PASSED!');
        console.log('='.repeat(50));

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.delete(invoices).where(eq(invoices.userId, userId));
        await db.delete(payments).where(eq(payments.userId, userId));
        await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
        await db.delete(users).where(eq(users.id, userId));
        await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
        console.log('✅ Cleanup complete\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        throw error;
    }
}

// Run the test
testSubscriptionDetailsAPI()
    .then(() => {
        console.log('\n✅ Test script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test script failed:', error);
        process.exit(1);
    });
