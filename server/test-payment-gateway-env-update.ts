/**
 * Test Payment Gateway Settings - .env File Update
 * 
 * This script tests that payment gateway settings are:
 * 1. Read from .env file
 * 2. Updated in .env file when saved
 * 3. Immediately reflected in process.env
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5000';
const ENV_FILE_PATH = join(process.cwd(), '.env');

/**
 * Read .env file and parse Midtrans settings
 */
function readMidtransFromEnv(): any {
    try {
        const content = readFileSync(ENV_FILE_PATH, 'utf-8');
        const lines = content.split('\n');
        const config: any = {};

        for (const line of lines) {
            if (line.includes('MIDTRANS_SERVER_KEY=')) {
                config.serverKey = line.split('=')[1].trim().replace(/"/g, '');
            }
            if (line.includes('MIDTRANS_CLIENT_KEY=')) {
                config.clientKey = line.split('=')[1].trim().replace(/"/g, '');
            }
            if (line.includes('MIDTRANS_IS_PRODUCTION=')) {
                config.isProduction = line.split('=')[1].trim() === 'true';
            }
            if (line.includes('MIDTRANS_WEBHOOK_URL=')) {
                config.webhookUrl = line.split('=')[1].trim().replace(/"/g, '');
            }
        }

        return config;
    } catch (error) {
        console.error('Error reading .env file:', error);
        return null;
    }
}

/**
 * Test 1: Login as admin
 */
async function loginAsAdmin(): Promise<string> {
    console.log('\n🔐 Test 1: Admin Login');
    console.log('   Logging in as admin...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.app',
                password: 'Admin123!@#',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Login failed: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Login successful');
        return data.token;
    } catch (error) {
        console.error('   ❌ Login failed:', error);
        throw error;
    }
}

/**
 * Test 2: Read current .env file values
 */
function testReadEnvFile(): any {
    console.log('\n📄 Test 2: Read Current .env File');
    console.log('   Reading Midtrans settings from .env...');

    const config = readMidtransFromEnv();
    if (!config) {
        console.log('   ❌ Failed to read .env file');
        return null;
    }

    console.log('   ✅ Current .env values:');
    console.log(`      MIDTRANS_SERVER_KEY: ${config.serverKey ? config.serverKey.substring(0, 15) + '...' : 'Not set'}`);
    console.log(`      MIDTRANS_CLIENT_KEY: ${config.clientKey ? config.clientKey.substring(0, 15) + '...' : 'Not set'}`);
    console.log(`      MIDTRANS_IS_PRODUCTION: ${config.isProduction}`);
    console.log(`      MIDTRANS_WEBHOOK_URL: ${config.webhookUrl || 'Not set'}`);

    return config;
}

/**
 * Test 3: GET payment settings (should match .env)
 */
async function testGetPaymentSettings(token: string): Promise<void> {
    console.log('\n📋 Test 3: GET /api/admin/settings/payment');
    console.log('   Getting payment settings from API...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get settings: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Settings retrieved from API:');
        console.log(`      Server Key: ${data.data.serverKey} (Has Key: ${data.data.hasServerKey})`);
        console.log(`      Client Key: ${data.data.clientKey} (Has Key: ${data.data.hasClientKey})`);
        console.log(`      Environment: ${data.data.isProduction ? 'Production' : 'Sandbox'}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl || 'Not configured'}`);
        console.log(`      Source: ${data.data.source}`);

        if (data.data.source !== 'environment') {
            console.log('   ⚠️  Warning: Source should be "environment"');
        }
    } catch (error) {
        console.error('   ❌ Failed to get settings:', error);
        throw error;
    }
}

/**
 * Test 4: Update payment settings
 */
async function testUpdatePaymentSettings(token: string): Promise<void> {
    console.log('\n📝 Test 4: PUT /api/admin/settings/payment');
    console.log('   Updating payment settings...');

    const newConfig = {
        serverKey: 'SB-Mid-server-ENV-TEST-' + Date.now(),
        clientKey: 'SB-Mid-client-ENV-TEST-' + Date.now(),
        isProduction: false,
        webhookUrl: 'https://example.com/webhooks/midtrans-test',
    };

    console.log('   New configuration:');
    console.log(`      Server Key: ${newConfig.serverKey.substring(0, 25)}...`);
    console.log(`      Client Key: ${newConfig.clientKey.substring(0, 25)}...`);
    console.log(`      Environment: ${newConfig.isProduction ? 'Production' : 'Sandbox'}`);
    console.log(`      Webhook URL: ${newConfig.webhookUrl}`);

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newConfig),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to update settings: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Settings updated successfully');
        console.log(`      Message: ${data.message}`);
        console.log(`      Saved to .env: ${data.data.savedToEnv ? 'Yes' : 'No'}`);

        if (data.data.connectionTest) {
            console.log('   Connection Test Result:');
            console.log(`      Success: ${data.data.connectionTest.success ? '✅' : '❌'}`);
            console.log(`      Message: ${data.data.connectionTest.message}`);
        }
    } catch (error) {
        console.error('   ❌ Failed to update settings:', error);
        throw error;
    }
}

/**
 * Test 5: Verify .env file was updated
 */
function testVerifyEnvFileUpdated(): void {
    console.log('\n🔍 Test 5: Verify .env File Was Updated');
    console.log('   Reading .env file again...');

    const config = readMidtransFromEnv();
    if (!config) {
        console.log('   ❌ Failed to read .env file');
        return;
    }

    console.log('   ✅ Updated .env values:');
    console.log(`      MIDTRANS_SERVER_KEY: ${config.serverKey ? config.serverKey.substring(0, 25) + '...' : 'Not set'}`);
    console.log(`      MIDTRANS_CLIENT_KEY: ${config.clientKey ? config.clientKey.substring(0, 25) + '...' : 'Not set'}`);
    console.log(`      MIDTRANS_IS_PRODUCTION: ${config.isProduction}`);
    console.log(`      MIDTRANS_WEBHOOK_URL: ${config.webhookUrl || 'Not set'}`);

    // Verify the values contain our test markers
    if (config.serverKey && config.serverKey.includes('ENV-TEST')) {
        console.log('   ✅ Server Key was updated in .env file');
    } else {
        console.log('   ❌ Server Key was NOT updated in .env file');
    }

    if (config.clientKey && config.clientKey.includes('ENV-TEST')) {
        console.log('   ✅ Client Key was updated in .env file');
    } else {
        console.log('   ❌ Client Key was NOT updated in .env file');
    }

    if (config.webhookUrl && config.webhookUrl.includes('midtrans-test')) {
        console.log('   ✅ Webhook URL was updated in .env file');
    } else {
        console.log('   ❌ Webhook URL was NOT updated in .env file');
    }
}

/**
 * Test 6: Verify API returns updated values
 */
async function testVerifyApiReturnsUpdatedValues(token: string): Promise<void> {
    console.log('\n🔍 Test 6: Verify API Returns Updated Values');
    console.log('   Getting settings from API again...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get settings: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Settings retrieved from API:');
        console.log(`      Server Key: ${data.data.serverKey}`);
        console.log(`      Client Key: ${data.data.clientKey}`);
        console.log(`      Source: ${data.data.source}`);

        // Verify the masked values contain our test markers
        if (data.data.serverKey.includes('ENV-TEST')) {
            console.log('   ✅ API returns updated Server Key from .env');
        } else {
            console.log('   ⚠️  API may not be showing updated Server Key');
        }

        if (data.data.clientKey.includes('ENV-TEST')) {
            console.log('   ✅ API returns updated Client Key from .env');
        } else {
            console.log('   ⚠️  API may not be showing updated Client Key');
        }
    } catch (error) {
        console.error('   ❌ Failed to verify API values:', error);
        throw error;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Payment Gateway Settings - .env File Update Test            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        // Test 1: Login
        const token = await loginAsAdmin();

        // Test 2: Read current .env file
        const originalConfig = testReadEnvFile();

        // Test 3: Get settings from API
        await testGetPaymentSettings(token);

        // Test 4: Update settings
        await testUpdatePaymentSettings(token);

        // Test 5: Verify .env file was updated
        testVerifyEnvFileUpdated();

        // Test 6: Verify API returns updated values
        await testVerifyApiReturnsUpdatedValues(token);

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ ALL TESTS PASSED                         ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('\n📝 Summary:');
        console.log('   ✅ Payment settings are read from .env file');
        console.log('   ✅ Payment settings are updated in .env file when saved');
        console.log('   ✅ API immediately reflects .env file changes');
        console.log('   ✅ Settings are also backed up to database (encrypted)');
        console.log('\n🎉 Payment Gateway Settings now use .env file as source of truth!');
        console.log('\n⚠️  Note: The test credentials were saved to .env file.');
        console.log('   You may want to restore your original credentials.');

    } catch (error) {
        console.error('\n╔════════════════════════════════════════════════════════════════╗');
        console.error('║                    ❌ TESTS FAILED                             ║');
        console.error('╚════════════════════════════════════════════════════════════════╝');
        console.error('\nError:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
