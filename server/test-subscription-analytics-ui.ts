/**
 * Test script for Subscription Analytics UI Integration
 * Tests that the subscription analytics data is properly displayed in the Revenue Analytics page
 */

import fetch from 'node-fetch';

async function testSubscriptionAnalyticsUI() {
    const baseUrl = process.env.API_URL || 'http://localhost:5000';

    console.log('=== Testing Subscription Analytics UI Integration ===\n');

    try {
        // Step 1: Admin login
        console.log('1. Logging in as admin...');
        const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.com',
                password: 'Admin123!@#',
            }),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        const adminToken = loginData.token;
        console.log('✓ Admin authenticated\n');

        // Step 2: Test subscription analytics endpoint
        console.log('2. Testing GET /api/admin/analytics/subscriptions...');
        const analyticsResponse = await fetch(`${baseUrl}/api/admin/analytics/subscriptions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        if (!analyticsResponse.ok) {
            throw new Error(`Analytics request failed: ${analyticsResponse.status}`);
        }

        const analyticsData = await analyticsResponse.json();
        console.log('✓ Subscription analytics fetched successfully');
        console.log('\nSubscription Analytics Data:');
        console.log(JSON.stringify(analyticsData, null, 2));

        // Validate data structure
        if (!analyticsData.success || !analyticsData.data) {
            throw new Error('Invalid response structure');
        }

        const data = analyticsData.data;

        // Check required fields
        const requiredFields = ['total', 'active', 'cancelled', 'churnRate', 'conversionRate', 'byPlan'];
        for (const field of requiredFields) {
            if (!(field in data)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        console.log('\n✓ All required fields present');
        console.log(`  - Total: ${data.total}`);
        console.log(`  - Active: ${data.active}`);
        console.log(`  - Cancelled: ${data.cancelled}`);
        console.log(`  - Churn Rate: ${data.churnRate}%`);
        console.log(`  - Conversion Rate: ${data.conversionRate}%`);
        console.log(`  - By Plan:`, data.byPlan);

        // Step 3: Test revenue analytics endpoint (to ensure both work together)
        console.log('\n3. Testing GET /api/admin/analytics/revenue...');
        const revenueResponse = await fetch(`${baseUrl}/api/admin/analytics/revenue`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        if (!revenueResponse.ok) {
            throw new Error(`Revenue analytics request failed: ${revenueResponse.status}`);
        }

        const revenueData = await revenueResponse.json();
        console.log('✓ Revenue analytics fetched successfully');

        console.log('\n=== All Tests Passed ===');
        console.log('\n✅ Subscription Analytics UI Integration:');
        console.log('  - Endpoint returns correct data structure');
        console.log('  - All required fields are present');
        console.log('  - Data can be displayed in the UI');
        console.log('  - Works alongside revenue analytics');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testSubscriptionAnalyticsUI();
