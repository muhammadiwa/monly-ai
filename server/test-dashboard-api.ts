/**
 * Test script for Dashboard Metrics API endpoint
 * This tests the actual HTTP endpoint /api/admin/dashboard/metrics
 */

async function testDashboardAPI() {
    console.log('Testing Dashboard Metrics API Endpoint...\n');

    // First, we need to login as admin to get a token
    console.log('1. Logging in as admin...');

    const loginResponse = await fetch('http://localhost:5000/api/admin/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: 'admin@monly.ai',
            password: 'Admin123!@#',
        }),
    });

    if (!loginResponse.ok) {
        console.error('❌ Failed to login:', await loginResponse.text());
        process.exit(1);
    }

    const loginData = await loginResponse.json();
    console.log('✓ Login successful');
    console.log('  Admin:', loginData.admin.email);
    const token = loginData.token;

    // Now test the dashboard metrics endpoint
    console.log('\n2. Fetching dashboard metrics...');

    const metricsResponse = await fetch('http://localhost:5000/api/admin/dashboard/metrics', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!metricsResponse.ok) {
        console.error('❌ Failed to fetch metrics:', await metricsResponse.text());
        process.exit(1);
    }

    const metricsData = await metricsResponse.json();
    console.log('✓ Dashboard metrics retrieved successfully\n');

    console.log('Dashboard Metrics:');
    console.log('==================\n');

    console.log('User Metrics:');
    console.log('  Total Users:', metricsData.data.users.total);
    console.log('  Active Users:', metricsData.data.users.active);
    console.log('  New This Month:', metricsData.data.users.newThisMonth);
    console.log('  Growth Rate:', metricsData.data.users.growthRate + '%');

    console.log('\nSubscription Metrics:');
    console.log('  Total Subscriptions:', metricsData.data.subscriptions.total);
    console.log('  By Plan:', JSON.stringify(metricsData.data.subscriptions.byPlan, null, 2));
    console.log('  Churn Rate:', metricsData.data.subscriptions.churnRate + '%');
    console.log('  Conversion Rate:', metricsData.data.subscriptions.conversionRate + '%');

    console.log('\nRevenue Metrics:');
    console.log('  MRR:', metricsData.data.revenue.mrr);
    console.log('  Total Revenue:', metricsData.data.revenue.totalRevenue);
    console.log('  Revenue Growth:', metricsData.data.revenue.revenueGrowth + '%');
    console.log('  Revenue By Plan:', JSON.stringify(metricsData.data.revenue.revenueByPlan, null, 2));

    console.log('\nSystem Health:');
    console.log('  Database Size:', metricsData.data.system.databaseSize + ' MB');
    console.log('  API Response Time:', metricsData.data.system.apiResponseTime + ' ms');
    console.log('  Error Rate:', metricsData.data.system.errorRate + '%');
    console.log('  Uptime:', metricsData.data.system.uptime + ' seconds');

    console.log('\nRecent Activity:');
    console.log('  New Users:', metricsData.data.recentActivity.newUsers.length);
    console.log('  New Subscriptions:', metricsData.data.recentActivity.newSubscriptions.length);
    console.log('  Recent Payments:', metricsData.data.recentActivity.recentPayments.length);

    console.log('\n✅ All tests passed! Dashboard Metrics API is working correctly.');
}

// Run the test
testDashboardAPI().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
