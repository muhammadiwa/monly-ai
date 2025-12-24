/**
 * Test Admin Dashboard Authentication Flow
 * 
 * This script tests the complete authentication flow:
 * 1. Login with admin credentials
 * 2. Verify token with /api/admin/auth/me
 * 3. Fetch dashboard metrics
 * 4. Fetch recent activity
 */

const BASE_URL = 'http://localhost:5000';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

async function testAdminDashboardFlow() {
    console.log('🚀 Testing Admin Dashboard Authentication Flow');
    console.log('   Base URL:', BASE_URL);
    console.log('   Make sure the server is running on port 5000\n');

    let adminToken = '';

    // Test 1: Login
    try {
        console.log('🧪 Test 1: Admin Login');
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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Login failed: ${data.error?.message || 'Unknown error'}`);
        }

        if (!data.token) {
            throw new Error('No token received');
        }

        adminToken = data.token;
        console.log('✅ Login successful');
        console.log('   Token:', adminToken.substring(0, 20) + '...');
        console.log('   Admin:', data.admin.name, `(${data.admin.role})`);
        results.push({ name: 'Admin Login', passed: true });
    } catch (error) {
        console.error('❌ Login failed:', error);
        results.push({ name: 'Admin Login', passed: false, error: String(error) });
        return; // Can't continue without token
    }

    // Test 2: Verify token with /api/admin/auth/me
    try {
        console.log('\n🧪 Test 2: Verify Token');
        const response = await fetch(`${BASE_URL}/api/admin/auth/me`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Token verification failed: ${data.error?.message || 'Unknown error'}`);
        }

        console.log('✅ Token verified');
        console.log('   Admin ID:', data.admin.id);
        console.log('   Email:', data.admin.email);
        console.log('   Role:', data.admin.role);
        results.push({ name: 'Token Verification', passed: true });
    } catch (error) {
        console.error('❌ Token verification failed:', error);
        results.push({ name: 'Token Verification', passed: false, error: String(error) });
    }

    // Test 3: Fetch dashboard metrics
    try {
        console.log('\n🧪 Test 3: Fetch Dashboard Metrics');
        const response = await fetch(`${BASE_URL}/api/admin/dashboard/metrics`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to fetch metrics: ${data.error?.message || 'Unknown error'}`);
        }

        console.log('✅ Dashboard metrics fetched');
        console.log('   Total Users:', data.data.users.total);
        console.log('   Active Users:', data.data.users.active);
        console.log('   MRR:', data.data.revenue.mrr);
        console.log('   Total Subscriptions:', data.data.subscriptions.total);
        results.push({ name: 'Dashboard Metrics', passed: true });
    } catch (error) {
        console.error('❌ Failed to fetch dashboard metrics:', error);
        results.push({ name: 'Dashboard Metrics', passed: false, error: String(error) });
    }

    // Test 4: Fetch recent activity
    try {
        console.log('\n🧪 Test 4: Fetch Recent Activity');
        const response = await fetch(`${BASE_URL}/api/admin/dashboard/recent-activity`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Failed to fetch recent activity: ${data.error?.message || 'Unknown error'}`);
        }

        console.log('✅ Recent activity fetched');
        console.log('   New Users:', data.data.newUsers.length);
        console.log('   New Subscriptions:', data.data.newSubscriptions.length);
        console.log('   Recent Payments:', data.data.recentPayments.length);
        results.push({ name: 'Recent Activity', passed: true });
    } catch (error) {
        console.error('❌ Failed to fetch recent activity:', error);
        results.push({ name: 'Recent Activity', passed: false, error: String(error) });
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`   Passed: ${passed}/${results.length}`);
    console.log(`   Failed: ${failed}/${results.length}`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    } else {
        console.log('\n🎉 All tests passed!');
        console.log('\n✅ Admin dashboard authentication flow is working correctly!');
        console.log('   You can now access: http://localhost:5000/admin/dashboard');
    }
}

// Run tests
testAdminDashboardFlow().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
