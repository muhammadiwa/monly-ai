import { adminStorage } from './admin/admin-storage';

async function testDashboardMetrics() {
    console.log('Testing Dashboard Metrics API...\n');

    try {
        // Test user metrics
        console.log('1. Testing User Metrics...');
        const userMetrics = await adminStorage.getUserMetrics();
        console.log('User Metrics:', JSON.stringify(userMetrics, null, 2));
        console.log('✓ User metrics retrieved successfully\n');

        // Test subscription metrics
        console.log('2. Testing Subscription Metrics...');
        const subscriptionMetrics = await adminStorage.getSubscriptionMetrics();
        console.log('Subscription Metrics:', JSON.stringify(subscriptionMetrics, null, 2));
        console.log('✓ Subscription metrics retrieved successfully\n');

        // Test revenue metrics
        console.log('3. Testing Revenue Metrics...');
        const revenueMetrics = await adminStorage.getRevenueMetrics();
        console.log('Revenue Metrics:', JSON.stringify(revenueMetrics, null, 2));
        console.log('✓ Revenue metrics retrieved successfully\n');

        // Test system health metrics
        console.log('4. Testing System Health Metrics...');
        const systemHealthMetrics = await adminStorage.getSystemHealthMetrics();
        console.log('System Health Metrics:', JSON.stringify(systemHealthMetrics, null, 2));
        console.log('✓ System health metrics retrieved successfully\n');

        // Test recent activity
        console.log('5. Testing Recent Activity...');
        const recentActivity = await adminStorage.getRecentActivity();
        console.log('Recent Activity:');
        console.log('  - New Users:', recentActivity.newUsers.length);
        console.log('  - New Subscriptions:', recentActivity.newSubscriptions.length);
        console.log('  - Recent Payments:', recentActivity.recentPayments.length);
        console.log('✓ Recent activity retrieved successfully\n');

        console.log('✅ All dashboard metrics tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error testing dashboard metrics:', error);
        process.exit(1);
    }
}

testDashboardMetrics();
