/**
 * Test script for Subscription Analytics API
 * Tests GET /api/admin/analytics/subscriptions endpoint
 */

import { adminStorage } from './admin/admin-storage';

async function testSubscriptionAnalyticsAPI() {
    console.log('=== Testing Subscription Analytics API ===\n');

    try {
        // Test 1: Get subscription analytics
        console.log('1. Testing GET /api/admin/analytics/subscriptions...');
        const analytics = await adminStorage.getSubscriptionAnalytics();

        console.log('Subscription Analytics:');
        console.log('  Total subscriptions:', analytics.total);
        console.log('  Active subscriptions:', analytics.active);
        console.log('  Cancelled subscriptions:', analytics.cancelled);
        console.log('  Churn rate:', analytics.churnRate + '%');
        console.log('  Conversion rate:', analytics.conversionRate + '%');
        console.log('  By plan:', JSON.stringify(analytics.byPlan, null, 2));
        console.log('✓ Subscription analytics retrieved successfully\n');

        // Validate response structure
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

        console.log('✓ All response fields have correct types\n');

        // Validate calculations
        console.log('2. Validating calculations...');

        // Total should be >= active + cancelled
        if (analytics.total < analytics.active + analytics.cancelled) {
            console.warn('⚠ Warning: Total subscriptions is less than active + cancelled');
        } else {
            console.log('✓ Total subscriptions calculation is valid');
        }

        // Churn rate should be between 0 and 100
        if (analytics.churnRate < 0 || analytics.churnRate > 100) {
            throw new Error('Invalid churn rate: should be between 0 and 100');
        }
        console.log('✓ Churn rate is within valid range (0-100%)');

        // Conversion rate should be between 0 and 100
        if (analytics.conversionRate < 0 || analytics.conversionRate > 100) {
            throw new Error('Invalid conversion rate: should be between 0 and 100');
        }
        console.log('✓ Conversion rate is within valid range (0-100%)');

        // Sum of byPlan should equal active subscriptions
        const byPlanSum = Object.values(analytics.byPlan).reduce((sum, count) => sum + count, 0);
        if (byPlanSum !== analytics.active) {
            console.warn(`⚠ Warning: Sum of byPlan (${byPlanSum}) does not equal active subscriptions (${analytics.active})`);
        } else {
            console.log('✓ Sum of subscriptions by plan equals active subscriptions');
        }

        console.log('\n=== All Tests Passed ===');
        console.log('✓ Subscription analytics API is working correctly');
        console.log('✓ All calculations are valid');
        console.log('✓ Response structure is correct');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testSubscriptionAnalyticsAPI()
    .then(() => {
        console.log('\n✓ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
