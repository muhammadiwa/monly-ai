/**
 * Test Payment Gateway Configuration API
 * 
 * This script tests the payment gateway configuration endpoints:
 * - GET /api/admin/settings/payment - Get payment gateway configuration
 * - PUT /api/admin/settings/payment - Update payment gateway configuration
 * 
 * Requirements: 9.4
 */

const BASE_URL = 'http://localhost:5000';

// Admin credentials for testing
const ADMIN_EMAIL = 'admin@monly.app';
const ADMIN_PASSWORD = 'Admin123!@#';

// Test payment gateway configuration
const TEST_CONFIG = {
    serverKey: 'SB-Mid-server-TEST123456789',
    clientKey: 'SB-Mid-client-TEST123456789',
    isProduction: false,
    webhookUrl: 'http://localhost:5000/api/webhooks/midtrans',
};

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    data?: any;
}

const results: TestResult[] = [];

/**
 * Admin login to get authentication token
 */
async function adminLogin(): Promise<string> {
    console.log('\n🔐 Logging in as admin...');

    const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Admin login failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Admin login successful');
    console.log(`   Admin: ${data.admin.name} (${data.admin.email})`);

    return data.token;
}

/**
 * Test 1: GET /api/admin/settings/payment - Get current payment gateway configuration
 */
async function testGetPaymentConfig(token: string): Promise<void> {
    console.log('\n📋 Test 1: GET /api/admin/settings/payment');
    console.log('   Getting current payment gateway configuration...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            results.push({
                name: 'GET Payment Config',
                passed: false,
                message: `Failed: ${data.error?.message || response.statusText}`,
                data,
            });
            console.log(`   ❌ Failed: ${data.error?.message || response.statusText}`);
            return;
        }

        // Verify response structure
        if (!data.success || !data.data) {
            results.push({
                name: 'GET Payment Config',
                passed: false,
                message: 'Invalid response structure',
                data,
            });
            console.log('   ❌ Invalid response structure');
            return;
        }

        console.log('   ✅ Payment gateway configuration retrieved successfully');
        console.log('   Configuration:');
        console.log(`      Server Key: ${data.data.serverKey}`);
        console.log(`      Client Key: ${data.data.clientKey}`);
        console.log(`      Is Production: ${data.data.isProduction}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl}`);
        console.log(`      Has Server Key: ${data.data.hasServerKey}`);
        console.log(`      Has Client Key: ${data.data.hasClientKey}`);
        console.log(`      Source: ${data.data.source}`);

        results.push({
            name: 'GET Payment Config',
            passed: true,
            message: 'Successfully retrieved payment gateway configuration',
            data: data.data,
        });
    } catch (error) {
        results.push({
            name: 'GET Payment Config',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 2: PUT /api/admin/settings/payment - Update payment gateway configuration
 */
async function testUpdatePaymentConfig(token: string): Promise<void> {
    console.log('\n📝 Test 2: PUT /api/admin/settings/payment');
    console.log('   Updating payment gateway configuration...');
    console.log('   New configuration:');
    console.log(`      Server Key: ${TEST_CONFIG.serverKey}`);
    console.log(`      Client Key: ${TEST_CONFIG.clientKey}`);
    console.log(`      Is Production: ${TEST_CONFIG.isProduction}`);
    console.log(`      Webhook URL: ${TEST_CONFIG.webhookUrl}`);

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(TEST_CONFIG),
        });

        const data = await response.json();

        if (!response.ok) {
            results.push({
                name: 'UPDATE Payment Config',
                passed: false,
                message: `Failed: ${data.error?.message || response.statusText}`,
                data,
            });
            console.log(`   ❌ Failed: ${data.error?.message || response.statusText}`);
            return;
        }

        // Verify response structure
        if (!data.success) {
            results.push({
                name: 'UPDATE Payment Config',
                passed: false,
                message: 'Invalid response structure',
                data,
            });
            console.log('   ❌ Invalid response structure');
            return;
        }

        console.log('   ✅ Payment gateway configuration updated successfully');
        console.log('   Response:');
        console.log(`      Message: ${data.message}`);
        console.log(`      Is Production: ${data.data.isProduction}`);
        console.log(`      Webhook URL: ${data.data.webhookUrl}`);
        console.log('   Connection Test:');
        console.log(`      Success: ${data.data.connectionTest.success}`);
        console.log(`      Message: ${data.data.connectionTest.message}`);

        results.push({
            name: 'UPDATE Payment Config',
            passed: true,
            message: 'Successfully updated payment gateway configuration',
            data: data.data,
        });
    } catch (error) {
        results.push({
            name: 'UPDATE Payment Config',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 3: Verify updated configuration is persisted
 */
async function testVerifyUpdatedConfig(token: string): Promise<void> {
    console.log('\n🔍 Test 3: Verify updated configuration is persisted');
    console.log('   Getting payment gateway configuration again...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            results.push({
                name: 'VERIFY Updated Config',
                passed: false,
                message: `Failed: ${data.error?.message || response.statusText}`,
                data,
            });
            console.log(`   ❌ Failed: ${data.error?.message || response.statusText}`);
            return;
        }

        // Verify the configuration was updated
        const config = data.data;

        // Check if credentials are masked (they should be)
        const hasServerKey = config.hasServerKey === true;
        const hasClientKey = config.hasClientKey === true;
        const isProduction = config.isProduction === TEST_CONFIG.isProduction;
        const webhookUrl = config.webhookUrl === TEST_CONFIG.webhookUrl;
        const isFromDatabase = config.source === 'database';

        if (hasServerKey && hasClientKey && isProduction && webhookUrl && isFromDatabase) {
            console.log('   ✅ Configuration verified successfully');
            console.log('   Verified:');
            console.log(`      Has Server Key: ${hasServerKey}`);
            console.log(`      Has Client Key: ${hasClientKey}`);
            console.log(`      Is Production: ${isProduction}`);
            console.log(`      Webhook URL: ${webhookUrl}`);
            console.log(`      Source: ${config.source}`);

            results.push({
                name: 'VERIFY Updated Config',
                passed: true,
                message: 'Configuration persisted correctly',
                data: config,
            });
        } else {
            console.log('   ❌ Configuration mismatch');
            console.log('   Expected:');
            console.log(`      Has Server Key: true, Got: ${hasServerKey}`);
            console.log(`      Has Client Key: true, Got: ${hasClientKey}`);
            console.log(`      Is Production: ${TEST_CONFIG.isProduction}, Got: ${config.isProduction}`);
            console.log(`      Webhook URL: ${TEST_CONFIG.webhookUrl}, Got: ${config.webhookUrl}`);
            console.log(`      Source: database, Got: ${config.source}`);

            results.push({
                name: 'VERIFY Updated Config',
                passed: false,
                message: 'Configuration mismatch',
                data: config,
            });
        }
    } catch (error) {
        results.push({
            name: 'VERIFY Updated Config',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 4: Test validation - Invalid server key
 */
async function testInvalidServerKey(token: string): Promise<void> {
    console.log('\n🚫 Test 4: Test validation - Invalid server key');
    console.log('   Attempting to update with empty server key...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                serverKey: '',
                clientKey: TEST_CONFIG.clientKey,
                isProduction: false,
            }),
        });

        const data = await response.json();

        if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR') {
            console.log('   ✅ Validation error returned as expected');
            console.log(`      Error: ${data.error.message}`);

            results.push({
                name: 'VALIDATION Invalid Server Key',
                passed: true,
                message: 'Validation correctly rejected empty server key',
                data,
            });
        } else {
            console.log('   ❌ Expected validation error, but got different response');
            console.log(`      Status: ${response.status}`);
            console.log(`      Response: ${JSON.stringify(data, null, 2)}`);

            results.push({
                name: 'VALIDATION Invalid Server Key',
                passed: false,
                message: 'Did not receive expected validation error',
                data,
            });
        }
    } catch (error) {
        results.push({
            name: 'VALIDATION Invalid Server Key',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 5: Test unauthorized access
 */
async function testUnauthorizedAccess(): Promise<void> {
    console.log('\n🔒 Test 5: Test unauthorized access');
    console.log('   Attempting to access without authentication...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/payment`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.status === 401 && data.error?.code === 'UNAUTHORIZED') {
            console.log('   ✅ Unauthorized access blocked as expected');
            console.log(`      Error: ${data.error.message}`);

            results.push({
                name: 'UNAUTHORIZED Access',
                passed: true,
                message: 'Unauthorized access correctly blocked',
                data,
            });
        } else {
            console.log('   ❌ Expected unauthorized error, but got different response');
            console.log(`      Status: ${response.status}`);
            console.log(`      Response: ${JSON.stringify(data, null, 2)}`);

            results.push({
                name: 'UNAUTHORIZED Access',
                passed: false,
                message: 'Did not receive expected unauthorized error',
                data,
            });
        }
    } catch (error) {
        results.push({
            name: 'UNAUTHORIZED Access',
            passed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Print test summary
 */
function printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    results.forEach((result, index) => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${index + 1}. ${result.name}: ${result.message}`);
    });

    console.log('\n' + '-'.repeat(80));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
    console.log('='.repeat(80));
    console.log('🧪 PAYMENT GATEWAY CONFIGURATION API TESTS');
    console.log('='.repeat(80));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Admin Email: ${ADMIN_EMAIL}`);

    try {
        // Login as admin
        const token = await adminLogin();

        // Run tests
        await testGetPaymentConfig(token);
        await testUpdatePaymentConfig(token);
        await testVerifyUpdatedConfig(token);
        await testInvalidServerKey(token);
        await testUnauthorizedAccess();

        // Print summary
        printSummary();
    } catch (error) {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
