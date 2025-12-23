/**
 * Simple test for Subscription Analytics API
 * Tests the endpoint by first logging in to get a fresh token
 */

async function testSubscriptionAnalytics() {
    console.log('=== Testing Subscription Analytics API ===\n');

    try {
        const baseUrl = 'http://localhost:5000';

        // Step 1: Login to get a fresh token
        console.log('1. Logging in as admin...');
        const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
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
            const errorData = await loginResponse.json();
            throw new Error(`Login failed: ${JSON.stringify(errorData)}`);
        }

        const loginResult = await loginResponse.json();
        const token = loginResult.token;
        console.log('✓ Login successful\n');

        // Step 2: Test subscription analytics endpoint
        console.log('2. Testing GET /api/admin/analytics/subscriptions...');
        const analyticsResponse = await fetch(`${baseUrl}/api/admin/analytics/subscriptions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!analyticsResponse.ok) {
            const errorData = await analyticsResponse.json();
            throw new Error(`Analytics request failed: ${JSON.stringify(errorData)}`);
        }

        const analyticsResult = await analyticsResponse.json();
        console.log('Response:', JSON.stringify(analyticsResult, null, 2));

        // Validate response
        if (!analyticsResult.success) {
            throw new Error('Response success is false');
        }

        if (!analyticsResult.data) {
            throw new Error('Response data is missing');
        }

        const analytics = analyticsResult.data;

        // Validate required fields
        const requiredFields = ['total', 'active', 'cancelled', 'churnRate', 'conversionRate', 'byPlan'];
        for (const field of requiredFields) {
            if (!(field in analytics)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        console.log('\n✓ Endpoint returned successful response');
        console.log('✓ All required fields present');
        console.log('\nAnalytics Summary:');
        console.log('  Total subscriptions:', analytics.total);
        console.log('  Active subscriptions:', analytics.active);
        console.log('  Cancelled subscriptions:', analytics.cancelled);
        console.log('  Churn rate:', analytics.churnRate + '%');
        console.log('  Conversion rate:', analytics.conversionRate + '%');
        console.log('  By plan:', JSON.stringify(analytics.byPlan, null, 2));

        console.log('\n=== All Tests Passed ===');
        console.log('✓ Subscription analytics API is working correctly');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testSubscriptionAnalytics()
    .then(() => {
        console.log('\n✓ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
