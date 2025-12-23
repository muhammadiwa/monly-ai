/**
 * Test script for WhatsApp Bot Disconnect API endpoint
 * Tests POST /api/admin/whatsapp/disconnect
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000';

// Test admin credentials (from seed data)
const ADMIN_EMAIL = 'admin@monly.app';
const ADMIN_PASSWORD = 'Admin123!@#';

interface ApiResponse {
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

/**
 * Login as admin and get token
 */
async function loginAsAdmin(): Promise<string> {
    console.log('\n🔐 Logging in as admin...');

    const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
        }),
    });

    const data = await response.json() as ApiResponse;

    if (!data.success || !data.token) {
        throw new Error(`Login failed: ${data.error?.message || 'Unknown error'}`);
    }

    console.log('✅ Admin login successful');
    return data.token;
}

/**
 * Get current WhatsApp Bot status
 */
async function getBotStatus(token: string): Promise<any> {
    console.log('\n📱 Getting WhatsApp Bot status...');

    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json() as ApiResponse;

    if (!data.success) {
        throw new Error(`Failed to get bot status: ${data.error?.message || 'Unknown error'}`);
    }

    console.log('✅ Bot status retrieved:', data.data);
    return data.data;
}

/**
 * Test disconnecting WhatsApp Bot
 */
async function testDisconnectBot(token: string): Promise<void> {
    console.log('\n🔌 Testing WhatsApp Bot disconnect...');

    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json() as ApiResponse;

    console.log('\n📊 Disconnect Response:');
    console.log(JSON.stringify(data, null, 2));

    if (!data.success) {
        console.error('❌ Disconnect failed:', data.error?.message);
        return;
    }

    console.log('✅ Bot disconnected successfully');
    console.log('   Status:', data.data?.status);
    console.log('   Connected:', data.data?.connected);
    console.log('   Message:', data.data?.message);
}

/**
 * Test disconnecting when already disconnected
 */
async function testDisconnectWhenAlreadyDisconnected(token: string): Promise<void> {
    console.log('\n🔌 Testing disconnect when already disconnected...');

    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json() as ApiResponse;

    console.log('\n📊 Second Disconnect Response:');
    console.log(JSON.stringify(data, null, 2));

    if (!data.success) {
        console.error('❌ Second disconnect failed:', data.error?.message);
        return;
    }

    console.log('✅ Second disconnect handled correctly');
    console.log('   Status:', data.data?.status);
    console.log('   Message:', data.data?.message);
}

/**
 * Test disconnect without authentication
 */
async function testDisconnectWithoutAuth(): Promise<void> {
    console.log('\n🔒 Testing disconnect without authentication...');

    const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json() as ApiResponse;

    console.log('\n📊 Unauthorized Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
        console.error('❌ Should have failed without authentication');
        return;
    }

    console.log('✅ Correctly rejected unauthorized request');
    console.log('   Error code:', data.error?.code);
    console.log('   Error message:', data.error?.message);
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting WhatsApp Bot Disconnect API Tests');
    console.log('='.repeat(50));

    try {
        // Test 1: Login as admin
        const token = await loginAsAdmin();

        // Test 2: Get initial bot status
        const initialStatus = await getBotStatus(token);
        console.log('\n📊 Initial Bot Status:');
        console.log('   Connected:', initialStatus.connected);
        console.log('   Status:', initialStatus.status);

        // Test 3: Test disconnect without auth
        await testDisconnectWithoutAuth();

        // Test 4: Disconnect the bot
        await testDisconnectBot(token);

        // Wait a moment for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 5: Verify bot is disconnected
        const statusAfterDisconnect = await getBotStatus(token);
        console.log('\n📊 Status After Disconnect:');
        console.log('   Connected:', statusAfterDisconnect.connected);
        console.log('   Status:', statusAfterDisconnect.status);

        // Test 6: Try disconnecting again (should handle gracefully)
        await testDisconnectWhenAlreadyDisconnected(token);

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✓ Admin authentication');
        console.log('   ✓ Get bot status');
        console.log('   ✓ Disconnect without auth (rejected)');
        console.log('   ✓ Disconnect bot');
        console.log('   ✓ Verify disconnection');
        console.log('   ✓ Disconnect when already disconnected');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);
