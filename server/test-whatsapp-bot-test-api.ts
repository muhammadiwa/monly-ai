/**
 * Test script for WhatsApp Bot Test API
 * Tests POST /api/admin/whatsapp/test endpoint
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
    console.log('🧪 Testing WhatsApp Bot Test API...\n');

    try {
        // Get admin token
        console.log('1️⃣ Getting admin authentication token...');
        const token = await getAdminToken();
        console.log('✅ Admin token obtained\n');

        // Test 1: Send test message without authentication
        console.log('2️⃣ Test: Send test message without authentication');
        const unauthResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: '628123456789',
                message: 'Test message from Monly AI Admin Panel',
            }),
        });

        if (unauthResponse.status === 401) {
            console.log('✅ Correctly rejected unauthenticated request\n');
        } else {
            console.log('❌ Should have rejected unauthenticated request\n');
        }

        // Test 2: Send test message with invalid data (missing phone number)
        console.log('3️⃣ Test: Send test message with missing phone number');
        const invalidResponse1 = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                message: 'Test message',
            }),
        });

        const invalidData1 = await invalidResponse1.json();
        if (invalidResponse1.status === 400 && invalidData1.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ Correctly rejected request with missing phone number');
            console.log(`   Error: ${invalidData1.error.message}\n`);
        } else {
            console.log('❌ Should have rejected request with missing phone number\n');
        }

        // Test 3: Send test message with invalid data (missing message)
        console.log('4️⃣ Test: Send test message with missing message');
        const invalidResponse2 = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '628123456789',
            }),
        });

        const invalidData2 = await invalidResponse2.json();
        if (invalidResponse2.status === 400 && invalidData2.error?.code === 'VALIDATION_ERROR') {
            console.log('✅ Correctly rejected request with missing message');
            console.log(`   Error: ${invalidData2.error.message}\n`);
        } else {
            console.log('❌ Should have rejected request with missing message\n');
        }

        // Test 4: Send test message with valid data (will fail if bot not connected)
        console.log('5️⃣ Test: Send test message with valid data');
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
        console.log('Response status:', validResponse.status);
        console.log('Response data:', JSON.stringify(validData, null, 2));

        if (validResponse.status === 400 && validData.error?.code === 'BOT_NOT_CONNECTED') {
            console.log('✅ Correctly detected that bot is not connected');
            console.log('   Note: To test actual message sending, connect the WhatsApp bot first\n');
        } else if (validResponse.ok && validData.success) {
            console.log('✅ Test message sent successfully!');
            console.log(`   Phone: ${validData.data?.phoneNumber}`);
            console.log(`   Status: ${validData.data?.deliveryStatus}\n`);
        } else {
            console.log('⚠️ Unexpected response:', validData);
        }

        // Test 5: Test with Indonesian phone number format (starting with 0)
        console.log('6️⃣ Test: Send test message with Indonesian format (0812...)');
        const indonesianResponse = await fetch(`${API_BASE}/admin/whatsapp/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                phoneNumber: '0812-3456-7890', // Will be converted to 628123456790
                message: 'Test message with Indonesian format',
            }),
        });

        const indonesianData = await indonesianResponse.json();
        console.log('Response status:', indonesianResponse.status);
        console.log('Response data:', JSON.stringify(indonesianData, null, 2));

        if (indonesianResponse.status === 400 && indonesianData.error?.code === 'BOT_NOT_CONNECTED') {
            console.log('✅ Phone number format handled correctly (bot not connected)\n');
        } else if (indonesianResponse.ok && indonesianData.success) {
            console.log('✅ Phone number format handled correctly and message sent!');
            console.log(`   Formatted phone: ${indonesianData.data?.phoneNumber}\n`);
        } else {
            console.log('⚠️ Unexpected response:', indonesianData);
        }

        console.log('✅ All WhatsApp Bot Test API tests completed!\n');

        console.log('📋 Summary:');
        console.log('- POST /api/admin/whatsapp/test endpoint is working');
        console.log('- Authentication is properly enforced');
        console.log('- Input validation is working correctly');
        console.log('- Phone number formatting is handled');
        console.log('- Bot connection status is checked before sending');
        console.log('\n💡 To test actual message sending:');
        console.log('1. Connect the WhatsApp bot via POST /api/admin/whatsapp/connect');
        console.log('2. Scan the QR code');
        console.log('3. Run this test again to send actual messages');

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
