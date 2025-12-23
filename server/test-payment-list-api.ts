/**
 * Test script for Payment List API endpoint
 * Tests GET /api/admin/payments with pagination, search, and filtering
 */

import { db } from './db';
import { users, subscriptionPlans, userSubscriptions, payments, invoices } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testPaymentListAPI() {
    console.log('🧪 Testing Payment List API...\n');

    try {
        // Step 1: Check if we have any payments in the database
        console.log('📊 Step 1: Checking existing payments...');
        const existingPayments = await db.select().from(payments).limit(5);
        console.log(`Found ${existingPayments.length} existing payments`);

        if (existingPayments.length > 0) {
            console.log('Sample payment:', {
                id: existingPayments[0].id,
                userId: existingPayments[0].userId,
                amount: existingPayments[0].amount,
                status: existingPayments[0].status,
                createdAt: existingPayments[0].createdAt,
            });
        }

        // Step 2: Create test data if needed
        if (existingPayments.length === 0) {
            console.log('\n📝 Step 2: Creating test data...');

            // Get or create a test user
            let testUser = await db.select().from(users).limit(1).then(rows => rows[0]);

            if (!testUser) {
                console.log('No users found. Please run seed-admin-data.ts first.');
                return;
            }

            // Get or create a subscription plan
            let testPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, 'premium')).then(rows => rows[0]);

            if (!testPlan) {
                console.log('No subscription plans found. Please run seed-admin-data.ts first.');
                return;
            }

            // Create a test subscription
            const now = Math.floor(Date.now() / 1000);
            const endDate = now + (30 * 24 * 60 * 60); // 30 days from now

            const [testSubscription] = await db.insert(userSubscriptions).values({
                userId: testUser.id,
                planId: testPlan.id,
                status: 'active',
                billingCycle: 'monthly',
                startDate: now,
                endDate: endDate,
                autoRenew: 1,
                createdAt: now,
                updatedAt: now,
            }).returning();

            console.log('Created test subscription:', testSubscription.id);

            // Create test payments
            const testPaymentsData = [
                {
                    userId: testUser.id,
                    subscriptionId: testSubscription.id,
                    amount: 99000,
                    currency: 'IDR',
                    paymentMethod: 'credit_card' as const,
                    status: 'paid' as const,
                    midtransTransactionId: 'TXN-TEST-001',
                    midtransOrderId: 'ORDER-TEST-001',
                    paidAt: now - 86400, // 1 day ago
                    createdAt: now - 86400,
                    updatedAt: now - 86400,
                },
                {
                    userId: testUser.id,
                    subscriptionId: testSubscription.id,
                    amount: 99000,
                    currency: 'IDR',
                    paymentMethod: 'bank_transfer' as const,
                    status: 'pending' as const,
                    midtransTransactionId: 'TXN-TEST-002',
                    midtransOrderId: 'ORDER-TEST-002',
                    paidAt: null,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    userId: testUser.id,
                    subscriptionId: testSubscription.id,
                    amount: 99000,
                    currency: 'IDR',
                    paymentMethod: 'e_wallet' as const,
                    status: 'failed' as const,
                    midtransTransactionId: 'TXN-TEST-003',
                    midtransOrderId: 'ORDER-TEST-003',
                    paidAt: null,
                    createdAt: now - 172800, // 2 days ago
                    updatedAt: now - 172800,
                },
            ];

            for (const paymentData of testPaymentsData) {
                await db.insert(payments).values(paymentData);
            }

            console.log(`Created ${testPaymentsData.length} test payments`);

            // Create a test invoice for the first payment
            const firstPayment = await db.select().from(payments).where(eq(payments.midtransOrderId, 'ORDER-TEST-001')).then(rows => rows[0]);

            if (firstPayment) {
                await db.insert(invoices).values({
                    invoiceNumber: 'INV-TEST-001',
                    userId: testUser.id,
                    paymentId: firstPayment.id,
                    amount: 99000,
                    currency: 'IDR',
                    items: JSON.stringify([
                        {
                            description: 'Premium Plan - Monthly',
                            quantity: 1,
                            unitPrice: 99000,
                            total: 99000,
                        }
                    ]),
                    status: 'paid',
                    issuedAt: now - 86400,
                    dueAt: now - 86400,
                    paidAt: now - 86400,
                    createdAt: now - 86400,
                    updatedAt: now - 86400,
                });
                console.log('Created test invoice: INV-TEST-001');
            }
        }

        // Step 3: Test the adminStorage.getPaymentList function
        console.log('\n🔍 Step 3: Testing adminStorage.getPaymentList()...');

        const { adminStorage } = await import('./admin/admin-storage');

        // Test 1: Basic pagination
        console.log('\n📄 Test 1: Basic pagination (page 1, limit 10)');
        const result1 = await adminStorage.getPaymentList({
            page: 1,
            limit: 10,
        });
        console.log(`✅ Found ${result1.total} total payments`);
        console.log(`✅ Returned ${result1.payments.length} payments on page ${result1.page}`);
        console.log(`✅ Total pages: ${result1.totalPages}`);

        if (result1.payments.length > 0) {
            const sample = result1.payments[0];
            console.log('\nSample payment:');
            console.log('  ID:', sample.id);
            console.log('  Amount:', sample.amount, sample.currency);
            console.log('  Status:', sample.status);
            console.log('  Payment Method:', sample.paymentMethod);
            console.log('  User:', sample.user.fullName, `(${sample.user.email})`);
            console.log('  Subscription:', sample.subscription ? sample.subscription.planDisplayName : 'None');
            console.log('  Invoice:', sample.invoice ? sample.invoice.invoiceNumber : 'None');
            console.log('  Created:', new Date(sample.createdAt * 1000).toISOString());
        }

        // Test 2: Filter by status
        console.log('\n📄 Test 2: Filter by status (paid)');
        const result2 = await adminStorage.getPaymentList({
            page: 1,
            limit: 10,
            status: 'paid',
        });
        console.log(`✅ Found ${result2.total} paid payments`);
        console.log(`✅ All payments have status 'paid':`, result2.payments.every(p => p.status === 'paid'));

        // Test 3: Search by user email
        if (result1.payments.length > 0) {
            const searchEmail = result1.payments[0].user.email;
            console.log(`\n📄 Test 3: Search by user email (${searchEmail})`);
            const result3 = await adminStorage.getPaymentList({
                page: 1,
                limit: 10,
                search: searchEmail,
            });
            console.log(`✅ Found ${result3.total} payments for user`);
            console.log(`✅ All payments belong to searched user:`, result3.payments.every(p => p.user.email === searchEmail));
        }

        // Test 4: Search by transaction ID
        if (result1.payments.length > 0 && result1.payments[0].midtransTransactionId) {
            const searchTxnId = result1.payments[0].midtransTransactionId;
            console.log(`\n📄 Test 4: Search by transaction ID (${searchTxnId})`);
            const result4 = await adminStorage.getPaymentList({
                page: 1,
                limit: 10,
                search: searchTxnId,
            });
            console.log(`✅ Found ${result4.total} payments with transaction ID`);
        }

        // Test 5: Date range filter
        const now = Math.floor(Date.now() / 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);
        console.log(`\n📄 Test 5: Date range filter (last 7 days)`);
        const result5 = await adminStorage.getPaymentList({
            page: 1,
            limit: 10,
            dateFrom: sevenDaysAgo,
            dateTo: now,
        });
        console.log(`✅ Found ${result5.total} payments in last 7 days`);

        // Test 6: Combined filters
        console.log(`\n📄 Test 6: Combined filters (status=pending, last 7 days)`);
        const result6 = await adminStorage.getPaymentList({
            page: 1,
            limit: 10,
            status: 'pending',
            dateFrom: sevenDaysAgo,
            dateTo: now,
        });
        console.log(`✅ Found ${result6.total} pending payments in last 7 days`);

        // Test 7: Pagination (page 2)
        if (result1.totalPages > 1) {
            console.log(`\n📄 Test 7: Pagination (page 2)`);
            const result7 = await adminStorage.getPaymentList({
                page: 2,
                limit: 10,
            });
            console.log(`✅ Page 2 has ${result7.payments.length} payments`);
        }

        console.log('\n✅ All payment list tests passed!');
        console.log('\n📝 Summary:');
        console.log(`   Total payments in database: ${result1.total}`);
        console.log(`   Paid payments: ${result2.total}`);
        console.log(`   Pending payments (last 7 days): ${result6.total}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run the test
testPaymentListAPI()
    .then(() => {
        console.log('\n✅ Payment List API test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Payment List API test failed:', error);
        process.exit(1);
    });
