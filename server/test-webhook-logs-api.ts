/**
 * Test script for Webhook Logs API endpoint
 * 
 * This script tests the GET /api/admin/midtrans/webhooks endpoint
 * to verify webhook logs retrieval with pagination and filtering.
 * 
 * Test cases:
 * 1. Fetch webhook logs with default pagination
 * 2. Fetch webhook logs with custom pagination
 * 3. Filter webhook logs by status
 * 4. Filter webhook logs by date range
 * 5. Test validation errors
 */

const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to login as admin
async function loginAsAdmin() {
    console.log('🔐 Logging in as admin...');

    const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
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
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.token) {
        throw new Error('Login failed: No token received');
    }

    console.log('✅ Admin login successful\n');
    return data.token;
}

// Test 1: Fetch webhook logs with default pagination
async function testDefaultPagination(token: string) {
    console.log('📊 Test 1: Fetching webhook logs with default pagination...');

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error(`❌ Failed: ${response.status} ${response.statusText}`);
        const errorData = await response.json();
        console.error('Error details:', JSON.stringify(errorData, null, 2));
        return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
        console.log('✅ Webhook logs fetched successfully');
        console.log(`   Total logs: ${data.data.total}`);
        console.log(`   Current page: ${data.data.page}`);
        console.log(`   Total pages: ${data.data.totalPages}`);
        console.log(`   Logs in this page: ${data.data.logs.length}`);

        if (data.data.logs.length > 0) {
            console.log('\n   Sample log:');
            const log = data.data.logs[0];
            console.log(`   - ID: ${log.id}`);
            console.log(`   - Order ID: ${log.orderId}`);
            console.log(`   - Event Type: ${log.eventType}`);
            console.log(`   - Status: ${log.status}`);
            console.log(`   - Created At: ${new Date(log.createdAt * 1000).toISOString()}`);
        }

        return true;
    } else {
        console.error('❌ Unexpected response format');
        console.error('Response:', JSON.stringify(data, null, 2));
        return false;
    }
}

// Test 2: Fetch webhook logs with custom pagination
async function testCustomPagination(token: string) {
    console.log('\n📊 Test 2: Fetching webhook logs with custom pagination (page=1, limit=5)...');

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?page=1&limit=5`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error(`❌ Failed: ${response.status} ${response.statusText}`);
        return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
        console.log('✅ Webhook logs fetched with custom pagination');
        console.log(`   Logs in this page: ${data.data.logs.length}`);
        console.log(`   Expected: <= 5`);

        if (data.data.logs.length <= 5) {
            console.log('   ✓ Pagination limit working correctly');
            return true;
        } else {
            console.error('   ❌ Pagination limit not working');
            return false;
        }
    } else {
        console.error('❌ Unexpected response format');
        return false;
    }
}

// Test 3: Filter webhook logs by status
async function testFilterByStatus(token: string) {
    console.log('\n📊 Test 3: Filtering webhook logs by status (status=processed)...');

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?status=processed`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error(`❌ Failed: ${response.status} ${response.statusText}`);
        return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
        console.log('✅ Webhook logs filtered by status');
        console.log(`   Total processed logs: ${data.data.total}`);

        // Verify all logs have status 'processed'
        const allProcessed = data.data.logs.every((log: any) => log.status === 'processed');

        if (allProcessed || data.data.logs.length === 0) {
            console.log('   ✓ Status filter working correctly');
            return true;
        } else {
            console.error('   ❌ Status filter not working - found logs with different status');
            return false;
        }
    } else {
        console.error('❌ Unexpected response format');
        return false;
    }
}

// Test 4: Filter webhook logs by date range
async function testFilterByDateRange(token: string) {
    console.log('\n📊 Test 4: Filtering webhook logs by date range...');

    // Get logs from last 7 days
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);

    const response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?dateFrom=${sevenDaysAgo}&dateTo=${now}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error(`❌ Failed: ${response.status} ${response.statusText}`);
        return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
        console.log('✅ Webhook logs filtered by date range');
        console.log(`   Logs in last 7 days: ${data.data.total}`);

        // Verify all logs are within date range
        const allInRange = data.data.logs.every((log: any) =>
            log.createdAt >= sevenDaysAgo && log.createdAt <= now
        );

        if (allInRange || data.data.logs.length === 0) {
            console.log('   ✓ Date range filter working correctly');
            return true;
        } else {
            console.error('   ❌ Date range filter not working');
            return false;
        }
    } else {
        console.error('❌ Unexpected response format');
        return false;
    }
}

// Test 5: Test validation errors
async function testValidationErrors(token: string) {
    console.log('\n📊 Test 5: Testing validation errors...');

    let allPassed = true;

    // Test invalid page
    console.log('   Testing invalid page parameter...');
    let response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?page=0`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 400) {
        console.log('   ✓ Invalid page parameter rejected');
    } else {
        console.error('   ❌ Invalid page parameter not rejected');
        allPassed = false;
    }

    // Test invalid limit
    console.log('   Testing invalid limit parameter...');
    response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?limit=200`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 400) {
        console.log('   ✓ Invalid limit parameter rejected');
    } else {
        console.error('   ❌ Invalid limit parameter not rejected');
        allPassed = false;
    }

    // Test invalid status
    console.log('   Testing invalid status parameter...');
    response = await fetch(`${API_BASE_URL}/admin/midtrans/webhooks?status=invalid`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 400) {
        console.log('   ✓ Invalid status parameter rejected');
    } else {
        console.error('   ❌ Invalid status parameter not rejected');
        allPassed = false;
    }

    return allPassed;
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting Webhook Logs API Tests\n');
    console.log('='.repeat(60));

    try {
        // Login as admin
        const token = await loginAsAdmin();

        // Run all tests
        const results = {
            test1: await testDefaultPagination(token),
            test2: await testCustomPagination(token),
            test3: await testFilterByStatus(token),
            test4: await testFilterByDateRange(token),
            test5: await testValidationErrors(token),
        };

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary:');
        console.log('='.repeat(60));

        const passed = Object.values(results).filter(r => r).length;
        const total = Object.values(results).length;

        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`❌ Failed: ${total - passed}/${total}`);

        if (passed === total) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the output above.');
        }

    } catch (error) {
        console.error('\n❌ Test execution failed:');
        console.error(error);
        process.exit(1);
    }
}

// Run tests
runTests();
