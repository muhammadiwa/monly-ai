/**
 * Test script for Midtrans Status API endpoint
 * 
 * This script tests the GET /api/admin/midtrans/status endpoint
 * to verify Midtrans API connection and credentials status.
 * 
 * Requirements: 10.1, 10.3
 */

import { db } from './db';
import { adminUsers } from '../shared/schema';
import bcrypt from 'bcryptjs';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to create admin user for testing
async function createTestAdmin() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminId = `admin-test-${Date.now()}`;

    try {
        db.insert(adminUsers).values({
            id: adminId,
            email: 'test-admin@example.com',
            name: 'Test Admin',
            password: hashedPassword,
            role: 'admin',
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
        }).run();

        console.log('✅ Test admin created:', adminId);
        return adminId;
    } catch (error) {
        console.log('ℹ️  Test admin might already exist, continuing...');
        return adminId;
    }
}

// Helper function to login and get token
async function loginAdmin(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: 'test-admin@example.com',
            password: 'admin123',
        }),
    });

    if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
}

// Test GET /api/admin/midtrans/status
async function testMidtransStatus(token: string) {
    console.log('\n📊 Testing GET /api/admin/midtrans/status...');

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/status`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    console.log('Status:', response.status);

    if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Request failed:', errorData);
        throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));

    // Validate response structure
    if (!data.success) {
        throw new Error('Response success is false');
    }

    if (!data.data) {
        throw new Error('Response data is missing');
    }

    // Validate required fields
    const requiredFields = [
        'connectionStatus',
        'connectionMessage',
        'apiReachable',
        'credentials',
        'environment',
        'webhookUrl'
    ];

    for (const field of requiredFields) {
        if (!(field in data.data)) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Validate credentials object
    const credentialsFields = [
        'serverKey',
        'clientKey',
        'isConfigured',
        'hasServerKey',
        'hasClientKey'
    ];

    for (const field of credentialsFields) {
        if (!(field in data.data.credentials)) {
            throw new Error(`Missing credentials field: ${field}`);
        }
    }

    // Validate environment object
    const environmentFields = ['isProduction', 'apiUrl'];

    for (const field of environmentFields) {
        if (!(field in data.data.environment)) {
            throw new Error(`Missing environment field: ${field}`);
        }
    }

    // Validate connection status values
    const validStatuses = ['connected', 'disconnected', 'not_configured'];
    if (!validStatuses.includes(data.data.connectionStatus)) {
        throw new Error(`Invalid connection status: ${data.data.connectionStatus}`);
    }

    // Check that credentials are masked (should contain '...')
    if (data.data.credentials.hasServerKey && !data.data.credentials.serverKey.includes('...')) {
        throw new Error('Server key should be masked');
    }

    if (data.data.credentials.hasClientKey && !data.data.credentials.clientKey.includes('...')) {
        throw new Error('Client key should be masked');
    }

    console.log('\n📋 Midtrans Status Summary:');
    console.log('  Connection Status:', data.data.connectionStatus);
    console.log('  API Reachable:', data.data.apiReachable);
    console.log('  Is Configured:', data.data.credentials.isConfigured);
    console.log('  Has Server Key:', data.data.credentials.hasServerKey);
    console.log('  Has Client Key:', data.data.credentials.hasClientKey);
    console.log('  Environment:', data.data.environment.isProduction ? 'Production' : 'Sandbox');
    console.log('  API URL:', data.data.environment.apiUrl);
    console.log('  Webhook URL:', data.data.webhookUrl);
    console.log('  Message:', data.data.connectionMessage);

    return data;
}

// Test without authentication (should fail)
async function testWithoutAuth() {
    console.log('\n🔒 Testing without authentication (should fail)...');

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/status`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    console.log('Status:', response.status);

    if (response.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Correctly rejected:', data.error.message);
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting Midtrans Status API Tests...\n');

    try {
        // Create test admin
        await createTestAdmin();

        // Test without authentication
        await testWithoutAuth();

        // Login to get token
        console.log('\n🔐 Logging in as admin...');
        const token = await loginAdmin();
        console.log('✅ Login successful');

        // Test Midtrans status endpoint
        await testMidtransStatus(token);

        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
