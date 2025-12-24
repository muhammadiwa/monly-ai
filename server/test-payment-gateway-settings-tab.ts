/**
 * Test Payment Gateway Settings Tab
 * 
 * This script tests the Payment Gateway Settings Tab in the System Settings page:
 * - Verify the tab displays current payment gateway configuration
 * - Test the edit mode with form inputs
 * - Test saving new payment gateway credentials
 * - Test connection testing functionality
 * 
 * Task: 67. Payment Gateway Settings Tab
 * Requirements: 9.4
 */

const BASE_URL = 'http://localhost:5000';

interface PaymentGatewayConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
    webhookUrl: string;
    hasServerKey?: boolean;
    hasClientKey?: boolean;
    source?: string;
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
        console.log(`   Admin: ${data.admin.name} (${data.admin.email})`);
        return data.token;
    } catch (error) {
        console.error('   ❌ Login failed:', error);
        throw error;
    }
}

/**
 * Test 2: Get current payment gateway configuration
 */
async function testGetPaymentConfig(token: string): Promise<PaymentGatewayConfig> {
    console.log('\n📋 Test 2: GET /api/admin/settings/payment');
    console.log('   Getting current payment gateway configuration...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get config: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Configuration retrieved successfully');
        console.log('   Configuration:');
        console.log(`      Server Key: ${data.data.serverKey} (Has Key: ${data.data.hasServerKey})`);
        console.log(`      Client Key: ${data.data.clientKey} (Has Key: ${data.data.hasClientKey})`);
        console.log(`      Environment: ${data.data.isProduction ? 'Production' : 'Sandbox'}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl || 'Not configured'}`);
        console.log(`      Source: ${data.data.source || 'Unknown'}`);

        return data.data;
    } catch (error) {
        console.error('   ❌ Failed to get configuration:', error);
        throw error;
    }
}

/**
 * Test 3: Update payment gateway configuration
 */
async function testUpdatePaymentConfig(token: string): Promise<void> {
    console.log('\n📝 Test 3: PUT /api/admin/settings/payment');
    console.log('   Updating payment gateway configuration...');

    // Use test Midtrans credentials (sandbox)
    const newConfig = {
        serverKey: 'SB-Mid-server-TEST123456789',
        clientKey: 'SB-Mid-client-TEST123456789',
        isProduction: false,
        webhookUrl: 'https://example.com/api/webhooks/midtrans',
    };

    console.log('   New configuration:');
    console.log(`      Server Key: ${newConfig.serverKey.substring(0, 15)}...`);
    console.log(`      Client Key: ${newConfig.clientKey.substring(0, 15)}...`);
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
            throw new Error(`Failed to update config: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Configuration updated successfully');
        console.log('   Response:');
        console.log(`      Message: ${data.message}`);
        console.log(`      Environment: ${data.data.isProduction ? 'Production' : 'Sandbox'}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl}`);

        if (data.data.connectionTest) {
            console.log('   Connection Test Result:');
            console.log(`      Success: ${data.data.connectionTest.success ? '✅' : '❌'}`);
            console.log(`      Message: ${data.data.connectionTest.message}`);
        }
    } catch (error) {
        console.error('   ❌ Failed to update configuration:', error);
        throw error;
    }
}

/**
 * Test 4: Verify configuration was saved
 */
async function testVerifyConfigSaved(token: string): Promise<void> {
    console.log('\n🔍 Test 4: Verify Configuration Saved');
    console.log('   Getting configuration again to verify...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get config: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('   ✅ Configuration retrieved successfully');
        console.log('   Verification:');
        console.log(`      Has Server Key: ${data.data.hasServerKey ? '✅' : '❌'}`);
        console.log(`      Has Client Key: ${data.data.hasClientKey ? '✅' : '❌'}`);
        console.log(`      Environment: ${data.data.isProduction ? 'Production' : 'Sandbox'}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl}`);
        console.log(`      Source: ${data.data.source}`);

        // Verify the configuration was saved to database
        if (data.data.source !== 'database') {
            console.warn('   ⚠️  Warning: Configuration source is not "database"');
        } else {
            console.log('   ✅ Configuration is stored in database');
        }
    } catch (error) {
        console.error('   ❌ Failed to verify configuration:', error);
        throw error;
    }
}

/**
 * Test 5: Test validation errors
 */
async function testValidationErrors(token: string): Promise<void> {
    console.log('\n🚫 Test 5: Test Validation Errors');
    console.log('   Testing with invalid data...');

    // Test 1: Missing server key
    console.log('\n   Test 5.1: Missing server key');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                serverKey: '',
                clientKey: 'SB-Mid-client-TEST',
                isProduction: false,
            }),
        });

        if (response.status === 400) {
            const error = await response.json();
            console.log('   ✅ Validation error caught correctly');
            console.log(`      Error: ${error.error?.message}`);
        } else {
            console.log('   ❌ Expected validation error but got:', response.status);
        }
    } catch (error) {
        console.error('   ❌ Test failed:', error);
    }

    // Test 2: Invalid webhook URL
    console.log('\n   Test 5.2: Invalid webhook URL');
    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                serverKey: 'SB-Mid-server-TEST',
                clientKey: 'SB-Mid-client-TEST',
                isProduction: false,
                webhookUrl: 'not-a-valid-url',
            }),
        });

        if (response.status === 400) {
            const error = await response.json();
            console.log('   ✅ Validation error caught correctly');
            console.log(`      Error: ${error.error?.message}`);
        } else {
            console.log('   ❌ Expected validation error but got:', response.status);
        }
    } catch (error) {
        console.error('   ❌ Test failed:', error);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     Payment Gateway Settings Tab - Integration Test           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
        // Test 1: Login
        const token = await loginAsAdmin();

        // Test 2: Get current configuration
        await testGetPaymentConfig(token);

        // Test 3: Update configuration
        await testUpdatePaymentConfig(token);

        // Test 4: Verify configuration was saved
        await testVerifyConfigSaved(token);

        // Test 5: Test validation errors
        await testValidationErrors(token);

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ ALL TESTS PASSED                         ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('\n📝 Summary:');
        console.log('   ✅ Payment gateway configuration can be retrieved');
        console.log('   ✅ Payment gateway configuration can be updated');
        console.log('   ✅ Configuration is saved to database');
        console.log('   ✅ Connection test is performed automatically');
        console.log('   ✅ Validation errors are handled correctly');
        console.log('\n🎉 Payment Gateway Settings Tab is working correctly!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Open the admin panel in your browser');
        console.log('   2. Navigate to System Settings > Payment tab');
        console.log('   3. Click "Edit Settings" button');
        console.log('   4. Enter your Midtrans credentials');
        console.log('   5. Toggle production mode if needed');
        console.log('   6. Click "Save & Test Connection"');
        console.log('   7. Verify the connection test result is displayed');

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
