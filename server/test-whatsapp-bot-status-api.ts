/**
 * Test script for WhatsApp Bot Status API endpoint
 * Tests GET /api/admin/whatsapp/status
 */

import { db } from './db';
import { adminUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const API_BASE_URL = 'http://localhost:5000';

// Helper function to get admin token
async function getAdminToken(): Promise<string> {
    try {
        // First, ensure we have an admin user
        const existingAdmin = await db.select()
            .from(adminUsers)
            .where(eq(adminUsers.email, 'admin@monly.com'))
            .limit(1);

        if (existingAdmin.length === 0) {
            // Create admin user
            const hashedPassword = await bcrypt.hash('Admin123!@#', 12);
            await db.insert(adminUsers).values({
                id: 'admin-test-' + Date.now(),
                email: 'admin@monly.com',
                name: 'Test Admin',
                password: hashedPassword,
                role: 'super_admin',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            console.log('✅ Created test admin user');
        }

        // Login to get token
        const loginResponse = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.com',
                password: 'Admin123!@#',
            }),
        });

        if (!loginResponse.ok) {
            const errorData = await loginResponse.json();
            throw new Error(`Login failed: ${JSON.stringify(errorData)}`);
        }

        const loginData = await loginResponse.json();
        console.log('✅ Admin login successful');
        return loginData.token;
    } catch (error) {
        console.error('❌ Error getting admin token:', error);
        throw error;
    }
}

// Test GET /api/admin/whatsapp/status
async function testGetWhatsAppBotStatus() {
    console.log('\n📱 Testing GET /api/admin/whatsapp/status...');

    try {
        const token = await getAdminToken();

        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            console.error('❌ Request failed with status:', response.status);
            return false;
        }

        // Validate response structure
        if (!data.success) {
            console.error('❌ Response indicates failure');
            return false;
        }

        if (!data.data) {
            console.error('❌ Missing data field in response');
            return false;
        }

        // Check required fields
        const requiredFields = ['connected', 'status'];
        for (const field of requiredFields) {
            if (!(field in data.data)) {
                console.error(`❌ Missing required field: ${field}`);
                return false;
            }
        }

        // Validate field types
        if (typeof data.data.connected !== 'boolean') {
            console.error('❌ connected field should be boolean');
            return false;
        }

        if (typeof data.data.status !== 'string') {
            console.error('❌ status field should be string');
            return false;
        }

        // Check optional fields based on status
        if (data.data.connected && data.data.status === 'ready') {
            console.log('✅ Bot is connected and ready');
            if (data.data.phoneNumber) {
                console.log(`   Phone number: ${data.data.phoneNumber}`);
            }
        } else if (data.data.status === 'qr_received' && data.data.qrCode) {
            console.log('✅ QR code is available for scanning');
            console.log(`   QR code length: ${data.data.qrCode.length} characters`);
        } else if (data.data.status === 'disconnected') {
            console.log('✅ Bot is disconnected (expected for fresh setup)');
        } else if (data.data.status === 'initializing') {
            console.log('✅ Bot is initializing');
        } else if (data.data.status === 'authenticated') {
            console.log('✅ Bot is authenticated');
        } else {
            console.log(`✅ Bot status: ${data.data.status}`);
        }

        if (data.data.message) {
            console.log(`   Message: ${data.data.message}`);
        }

        console.log('✅ WhatsApp Bot Status API test passed');
        return true;

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Test without authentication (should fail)
async function testUnauthorizedAccess() {
    console.log('\n🔒 Testing unauthorized access...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.status === 401) {
            console.log('✅ Unauthorized access correctly rejected');
            return true;
        } else {
            console.error('❌ Should have returned 401 for unauthorized access');
            console.log('Response:', JSON.stringify(data, null, 2));
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Starting WhatsApp Bot Status API Tests...');
    console.log('='.repeat(50));

    const results = {
        unauthorized: await testUnauthorizedAccess(),
        getStatus: await testGetWhatsAppBotStatus(),
    };

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results:');
    console.log('  Unauthorized Access:', results.unauthorized ? '✅ PASS' : '❌ FAIL');
    console.log('  Get WhatsApp Bot Status:', results.getStatus ? '✅ PASS' : '❌ FAIL');

    const allPassed = Object.values(results).every(result => result === true);
    console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'));

    process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
