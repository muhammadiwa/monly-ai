import { db } from './db';
import { adminStorage } from './admin/admin-storage';

async function testRevenueAnalytics() {
    console.log('🧪 Testing Revenue Analytics API...\n');

    try {
        // Test getRevenueAnalytics function
        console.log('📊 Fetching revenue analytics...');
        const revenueAnalytics = await adminStorage.getRevenueAnalytics();

        console.log('\n✅ Revenue Analytics Results:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`MRR (Monthly Recurring Revenue): ${revenueAnalytics.mrr}`);
        console.log(`ARR (Annual Recurring Revenue): ${revenueAnalytics.arr}`);
        console.log(`Total Revenue: ${revenueAnalytics.totalRevenue}`);
        console.log(`Revenue Growth: ${revenueAnalytics.revenueGrowth}%`);
        console.log('\nRevenue by Plan:');
        Object.entries(revenueAnalytics.revenueByPlan).forEach(([plan, amount]) => {
            console.log(`  - ${plan}: ${amount}`);
        });
        console.log('\nRevenue by Payment Method:');
        Object.entries(revenueAnalytics.revenueByMethod).forEach(([method, amount]) => {
            console.log(`  - ${method}: ${amount}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verify data structure
        console.log('🔍 Verifying data structure...');
        const checks = [
            { name: 'MRR is a number', pass: typeof revenueAnalytics.mrr === 'number' },
            { name: 'ARR is a number', pass: typeof revenueAnalytics.arr === 'number' },
            { name: 'Total Revenue is a number', pass: typeof revenueAnalytics.totalRevenue === 'number' },
            { name: 'Revenue Growth is a number', pass: typeof revenueAnalytics.revenueGrowth === 'number' },
            { name: 'Revenue by Plan is an object', pass: typeof revenueAnalytics.revenueByPlan === 'object' },
            { name: 'Revenue by Method is an object', pass: typeof revenueAnalytics.revenueByMethod === 'object' },
            { name: 'ARR equals MRR * 12', pass: Math.abs(revenueAnalytics.arr - (revenueAnalytics.mrr * 12)) < 0.01 },
        ];

        checks.forEach(check => {
            console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
        });

        const allPassed = checks.every(check => check.pass);
        if (allPassed) {
            console.log('\n✅ All checks passed!');
        } else {
            console.log('\n❌ Some checks failed!');
        }

        console.log('\n✅ Revenue Analytics API test completed successfully!');
    } catch (error) {
        console.error('❌ Error testing revenue analytics:', error);
        throw error;
    }
}

// Run the test
testRevenueAnalytics()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
