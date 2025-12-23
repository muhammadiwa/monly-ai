/**
 * Test Midtrans Webhook Signature Verification
 * 
 * This script tests the signature verification logic without requiring the server to be running.
 * 
 * Requirements: 10.6
 */

import 'dotenv/config';
import crypto from 'crypto';
import { midtransService } from './services/midtrans-service';

console.log('='.repeat(60));
console.log('MIDTRANS WEBHOOK SIGNATURE VERIFICATION TEST');
console.log('='.repeat(60));

// Test data
const orderId = 'TEST-ORDER-123';
const statusCode = '200';
const grossAmount = '100000.00';
const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

if (!serverKey) {
    console.error('❌ MIDTRANS_SERVER_KEY not set in environment');
    process.exit(1);
}

console.log('\nTest Configuration:');
console.log('  Order ID:', orderId);
console.log('  Status Code:', statusCode);
console.log('  Gross Amount:', grossAmount);
console.log('  Server Key:', serverKey.substring(0, 10) + '...');

// Generate valid signature
const signatureString = orderId + statusCode + grossAmount + serverKey;
const validSignature = crypto.createHash('sha512').update(signatureString).digest('hex');

console.log('\n=== Test 1: Valid Signature ===');
const validNotification = {
    transaction_time: new Date().toISOString(),
    transaction_status: 'settlement',
    transaction_id: 'TXN-123',
    status_message: 'Success',
    status_code: statusCode,
    signature_key: validSignature,
    payment_type: 'credit_card',
    order_id: orderId,
    merchant_id: 'TEST-MERCHANT',
    gross_amount: grossAmount,
    fraud_status: 'accept',
    currency: 'IDR',
};

const isValid = midtransService.verifyWebhookSignature(validNotification);
console.log('Signature verification result:', isValid ? '✅ VALID' : '❌ INVALID');

if (isValid) {
    console.log('✅ Test 1 PASSED: Valid signature correctly verified');
} else {
    console.log('❌ Test 1 FAILED: Valid signature was rejected');
}

console.log('\n=== Test 2: Invalid Signature ===');
const invalidNotification = {
    ...validNotification,
    signature_key: 'invalid-signature-12345',
};

const isInvalid = midtransService.verifyWebhookSignature(invalidNotification);
console.log('Signature verification result:', isInvalid ? '❌ VALID (should be invalid)' : '✅ INVALID (correct)');

if (!isInvalid) {
    console.log('✅ Test 2 PASSED: Invalid signature correctly rejected');
} else {
    console.log('❌ Test 2 FAILED: Invalid signature was accepted');
}

console.log('\n=== Test 3: Missing Signature ===');
const missingSignatureNotification = {
    ...validNotification,
    signature_key: '',
};

const isMissingInvalid = midtransService.verifyWebhookSignature(missingSignatureNotification);
console.log('Signature verification result:', isMissingInvalid ? '❌ VALID (should be invalid)' : '✅ INVALID (correct)');

if (!isMissingInvalid) {
    console.log('✅ Test 3 PASSED: Missing signature correctly rejected');
} else {
    console.log('❌ Test 3 FAILED: Missing signature was accepted');
}

console.log('\n=== Test 4: Different Transaction Statuses ===');
const statuses = ['capture', 'settlement', 'pending', 'deny', 'expire', 'cancel', 'refund'];

for (const status of statuses) {
    const testOrderId = `TEST-${status.toUpperCase()}-${Date.now()}`;
    const testSignature = crypto.createHash('sha512')
        .update(testOrderId + statusCode + grossAmount + serverKey)
        .digest('hex');

    const testNotification = {
        ...validNotification,
        order_id: testOrderId,
        transaction_status: status,
        signature_key: testSignature,
    };

    const result = midtransService.verifyWebhookSignature(testNotification);
    console.log(`  ${status.padEnd(15)}: ${result ? '✅ Valid' : '❌ Invalid'}`);
}

console.log('\n' + '='.repeat(60));
console.log('ALL SIGNATURE TESTS COMPLETED');
console.log('='.repeat(60));
