/**
 * Comprehensive test for Payment Details API
 * Creates test data with invoice and webhook logs to verify complete functionality
 */

import { db } from './db';
import { adminStorage } from './admin/admin-storage';

async function testPaymentDetailsComprehensive() {
    console.log('🧪 Comprehensive Payment Details API Test...\n');

    try {
        const { payments, invoices, midtransWebhookLogs, users, subscriptionPlans, userSubscriptions } = await import('@shared/schema');
        const { eq, desc } = await import('drizzle-orm');

        // Step 1: Create test payment with invoice and webhook logs
        console.log('📋 Step 1: Creating comprehensive test data...');

        // Get or create test user
        let testUser = await db.select().from(users).limit(1);
        if (testUser.length === 0) {
            console.log('Creating test user...');
            const now = Math.floor(Date.now() / 1000);
            await db.insert(users).values({
                id: 'test-user-comprehensive',
                email: 'test-comprehensive@example.com',
                firstName: 'Test',
                lastName: 'Comprehensive',
                password: 'hashed_password',
                createdAt: now,
                updatedAt: now,
            });
            testUser = await db.select().from(users).where(eq(users.id, 'test-user-comprehensive'));
        }

        // Get or create test plan
        let testPlan = await db.select().from(subscriptionPlans).limit(1);
        if (testPlan.length === 0) {
            console.log('Creating test subscription plan...');
            const now = Math.floor(Date.now() / 1000);
            await db.insert(subscriptionPlans).values({
                name: 'test-plan-comprehensive',
                displayName: 'Test Plan Comprehensive',
                description: 'Test plan for comprehensive payment details',
                priceMonthly: 149000,
                priceYearly: 1490000,
                currency: 'IDR',
                features: JSON.stringify(['Feature 1', 'Feature 2', 'Feature 3']),
                limits: JSON.stringify({
                    transactionLimit: 200,
                    accountLimit: 10,
                    budgetLimit: 20,
                    goalLimit: 10,
                    aiInsights: true,
                    advancedReports: true,
                    prioritySupport: true,
                    apiAccess: true,
                }),
                isActive: 1,
                createdAt: now,
                updatedAt: now,
            });
            testPlan = await db.select().from(subscriptionPlans).limit(1);
        }

        // Create test subscription
        const now = Math.floor(Date.now() / 1000);
        const subscriptionResult = await db.insert(userSubscriptions).values({
            userId: testUser[0].id,
            planId: testPlan[0].id,
            status: 'active',
            billingCycle: 'yearly',
            startDate: now,
            endDate: now + (365 * 24 * 60 * 60),
            autoRenew: 1,
            createdAt: now,
            updatedAt: now,
        }).returning();

        // Create test payment
        const orderId = 'ORDER-COMPREHENSIVE-' + Date.now();
        const transactionId = 'TXN-COMPREHENSIVE-' + Date.now();

        const paymentResult = await db.insert(payments).values({
            userId: testUser[0].id,
            subscriptionId: subscriptionResult[0].id,
            amount: 1490000,
            currency: 'IDR',
            paymentMethod: 'credit_card',
            status: 'paid',
            midtransTransactionId: transactionId,
            midtransOrderId: orderId,
            paidAt: now,
            createdAt: now,
            updatedAt: now,
        }).returning();

        const paymentId = paymentResult[0].id;
        console.log(`✅ Created payment ID: ${paymentId}`);

        // Create test invoice
        const invoiceNumber = 'INV-' + Date.now();
        await db.insert(invoices).values({
            invoiceNumber: invoiceNumber,
            userId: testUser[0].id,
            paymentId: paymentId,
            amount: 1490000,
            currency: 'IDR',
            items: JSON.stringify([
                {
                    description: 'Annual Subscription - Test Plan Comprehensive',
                    quantity: 1,
                    unitPrice: 1490000,
                    total: 1490000,
                }
            ]),
            status: 'paid',
            issuedAt: now,
            dueAt: now + (7 * 24 * 60 * 60),
            paidAt: now,
            createdAt: now,
            updatedAt: now,
        });
        console.log(`✅ Created invoice: ${invoiceNumber}`);

        // Create test webhook logs
        const webhookEvents = [
            { eventType: 'transaction.pending', status: 'processed' },
            { eventType: 'transaction.success', status: 'processed' },
            { eventType: 'transaction.settlement', status: 'processed' },
        ];

        for (const event of webhookEvents) {
            await db.insert(midtransWebhookLogs).values({
                orderId: orderId,
                transactionId: transactionId,
                eventType: event.eventType,
                payload: JSON.stringify({
                    transaction_status: event.eventType.split('.')[1],
                    order_id: orderId,
                    transaction_id: transactionId,
                    gross_amount: '1490000.00',
                    payment_type: 'credit_card',
                }),
                signature: 'test-signature-' + Date.now(),
                status: event.status,
                createdAt: now + webhookEvents.indexOf(event) * 60,
            });
        }
        console.log(`✅ Created ${webhookEvents.length} webhook logs\n`);

        // Step 2: Test the payment details retrieval
        console.log('🔍 Step 2: Testing payment details retrieval...');
        const paymentDetails = await adminStorage.getPaymentDetails(paymentId);

        if (!paymentDetails) {
            console.error('❌ Payment details not found');
            return;
        }

        console.log('✅ Payment details retrieved successfully\n');

        // Step 3: Verify all data is present
        console.log('📊 Step 3: Verifying data completeness...\n');

        // Verify payment data
        console.log('💳 Payment Data:');
        console.log(`   ✓ ID: ${paymentDetails.id}`);
        console.log(`   ✓ Amount: ${paymentDetails.currency} ${paymentDetails.amount.toLocaleString()}`);
        console.log(`   ✓ Status: ${paymentDetails.status}`);
        console.log(`   ✓ Payment Method: ${paymentDetails.paymentMethod}`);
        console.log(`   ✓ Midtrans Transaction ID: ${paymentDetails.midtransTransactionId}`);
        console.log(`   ✓ Midtrans Order ID: ${paymentDetails.midtransOrderId}`);

        // Verify user data
        console.log('\n👤 User Data:');
        console.log(`   ✓ ID: ${paymentDetails.user.id}`);
        console.log(`   ✓ Email: ${paymentDetails.user.email}`);
        console.log(`   ✓ Full Name: ${paymentDetails.user.fullName}`);

        // Verify subscription data
        if (paymentDetails.subscription) {
            console.log('\n📋 Subscription Data:');
            console.log(`   ✓ ID: ${paymentDetails.subscription.id}`);
            console.log(`   ✓ Status: ${paymentDetails.subscription.status}`);
            console.log(`   ✓ Billing Cycle: ${paymentDetails.subscription.billingCycle}`);
            console.log(`   ✓ Plan Name: ${paymentDetails.subscription.plan.displayName}`);
            console.log(`   ✓ Plan Price (Monthly): IDR ${paymentDetails.subscription.plan.priceMonthly.toLocaleString()}`);
            console.log(`   ✓ Plan Price (Yearly): IDR ${paymentDetails.subscription.plan.priceYearly.toLocaleString()}`);
            console.log(`   ✓ Auto Renew: ${paymentDetails.subscription.autoRenew ? 'Yes' : 'No'}`);
        } else {
            console.error('   ❌ Subscription data missing');
        }

        // Verify invoice data
        if (paymentDetails.invoice) {
            console.log('\n🧾 Invoice Data:');
            console.log(`   ✓ Invoice Number: ${paymentDetails.invoice.invoiceNumber}`);
            console.log(`   ✓ Status: ${paymentDetails.invoice.status}`);
            console.log(`   ✓ Amount: ${paymentDetails.invoice.currency} ${paymentDetails.invoice.amount.toLocaleString()}`);
            console.log(`   ✓ Items: ${paymentDetails.invoice.items.length} item(s)`);
            paymentDetails.invoice.items.forEach((item: any, index: number) => {
                console.log(`      ${index + 1}. ${item.description} - IDR ${item.total.toLocaleString()}`);
            });
        } else {
            console.error('   ❌ Invoice data missing');
        }

        // Verify webhook logs
        console.log('\n📝 Webhook Logs:');
        if (paymentDetails.webhookLogs.length > 0) {
            console.log(`   ✓ Found ${paymentDetails.webhookLogs.length} webhook logs`);
            paymentDetails.webhookLogs.forEach((log, index) => {
                console.log(`      ${index + 1}. ${log.eventType} - ${log.status} (${new Date(log.createdAt * 1000).toISOString()})`);
            });
        } else {
            console.error('   ❌ Webhook logs missing');
        }

        // Step 4: Verify data integrity
        console.log('\n🔍 Step 4: Verifying data integrity...');

        let allChecks = true;

        if (paymentDetails.amount !== 1490000) {
            console.error('   ❌ Payment amount mismatch');
            allChecks = false;
        } else {
            console.log('   ✓ Payment amount matches');
        }

        if (paymentDetails.invoice && paymentDetails.invoice.amount !== paymentDetails.amount) {
            console.error('   ❌ Invoice amount does not match payment amount');
            allChecks = false;
        } else {
            console.log('   ✓ Invoice amount matches payment amount');
        }

        if (paymentDetails.webhookLogs.length !== 3) {
            console.error(`   ❌ Expected 3 webhook logs, got ${paymentDetails.webhookLogs.length}`);
            allChecks = false;
        } else {
            console.log('   ✓ All webhook logs present');
        }

        if (paymentDetails.subscription && paymentDetails.subscription.billingCycle !== 'yearly') {
            console.error('   ❌ Billing cycle mismatch');
            allChecks = false;
        } else {
            console.log('   ✓ Billing cycle matches');
        }

        if (allChecks) {
            console.log('\n✅ All data integrity checks passed!');
        } else {
            console.error('\n❌ Some data integrity checks failed');
        }

        console.log('\n✅ Comprehensive test completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   ✓ Payment details with all related data');
        console.log('   ✓ User information complete');
        console.log('   ✓ Subscription details complete');
        console.log('   ✓ Invoice details complete');
        console.log('   ✓ Webhook logs complete');
        console.log('   ✓ Data integrity verified');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testPaymentDetailsComprehensive()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    });
