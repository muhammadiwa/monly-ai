/**
 * Test script for WhatsApp Bot Connect API endpoint
 * Tests POST /api/admin/whatsapp/connect
 */

const API_BASE_URL = 'http://localhost:5000';

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

/**
 * Helper function to get admin token
 */
async function getAdminToken(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: 'admin@monly.com',
            password: 'Admin123!@#',
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to login: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success || !data.token) {
        throw new Error('Login response missing token');
    }

    return data.token;
}

/**
 * Helper function to add test result
 */
function addResult(name: string, passed: boolean, message: string) {
    results.push({ name, passed, message });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}: ${message}`);
}

/**
 * Test 1: Unauthorized access should return 401
 */
async function testUnauthorizedAccess() {
    console.log('\n🔒 Testing unauthorized access...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.status === 401) {
            const data = await response.json();
            if (data.success === false && data.error?.code === 'UNAUTHORIZED') {
                addResult('Unauthorized Access', true, 'Correctly returns 401 with UNAUTHORIZED error');
            } else {
                addResult('Unauthorized Access', false, 'Returns 401 but incorrect error format');
            }
        } else {
            addResult('Unauthorized Access', false, `Expected 401, got ${response.status}`);
        }
    } catch (error) {
        addResult('Unauthorized Access', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 2: Authorized access with valid admin token
 */
async function testAuthorizedAccess() {
    console.log('\n🔑 Testing authorized access...');

    try {
        const token = await getAdminToken();

        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Response data:', JSON.stringify(data, null, 2));

            if (data.success === true) {
                addResult('Authorized Access', true, 'Successfully connected/initialized bot');
            } else {
                addResult('Authorized Access', false, 'Response success is not true');
            }
        } else {
            const errorData = await response.json();
            addResult('Authorized Access', false, `Request failed: ${response.status} - ${JSON.stringify(errorData)}`);
        }
    } catch (error) {
        addResult('Authorized Access', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 3: Response structure validation
 */
async function testResponseStructure() {
    console.log('\n📋 Testing response structure...');

    try {
        const token = await getAdminToken();

        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();

            // Check required fields
            const hasSuccess = typeof data.success === 'boolean';
            const hasData = typeof data.data === 'object' && data.data !== null;
            const hasStatus = typeof data.data?.status === 'string';
            const hasConnected = typeof data.data?.connected === 'boolean';
            const hasMessage = typeof data.data?.message === 'string';

            if (hasSuccess && hasData && hasStatus && hasConnected && hasMessage) {
                addResult('Response Structure', true, 'All required fields present with correct types');
            } else {
                const missing = [];
                if (!hasSuccess) missing.push('success');
                if (!hasData) missing.push('data');
                if (!hasStatus) missing.push('data.status');
                if (!hasConnected) missing.push('data.connected');
                if (!hasMessage) missing.push('data.message');
                addResult('Response Structure', false, `Missing or incorrect fields: ${missing.join(', ')}`);
            }
        } else {
            addResult('Response Structure', false, `Request failed: ${response.status}`);
        }
    } catch (error) {
        addResult('Response Structure', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 4: Status-specific field validation
 */
async function testStatusSpecificFields() {
    console.log('\n🔍 Testing status-specific fields...');

    try {
        const token = await getAdminToken();

        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            const status = data.data?.status;

            console.log(`Bot status: ${status}`);
            console.log(`Connected: ${data.data?.connected}`);
            console.log(`Has QR code: ${!!data.data?.qrCode}`);
            console.log(`Message: ${data.data?.message}`);

            // Validate based on status
            if (status === 'ready' || status === 'authenticated') {
                if (data.data.connected === true) {
                    addResult('Status-Specific Fields', true, `Bot is ${status} and connected flag is true`);
                } else {
                    addResult('Status-Specific Fields', false, `Bot is ${status} but connected flag is not true`);
                }
            } else if (status === 'qr_received') {
                if (data.data.qrCode && typeof data.data.qrCode === 'string') {
                    addResult('Status-Specific Fields', true, 'QR code present when status is qr_received');
                } else {
                    addResult('Status-Specific Fields', false, 'QR code missing when status is qr_received');
                }
            } else if (status === 'disconnected' || status === 'initializing') {
                addResult('Status-Specific Fields', true, `Bot status is ${status} as expected`);
            } else {
                addResult('Status-Specific Fields', true, `Bot in transitional state: ${status}`);
            }
        } else {
            addResult('Status-Specific Fields', false, `Request failed: ${response.status}`);
        }
    } catch (error) {
        addResult('Status-Specific Fields', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 5: Multiple connect attempts (idempotency)
 */
async function testMultipleConnectAttempts() {
    console.log('\n🔄 Testing multiple connect attempts...');

    try {
        const token = await getAdminToken();

        // First connect attempt
        const response1 = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response1.ok) {
            addResult('Multiple Connect Attempts', false, `First request failed: ${response1.status}`);
            return;
        }

        const data1 = await response1.json();
        console.log('First attempt status:', data1.data?.status);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Second connect attempt
        const response2 = await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response2.ok) {
            addResult('Multiple Connect Attempts', false, `Second request failed: ${response2.status}`);
            return;
        }

        const data2 = await response2.json();
        console.log('Second attempt status:', data2.data?.status);

        // Both should succeed
        if (data1.success && data2.success) {
            addResult('Multiple Connect Attempts', true, 'Both connect attempts succeeded (idempotent)');
        } else {
            addResult('Multiple Connect Attempts', false, 'One or both connect attempts failed');
        }
    } catch (error) {
        addResult('Multiple Connect Attempts', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Test 6: Verify audit log entry
 */
async function testAuditLogEntry() {
    console.log('\n📝 Testing audit log entry...');

    try {
        const token = await getAdminToken();

        // Make a connect request
        await fetch(`${API_BASE_URL}/api/admin/whatsapp/connect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // Wait a bit for audit log to be written
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check audit log
        const auditResponse = await fetch(`${API_BASE_URL}/api/admin/settings/audit-log?limit=5`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (auditResponse.ok) {
            const auditData = await auditResponse.json();
            const logs = auditData.data?.logs || [];

            // Look for CONNECT_WHATSAPP_BOT action
            const connectLog = logs.find((log: any) => log.action === 'CONNECT_WHATSAPP_BOT');

            if (connectLog) {
                addResult('Audit Log Entry', true, 'CONNECT_WHATSAPP_BOT action logged in audit trail');
            } else {
                addResult('Audit Log Entry', false, 'CONNECT_WHATSAPP_BOT action not found in audit log');
            }
        } else {
            addResult('Audit Log Entry', false, `Failed to fetch audit log: ${auditResponse.status}`);
        }
    } catch (error) {
        addResult('Audit Log Entry', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🚀 Starting WhatsApp Bot Connect API Tests...\n');
    console.log('='.repeat(60));

    await testUnauthorizedAccess();
    await testAuthorizedAccess();
    await testResponseStructure();
    await testStatusSpecificFields();
    await testMultipleConnectAttempts();
    await testAuditLogEntry();

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});
