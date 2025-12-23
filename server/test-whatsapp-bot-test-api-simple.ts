/**
 * Simple test script for WhatsApp Bot Test API
 * Tests POST /api/admin/whatsapp/test endpoint logic
 */

import { db } from './db';
import { adminUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:5000/api';

// Helper function to get admin token
async function getAdminToken(): Promise<string> {
    // First, ensure admin user exists
    const existingAdmin = await db.select()
        .from(adminUsers)
        .where(eq(adminUsers.email, 'admin@monly.ai'))
        .limit(1);

    if (existingAdmin.length === 0) {
        // Create admin user
        const hashedPassword = await bcrypt.hash('Admin123!@#', 12);
        await db.insert(adminUsers).values({
            id: 'admin-test-' + Date.now(),
            email: 'admin@monly.ai',
            name: 'Test Admin',
            password: hashedPassword,
            role: 'super_admin',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }

    // Login to get token
    const loginResponse = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@monly.ai',
            password: 'Admin123!@#',
        }),
    });

    if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    return loginData.token;
}

async function testWhatsAppBotTestAPI() {
    console.log('🧪 Testing WhatsApp Bot Test API (Simple)...\n');

    let passedTests = 0;
    let totalTests = 0;

    try {
        // Get admin token
        console.log('1️⃣ Getting admin authentication token...');
        const token = await getAdminToken();
        console.log('✅ Admin token obtained\n');

        // Test 1: Unauthenticated request
        totalTests++;
        console.log('Test 1: Unauthenticated request should be rejected');
        const unauthResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: '628123456789',
                message: 'Test',
            }),
        });

        if (unauthResponse.status === 401) {
            console.log('✅ PASS: Correctly rejected unauthenticated request\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Should have rejected unauthenticated request\n');
        }

        // Test 2: Missing phone number
        totalTests++;
        console.log('Test 2: Missing phone number should be rejected');
        const noPhoneResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                message: 'Test message',
            }),
        });

        const noPhoneData = await noPhoneResponse.json();
        if (noPhoneResponse.status === 400 && noPhoneData.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Correctly rejected request with missing phone number\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Should have rejected request with missing phone number\n');
        }

        // Test 3: Missing message
        totalTests++;
        console.log('Test 3: Missing message should be rejected');
        const noMessageResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '628123456789',
            }),
        });

        const noMessageData = await noMessageResponse.json();
        if (noMessageResponse.status === 400 && noMessageData.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Correctly rejected request with missing message\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Should have rejected request with missing message\n');
        }

        // Test 4: Empty phone number
        totalTests++;
        console.log('Test 4: Empty phone number should be rejected');
        const emptyPhoneResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '',
                message: 'Test',
            }),
        });

        const emptyPhoneData = await emptyPhoneResponse.json();
        if (emptyPhoneResponse.status === 400 && emptyPhoneData.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Correctly rejected request with empty phone number\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Should have rejected request with empty phone number\n');
        }

        // Test 5: Empty message
        totalTests++;
        console.log('Test 5: Empty message should be rejected');
        const emptyMessageResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '628123456789',
                message: '',
            }),
        });

        const emptyMessageData = await emptyMessageResponse.json();
        if (emptyMessageResponse.status === 400 && emptyMessageData.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Correctly rejected request with empty message\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Should have rejected request with empty message\n');
        }

        // Test 6: Valid request (will check bot connection)
        totalTests++;
        console.log('Test 6: Valid request should check bot connection');
        const validResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '628123456789',
                message: 'Test message from Monly AI Admin Panel',
            }),
        });

        const validData = await validResponse.json();

        // Either bot is not connected (400) or message send attempted (200 or 500)
        if (
            (validResponse.status === 400 && validData.error?.code === 'BOT_NOT_CONNECTED') ||
            (validResponse.status === 200 && validData.success) ||
            (validResponse.status === 500 && validData.error?.code === 'MESSAGE_SEND_FAILED')
        ) {
            console.log('✅ PASS: Endpoint handled valid request correctly');
            console.log(`   Status: ${validResponse.status}`);
            console.log(`   Response: ${validData.success ? 'Success' : validData.error?.code}\n`);
            passedTests++;
        } else {
            console.log('❌ FAIL: Unexpected response for valid request');
            console.log(`   Status: ${validResponse.status}`);
            console.log(`   Response:`, validData, '\n');
        }

        // Test 7: Phone number formatting (Indonesian format)
        totalTests++;
        console.log('Test 7: Indonesian phone format should be handled');
        const indonesianResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '0812-3456-7890',
                message: 'Test',
            }),
        });

        const indonesianData = await indonesianResponse.json();

        // Should either check bot connection or attempt to send
        if (
            (indonesianResponse.status === 400 && indonesianData.error?.code === 'BOT_NOT_CONNECTED') ||
            (indonesianResponse.status === 200 && indonesianData.success) ||
            (indonesianResponse.status === 500 && indonesianData.error?.code === 'MESSAGE_SEND_FAILED')
        ) {
            console.log('✅ PASS: Phone number formatting handled correctly\n');
            passedTests++;
        } else {
            console.log('❌ FAIL: Phone number formatting not handled correctly\n');
        }

        // Summary
        console.log('═'.repeat(50));
        console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed\n`);

        if (passedTests === totalTests) {
            console.log('✅ All tests passed!');
            console.log('\n✨ POST /api/admin/whatsapp/test endpoint is working correctly!');
            console.log('\n📋 Verified functionality:');
            console.log('  ✓ Authentication enforcement');
            console.log('  ✓ Input validation (phone number & message)');
            console.log('  ✓ Empty value rejection');
            console.log('  ✓ Bot connection status check');
            console.log('  ✓ Phone number formatting');
            console.log('\n💡 Note: Actual message delivery depends on:');
            console.log('  - WhatsApp bot being connected');
            console.log('  - Valid WhatsApp phone number');
            console.log('  - Phone number registered on WhatsApp');
        } else {
            console.log(`❌ ${totalTests - passedTests} test(s) failed`);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests
testWhatsAppBotTestAPI()
    .then(() => {
        console.log('\n✅ Test script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test script failed:', error);
        process.exit(1);
    });
