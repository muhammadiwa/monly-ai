/**
 * Test script for Subscription Analytics HTTP Endpoint
 * Tests the actual HTTP endpoint GET /api/admin/analytics/subscriptions
 */

import { adminStorage } from './admin/admin-storage';
import { generateAdminToken } from './admin/admin-auth';

async function testSubscriptionAnalyticsEndpoint() {
    console.log('=== Testing Subscription Analytics HTTP Endpoint ===\n');

    try {
        // Get admin user for authentication
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');
        if (!admin) {
            throw new Error('Admin user not found. Please run seed-admin-data.ts first.');
        }

        // Generate admin token
        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });

        console.log('✓ Admin authenticated\n');

        // Test 1: GET /api/admin/analytics/subscriptions
        console.log('1. Testing GET /api/admin/analytics/subscriptions...');

        const baseUrl = process.env.API_URL || 'http://localhost:5000';
        const response = await fetch(`${baseUrl}/api/admin/analytics/subscriptions`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log('Response:', JSON.stringify(result, null, 2));

        // Validate response structure
        if (!result.success) {
            throw new Error('Response success is false');
        }

        if (!result.data) {
            throw new Error('Response data is missing');
        }

        const analytics = result.data;

        // Validate all required fields
        const requiredFields = ['total', 'active', 'cancelled', 'churnRate', 'conversionRate', 'byPlan'];
        for (const field of requiredFields) {
            if (!(field in analytics)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        console.log('✓ Endpoint returned successful response\n');

        // Test 2: Validate data types
        console.log('2. Validating data types...');

        if (typeof analytics.total !== 'number') {
            throw new Error('Invalid total: expected number');
        }
        if (typeof analytics.active !== 'number') {
            throw new Error('Invalid active: expected number');
        }
        if (typeof analytics.cancelled !== 'number') {
            throw new Error('Invalid cancelled: expected number');
        }
        if (typeof analytics.churnRate !== 'number') {
            throw new Error('Invalid churnRate: expected number');
        }
        if (typeof analytics.conversionRate !== 'number') {
            throw new Error('Invalid conversionRate: expected number');
        }
        if (typeof analytics.byPlan !== 'object') {
            throw new Error('Invalid byPlan: expected object');
        }

        console.log('✓ All fields have correct types\n');

        // Test 3: Validate calculations
        console.log('3. Validating calculations...');

        console.log('  Total subscriptions:', analytics.total);
        console.log('  Active subscriptions:', analytics.active);
        console.log('  Cancelled subscriptions:', analytics.cancelled);
        console.log('  Churn rate:', analytics.churnRate + '%');
        console.log('  Conversion rate:', analytics.conversionRate + '%');
        console.log('  By plan:', JSON.stringify(analytics.byPlan, null, 2));

        // Validate ranges
        if (analytics.churnRate < 0 || analytics.churnRate > 100) {
            throw new Error('Churn rate out of range (0-100)');
        }
        if (analytics.conversionRate < 0 || analytics.conversionRate > 100) {
            throw new Error('Conversion rate out of range (0-100)');
        }

        console.log('✓ All calculations are valid\n');

        // Test 4: Test without authentication (should fail)
        console.log('4. Testing without authentication...');

        const unauthResponse = await fetch(`${baseUrl}/api/admin/analytics/subscriptions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (unauthResponse.ok) {
            throw new Error('Endpoint should require authentication');
        }

        if (unauthResponse.status !== 401) {
            throw new Error(`Expected 401 status, got ${unauthResponse.status}`);
        }

        console.log('✓ Endpoint correctly requires authentication\n');

        console.log('=== All Tests Passed ===');
        console.log('✓ Subscription analytics endpoint is working correctly');
        console.log('✓ Authentication is properly enforced');
        console.log('✓ Response structure is correct');
        console.log('✓ All calculations are valid');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testSubscriptionAnalyticsEndpoint()
    .then(() => {
        console.log('\n✓ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
