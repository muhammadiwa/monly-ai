/**
 * Test script for Chart Data API endpoints
 * 
 * Tests:
 * - GET /api/admin/dashboard/charts/revenue
 * - GET /api/admin/dashboard/charts/user-growth
 * - GET /api/admin/dashboard/charts/subscriptions
 */

async function testChartDataAPI() {
    console.log('🧪 Testing Chart Data API Endpoints\n');

    try {
        // Login to get a fresh token
        console.log('🔐 Logging in as admin...');
        const loginResponse = await fetch('http://localhost:5000/api/admin/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.app',
                password: 'Admin123!@#',
            }),
        });

        if (!loginResponse.ok) {
            console.error('❌ Admin login failed');
            console.error('Status:', loginResponse.status);
            console.error('Response:', await loginResponse.text());
            process.exit(1);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;

        console.log('✅ Admin authenticated\n');

        // Test 1: Revenue Chart Data - Week
        console.log('📊 Test 1: GET /api/admin/dashboard/charts/revenue?period=week');
        const revenueWeekResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/revenue?period=week', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!revenueWeekResponse.ok) {
            console.error('❌ Failed to fetch revenue chart data (week)');
            console.error('Status:', revenueWeekResponse.status);
            console.error('Response:', await revenueWeekResponse.text());
        } else {
            const revenueWeekData = await revenueWeekResponse.json();
            console.log('✅ Revenue chart data (week) fetched successfully');
            console.log('   Labels count:', revenueWeekData.data.labels.length);
            console.log('   Data points:', revenueWeekData.data.data.length);
            console.log('   Sample labels:', revenueWeekData.data.labels.slice(0, 3));
            console.log('   Sample data:', revenueWeekData.data.data.slice(0, 3));
        }
        console.log('');

        // Test 2: Revenue Chart Data - Month
        console.log('📊 Test 2: GET /api/admin/dashboard/charts/revenue?period=month');
        const revenueMonthResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/revenue?period=month', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!revenueMonthResponse.ok) {
            console.error('❌ Failed to fetch revenue chart data (month)');
            console.error('Status:', revenueMonthResponse.status);
        } else {
            const revenueMonthData = await revenueMonthResponse.json();
            console.log('✅ Revenue chart data (month) fetched successfully');
            console.log('   Labels count:', revenueMonthData.data.labels.length);
            console.log('   Data points:', revenueMonthData.data.data.length);
        }
        console.log('');

        // Test 3: Revenue Chart Data - Year
        console.log('📊 Test 3: GET /api/admin/dashboard/charts/revenue?period=year');
        const revenueYearResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/revenue?period=year', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!revenueYearResponse.ok) {
            console.error('❌ Failed to fetch revenue chart data (year)');
            console.error('Status:', revenueYearResponse.status);
        } else {
            const revenueYearData = await revenueYearResponse.json();
            console.log('✅ Revenue chart data (year) fetched successfully');
            console.log('   Labels count:', revenueYearData.data.labels.length);
            console.log('   Data points:', revenueYearData.data.data.length);
            console.log('   Sample labels:', revenueYearData.data.labels.slice(0, 3));
        }
        console.log('');

        // Test 4: User Growth Chart Data - Week
        console.log('📊 Test 4: GET /api/admin/dashboard/charts/user-growth?period=week');
        const userGrowthResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/user-growth?period=week', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!userGrowthResponse.ok) {
            console.error('❌ Failed to fetch user growth chart data');
            console.error('Status:', userGrowthResponse.status);
        } else {
            const userGrowthData = await userGrowthResponse.json();
            console.log('✅ User growth chart data fetched successfully');
            console.log('   Labels count:', userGrowthData.data.labels.length);
            console.log('   Data points:', userGrowthData.data.data.length);
            console.log('   Sample labels:', userGrowthData.data.labels.slice(0, 3));
            console.log('   Sample data:', userGrowthData.data.data.slice(0, 3));
        }
        console.log('');

        // Test 5: Subscription Trend Chart Data - Month
        console.log('📊 Test 5: GET /api/admin/dashboard/charts/subscriptions?period=month');
        const subscriptionTrendResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/subscriptions?period=month', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!subscriptionTrendResponse.ok) {
            console.error('❌ Failed to fetch subscription trend chart data');
            console.error('Status:', subscriptionTrendResponse.status);
        } else {
            const subscriptionTrendData = await subscriptionTrendResponse.json();
            console.log('✅ Subscription trend chart data fetched successfully');
            console.log('   Labels count:', subscriptionTrendData.data.labels.length);
            console.log('   Data points:', subscriptionTrendData.data.data.length);
            console.log('   Sample labels:', subscriptionTrendData.data.labels.slice(0, 3));
            console.log('   Sample data:', subscriptionTrendData.data.data.slice(0, 3));
        }
        console.log('');

        // Test 6: Invalid period parameter
        console.log('📊 Test 6: GET /api/admin/dashboard/charts/revenue?period=invalid');
        const invalidPeriodResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/revenue?period=invalid', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (invalidPeriodResponse.status === 400) {
            const errorData = await invalidPeriodResponse.json();
            console.log('✅ Invalid period parameter correctly rejected');
            console.log('   Error code:', errorData.error.code);
            console.log('   Error message:', errorData.error.message);
        } else {
            console.error('❌ Invalid period should return 400 status');
        }
        console.log('');

        // Test 7: Missing period parameter
        console.log('📊 Test 7: GET /api/admin/dashboard/charts/revenue (no period)');
        const missingPeriodResponse = await fetch('http://localhost:5000/api/admin/dashboard/charts/revenue', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (missingPeriodResponse.status === 400) {
            const errorData = await missingPeriodResponse.json();
            console.log('✅ Missing period parameter correctly rejected');
            console.log('   Error code:', errorData.error.code);
        } else {
            console.error('❌ Missing period should return 400 status');
        }
        console.log('');

        console.log('✅ All Chart Data API tests completed!\n');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

// Run tests
testChartDataAPI();
