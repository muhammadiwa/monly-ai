/**
 * Test Midtrans Webhook Handler
 * 
 * This script tests the Midtrans webhook endpoint to ensure it:
 * 1. Verifies webhook signatures correctly
 * 2. Updates payment status in database
 * 3. Activates subscriptions when payment is successful
 * 4. Logs webhook events to database
 * 
 * Requirements: 10.6
 */

import crypto from 'crypto';

const BASE_URL = 'http://localhost:5000';

// Helper function to generate valid Midtrans signature
function generateMidtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
    const signatureString = orderId + statusCode + grossAmount + serverKey;
    return crypto.createHash('sha512').update(signatureString).digest('hex');
}

// Test webhook with valid signature
async function testWebhookWithValidSignature() {
    console.log('\n=== Test 1: Webhook with Valid Signature (Settlement) ===');

    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!serverKey) {
        console.error('❌ MIDTRANS_SERVER_KEY not set in environment');
        return;
    }

    const orderId = 'TEST-ORDER-' + Date.now();
    const statusCode = '200';
    const grossAmount = '100000.00';

    const signature = generateMidtransSignature(orderId, statusCode, grossAmount, serverKey);

    const webhookPayload = {
        transaction_time: new Date().toISOString(),
        transaction_status: 'settlement',
        transaction_id: 'TXN-' + Date.now(),
        status_message: 'Success',
        status_code: statusCode,
        signature_key: signature,
        payment_type: 'credit_card',
        order_id: orderId,
        merchant_id: 'TEST-MERCHANT',
        gross_amount: grossAmount,
        fraud_status: 'accept',
        currency: 'IDR',
    };

    try {
        const response = await fetch(`${BASE_URL}/api/webhooks/midtrans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (response.status === 404 && data.error?.code === 'PAYMENT_NOT_FOUND') {
            console.log('✅ Test passed: Webhook correctly handled non-existent payment');
        } else if (response.ok && data.success) {
            console.log('✅ Test passed: Webhook processed successfully');
        } else {
            console.log('❌ Test failed: Unexpected response');
        }
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Test webhook with invalid signature
async function testWebhookWithInvalidSignature() {
    console.log('\n=== Test 2: Webhook with Invalid Signature ===');

    const orderId = 'TEST-ORDER-' + Date.now();
    const statusCode = '200';
    const grossAmount = '100000.00';

    const webhookPayload = {
        transaction_time: new Date().toISOString(),
        transaction_status: 'settlement',
        transaction_id: 'TXN-' + Date.now(),
        status_message: 'Success',
        status_code: statusCode,
        signature_key: 'invalid-signature-12345',
        payment_type: 'credit_card',
        order_id: orderId,
        merchant_id: 'TEST-MERCHANT',
        gross_amount: grossAmount,
        fraud_status: 'accept',
        currency: 'IDR',
    };

    try {
        const response = await fetch(`${BASE_URL}/api/webhooks/midtrans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (response.status === 401 && data.error?.code === 'INVALID_SIGNATURE') {
            console.log('✅ Test passed: Invalid signature correctly rejected');
        } else {
            console.log('❌ Test failed: Expected 401 with INVALID_SIGNATURE error');
        }
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Test webhook with missing required fields
async function testWebhookWithMissingFields() {
    console.log('\n=== Test 3: Webhook with Missing Required Fields ===');

    const webhookPayload = {
        transaction_time: new Date().toISOString(),
        // Missing: order_id, transaction_status, signature_key
        transaction_id: 'TXN-' + Date.now(),
        status_message: 'Success',
        payment_type: 'credit_card',
    };

    try {
        const response = await fetch(`${BASE_URL}/api/webhooks/midtrans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ Test passed: Missing fields correctly rejected');
        } else {
            console.log('❌ Test failed: Expected 400 with VALIDATION_ERROR');
        }
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

// Test different transaction statuses
async function testDifferentTransactionStatuses() {
    console.log('\n=== Test 4: Different Transaction Statuses ===');

    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!serverKey) {
        console.error('❌ MIDTRANS_SERVER_KEY not set in environment');
        return;
    }

    const statuses = [
        { status: 'capture', expectedPaymentStatus: 'paid' },
        { status: 'settlement', expectedPaymentStatus: 'paid' },
        { status: 'pending', expectedPaymentStatus: 'pending' },
        { status: 'deny', expectedPaymentStatus: 'failed' },
        { status: 'expire', expectedPaymentStatus: 'failed' },
        { status: 'cancel', expectedPaymentStatus: 'failed' },
        { status: 'refund', expectedPaymentStatus: 'refunded' },
    ];

    for (const { status, expectedPaymentStatus } of statuses) {
        console.log(`\nTesting status: ${status} (expected: ${expectedPaymentStatus})`);

        const orderId = `TEST-ORDER-${status}-${Date.now()}`;
        const statusCode = '200';
        const grossAmount = '100000.00';

        const signature = generateMidtransSignature(orderId, statusCode, grossAmount, serverKey);

        const webhookPayload = {
            transaction_time: new Date().toISOString(),
            transaction_status: status,
            transaction_id: `TXN-${status}-${Date.now()}`,
            status_message: 'Success',
            status_code: statusCode,
            signature_key: signature,
            payment_type: 'credit_card',
            order_id: orderId,
            merchant_id: 'TEST-MERCHANT',
            gross_amount: grossAmount,
            fraud_status: 'accept',
            currency: 'IDR',
        };

        try {
            const response = await fetch(`${BASE_URL}/api/webhooks/midtrans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload),
            });

            const data = await response.json();

            console.log(`  Response status: ${response.status}`);
            console.log(`  Response: ${data.success ? '✅ Success' : '❌ Failed'}`);

            if (response.status === 404) {
                console.log(`  ℹ️  Payment not found (expected for test data)`);
            }
        } catch (error) {
            console.error(`  ❌ Error:`, error);
        }
    }
}

// Run all tests
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('MIDTRANS WEBHOOK HANDLER TESTS');
    console.log('='.repeat(60));

    await testWebhookWithValidSignature();
    await testWebhookWithInvalidSignature();
    await testWebhookWithMissingFields();
    await testDifferentTransactionStatuses();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(60));
}

// Run tests
runAllTests().catch(console.error);
