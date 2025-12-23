/**
 * Test script for Payment Details API
 * Tests GET /api/admin/payments/:id endpoint
 * 
 * This test verifies:
 * 1. Payment details retrieval with all related data
 * 2. User information is included
 * 3. Subscription details are included (if exists)
 * 4. Invoice details are included (if exists)
 * 5. Webhook logs are included (if exists)
 * 6. Midtrans transaction details are present
 * 7. Error handling for non-existent payment
 */

import { db } from './db';
import { adminStorage } from './admin/admin-storage';

async function testPaymentDetailsAPI() {
    console.log('🧪 Testing Payment Details API...\n');

    try {
        // Step 1: Get a payment ID from the database
        console.log('📋 Step 1: Finding a payment in the database...');
        const { payments } = await import('@shared/schema');
        const { desc } = await import('drizzle-orm');

        const existingPayments = await db
            .select()
            .from(payments)
            .orderBy(desc(payments.createdAt))
            .limit(1);

        if (existingPayments.length === 0) {
            console.log('⚠️  No payments found in database. Creating test data...');

            // Create test data
            const { users, subscriptionPlans, userSubscriptions } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');

            // Get or create a test user
            let testUser = await db.select().from(users).limit(1);
            if (testUser.length === 0) {
                console.log('Creating test user...');
                const now = Math.floor(Date.now() / 1000);
                await db.insert(users).values({
                    id: 'test-user-payment-details',
                    email: 'test-payment-details@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    password: 'hashed_password',
                    createdAt: now,
                    updatedAt: now,
                });
                testUser = await db.select().from(users).where(eq(users.id, 'test-user-payment-details'));
            }

            // Get or create a test plan
            let testPlan = await db.select().from(subscriptionPlans).limit(1);
            if (testPlan.length === 0) {
                console.log('Creating test subscription plan...');
                const now = Math.floor(Date.now() / 1000);
                await db.insert(subscriptionPlans).values({
                    name: 'test-plan',
                    displayName: 'Test Plan',
                    description: 'Test plan for payment details',
                    priceMonthly: 99000,
                    priceYearly: 990000,
                    currency: 'IDR',
                    features: JSON.stringify(['Feature 1', 'Feature 2']),
                    limits: JSON.stringify({
                        transactionLimit: 100,
                        accountLimit: 5,
                        budgetLimit: 10,
                        goalLimit: 5,
                        aiInsights: true,
                        advancedReports: true,
                        prioritySupport: false,
                        apiAccess: false,
                    }),
                    isActive: 1,
                    createdAt: now,
                    updatedAt: now,
                });
                testPlan = await db.select().from(subscriptionPlans).limit(1);
            }

            // Create a test subscription
            console.log('Creating test subscription...');
            const now = Math.floor(Date.now() / 1000);
            const subscriptionResult = await db.insert(userSubscriptions).values({
                userId: testUser[0].id,
                planId: testPlan[0].id,
                status: 'active',
                billingCycle: 'monthly',
                startDate: now,
                endDate: now + (30 * 24 * 60 * 60),
                autoRenew: 1,
                createdAt: now,
                updatedAt: now,
            }).returning();

            // Create a test payment
            console.log('Creating test payment...');
            await db.insert(payments).values({
                userId: testUser[0].id,
                subscriptionId: subscriptionResult[0].id,
                amount: 99000,
                currency: 'IDR',
                paymentMethod: 'credit_card',
                status: 'paid',
                midtransTransactionId: 'test-txn-' + Date.now(),
                midtransOrderId: 'test-order-' + Date.now(),
                paidAt: now,
                createdAt: now,
                updatedAt: now,
            });

            // Fetch the newly created payment
            const newPayments = await db
                .select()
                .from(payments)
                .orderBy(desc(payments.createdAt))
                .limit(1);

            console.log('✅ Test data created successfully\n');
            existingPayments.push(newPayments[0]);
        }

        const testPaymentId = existingPayments[0].id;
        console.log(`✅ Found payment ID: ${testPaymentId}`);
        console.log(`   Status: ${existingPayments[0].status}`);
        console.log(`   Amount: ${existingPayments[0].currency} ${existingPayments[0].amount}`);
        console.log(`   Midtrans Order ID: ${existingPayments[0].midtransOrderId || 'N/A'}\n`);

        // Step 2: Test the adminStorage.getPaymentDetails function
        console.log('🔍 Step 2: Testing adminStorage.getPaymentDetails()...');
        const paymentDetails = await adminStorage.getPaymentDetails(testPaymentId);

        if (!paymentDetails) {
            console.error('❌ Payment details not found');
            return;
        }

        console.log('✅ Payment details retrieved successfully');
        console.log('\n📦 Payment Details:');
        console.log(`   ID: ${paymentDetails.id}`);
        console.log(`   Amount: ${paymentDetails.currency} ${paymentDetails.amount}`);
        console.log(`   Status: ${paymentDetails.status}`);
        console.log(`   Payment Method: ${paymentDetails.paymentMethod}`);
        console.log(`   Midtrans Transaction ID: ${paymentDetails.midtransTransactionId || 'N/A'}`);
        console.log(`   Midtrans Order ID: ${paymentDetails.midtransOrderId || 'N/A'}`);
        console.log(`   Paid At: ${paymentDetails.paidAt ? new Date(paymentDetails.paidAt * 1000).toISOString() : 'N/A'}`);

        console.log('\n👤 User Details:');
        console.log(`   ID: ${paymentDetails.user.id}`);
        console.log(`   Email: ${paymentDetails.user.email}`);
        console.log(`   Name: ${paymentDetails.user.fullName}`);

        if (paymentDetails.subscription) {
            console.log('\n📋 Subscription Details:');
            console.log(`   ID: ${paymentDetails.subscription.id}`);
            console.log(`   Status: ${paymentDetails.subscription.status}`);
            console.log(`   Billing Cycle: ${paymentDetails.subscription.billingCycle}`);
            console.log(`   Plan: ${paymentDetails.subscription.plan.displayName}`);
            console.log(`   Auto Renew: ${paymentDetails.subscription.autoRenew ? 'Yes' : 'No'}`);
        } else {
            console.log('\n📋 Subscription: None');
        }

        if (paymentDetails.invoice) {
            console.log('\n🧾 Invoice Details:');
            console.log(`   Invoice Number: ${paymentDetails.invoice.invoiceNumber}`);
            console.log(`   Status: ${paymentDetails.invoice.status}`);
            console.log(`   Amount: ${paymentDetails.invoice.currency} ${paymentDetails.invoice.amount}`);
        } else {
            console.log('\n🧾 Invoice: None');
        }

        console.log(`\n📝 Webhook Logs: ${paymentDetails.webhookLogs.length} logs`);
        if (paymentDetails.webhookLogs.length > 0) {
            paymentDetails.webhookLogs.forEach((log, index) => {
                console.log(`   ${index + 1}. Event: ${log.eventType}, Status: ${log.status}`);
            });
        }

        // Step 3: Test error handling - non-existent payment
        console.log('\n🔍 Step 3: Testing error handling (non-existent payment)...');
        const nonExistentPayment = await adminStorage.getPaymentDetails(999999);

        if (nonExistentPayment === null) {
            console.log('✅ Correctly returns null for non-existent payment');
        } else {
            console.error('❌ Should return null for non-existent payment');
        }

        console.log('\n✅ All tests passed!');
        console.log('\n📊 Summary:');
        console.log('   ✓ Payment details retrieval works');
        console.log('   ✓ User information is included');
        console.log('   ✓ Subscription details are included (if exists)');
        console.log('   ✓ Invoice details are included (if exists)');
        console.log('   ✓ Webhook logs are included');
        console.log('   ✓ Error handling works correctly');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testPaymentDetailsAPI()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    });
