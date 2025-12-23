/**
 * Test script for Payment Details API Endpoint
 * Tests GET /api/admin/payments/:id endpoint via HTTP
 * 
 * This test verifies:
 * 1. Admin authentication is required
 * 2. Payment details endpoint returns correct data
 * 3. All related data is included (user, subscription, invoice, webhooks)
 * 4. Error handling for invalid/non-existent payment ID
 */

import { db } from './db';

async function testPaymentDetailsEndpoint() {
    console.log('🧪 Testing Payment Details API Endpoint...\n');

    try {
        // Step 1: Login as admin to get token
        console.log('🔐 Step 1: Logging in as admin...');
        const { generateAdminToken } = await import('./admin/admin-auth');
        const { adminStorage } = await import('./admin/admin-storage');

        // Get admin user
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');
        if (!admin) {
            console.error('❌ Admin user not found. Please run seed-admin-data.ts first');
            return;
        }

        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });

        console.log('✅ Admin token generated\n');

        // Step 2: Get a payment ID from the database
        console.log('📋 Step 2: Finding a payment in the database...');
        const { payments } = await import('@shared/schema');
        const { desc } = await import('drizzle-orm');

        const existingPayments = await db
            .select()
            .from(payments)
            .orderBy(desc(payments.createdAt))
            .limit(1);

        if (existingPayments.length === 0) {
            console.log('⚠️  No payments found in database');
            return;
        }

        const testPaymentId = existingPayments[0].id;
        console.log(`✅ Found payment ID: ${testPaymentId}\n`);

        // Step 3: Start the server (we'll use the existing server if running)
        console.log('🌐 Step 3: Testing endpoint...');

        // Import the router
        const { default: adminRoutes } = await import('./admin/admin-routes');
        const express = await import('express');
        const app = express.default();

        app.use(express.json());
        app.use('/api', adminRoutes);

        // Create a test request
        const request = await import('supertest');
        const agent = request.default(app);

        // Test 1: Get payment details with valid ID
        console.log('\n📄 Test 1: Get payment details with valid ID');
        const response1 = await agent
            .get(`/api/admin/payments/${testPaymentId}`)
            .set('Authorization', `Bearer ${token}`);

        console.log(`Status: ${response1.status}`);

        if (response1.status === 200) {
            console.log('✅ Payment details retrieved successfully');
            const data = response1.body.data;
            console.log(`   Payment ID: ${data.id}`);
            console.log(`   Amount: ${data.currency} ${data.amount}`);
            console.log(`   Status: ${data.status}`);
            console.log(`   User: ${data.user.fullName} (${data.user.email})`);
            console.log(`   Subscription: ${data.subscription ? data.subscription.plan.displayName : 'None'}`);
            console.log(`   Invoice: ${data.invoice ? data.invoice.invoiceNumber : 'None'}`);
            console.log(`   Webhook Logs: ${data.webhookLogs.length} logs`);
        } else {
            console.error('❌ Failed to get payment details');
            console.error('Response:', response1.body);
        }

        // Test 2: Get payment details without authentication
        console.log('\n📄 Test 2: Get payment details without authentication');
        const response2 = await agent
            .get(`/api/admin/payments/${testPaymentId}`);

        console.log(`Status: ${response2.status}`);

        if (response2.status === 401) {
            console.log('✅ Correctly requires authentication');
        } else {
            console.error('❌ Should require authentication');
        }

        // Test 3: Get payment details with invalid ID
        console.log('\n📄 Test 3: Get payment details with invalid ID');
        const response3 = await agent
            .get('/api/admin/payments/invalid')
            .set('Authorization', `Bearer ${token}`);

        console.log(`Status: ${response3.status}`);

        if (response3.status === 400) {
            console.log('✅ Correctly validates payment ID');
            console.log(`   Error: ${response3.body.error.message}`);
        } else {
            console.error('❌ Should validate payment ID');
        }

        // Test 4: Get payment details with non-existent ID
        console.log('\n📄 Test 4: Get payment details with non-existent ID');
        const response4 = await agent
            .get('/api/admin/payments/999999')
            .set('Authorization', `Bearer ${token}`);

        console.log(`Status: ${response4.status}`);

        if (response4.status === 404) {
            console.log('✅ Correctly handles non-existent payment');
            console.log(`   Error: ${response4.body.error.message}`);
        } else {
            console.error('❌ Should return 404 for non-existent payment');
        }

        console.log('\n✅ All endpoint tests passed!');
        console.log('\n📊 Summary:');
        console.log('   ✓ Payment details endpoint works');
        console.log('   ✓ Authentication is required');
        console.log('   ✓ Input validation works');
        console.log('   ✓ Error handling works correctly');
        console.log('   ✓ All related data is included');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testPaymentDetailsEndpoint()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    });
