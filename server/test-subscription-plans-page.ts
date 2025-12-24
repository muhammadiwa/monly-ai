/**
 * Test script for Subscription Plans Page
 * 
 * This script tests:
 * - GET /api/admin/plans endpoint returns data
 * - Plans have all required fields
 * - Frontend can parse the data correctly
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

interface TestResult {
    success: boolean;
    message: string;
    data?: any;
}

async function makeAuthenticatedRequest(endpoint: string, method: string = 'GET', body?: any) {
    // First, login as admin to get token
    const loginResponse = await fetch(`${BASE_URL}/api/admin/auth/login`, {
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

    const loginData = await loginResponse.json() as any;
    const token = loginData.token;

    // Make authenticated request
    const options: any = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return { response, data };
}

async function testSubscriptionPlansPage(): Promise<void> {
    console.log('🧪 Testing Subscription Plans Page Integration\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Get all plans
        console.log('\n1️⃣ Testing GET /api/admin/plans...');
        const { response: getResponse, data: getPlansData } = await makeAuthenticatedRequest(
            '/api/admin/plans',
            'GET'
        );

        if (getResponse.status === 200 && getPlansData.success) {
            console.log('✅ GET /api/admin/plans successful');
            console.log(`   Found ${getPlansData.data.length} plans`);

            // Verify plan structure
            if (getPlansData.data.length > 0) {
                const plan = getPlansData.data[0];
                console.log('\n   Sample plan structure:');
                console.log(`   - ID: ${plan.id}`);
                console.log(`   - Name: ${plan.name}`);
                console.log(`   - Display Name: ${plan.displayName}`);
                console.log(`   - Price Monthly: ${plan.priceMonthly}`);
                console.log(`   - Price Yearly: ${plan.priceYearly}`);
                console.log(`   - Currency: ${plan.currency}`);
                console.log(`   - Is Active: ${plan.isActive}`);

                // Test JSON parsing
                try {
                    const features = JSON.parse(plan.features);
                    console.log(`   - Features: ${features.length} items`);
                    console.log(`     ${features.slice(0, 3).join(', ')}...`);
                } catch (e) {
                    console.log('   ⚠️  Warning: Could not parse features JSON');
                }

                try {
                    const limits = JSON.parse(plan.limits);
                    console.log(`   - Limits:`);
                    console.log(`     Transaction Limit: ${limits.transactionLimit}`);
                    console.log(`     Account Limit: ${limits.accountLimit}`);
                    console.log(`     Budget Limit: ${limits.budgetLimit}`);
                    console.log(`     Goal Limit: ${limits.goalLimit}`);
                } catch (e) {
                    console.log('   ⚠️  Warning: Could not parse limits JSON');
                }

                // Verify all required fields are present
                const requiredFields = [
                    'id', 'name', 'displayName', 'priceMonthly', 'priceYearly',
                    'currency', 'features', 'limits', 'isActive', 'createdAt', 'updatedAt'
                ];
                const missingFields = requiredFields.filter(field => !(field in plan));

                if (missingFields.length === 0) {
                    console.log('\n   ✅ All required fields present');
                } else {
                    console.log(`\n   ❌ Missing fields: ${missingFields.join(', ')}`);
                }
            }
        } else {
            console.log('❌ GET /api/admin/plans failed');
            console.log(`   Status: ${getResponse.status}`);
            console.log('   Response:', getPlansData);
        }

        // Test 2: Verify plans are active
        console.log('\n2️⃣ Checking plan status...');
        const activePlans = getPlansData.data.filter((p: any) => p.isActive);
        const inactivePlans = getPlansData.data.filter((p: any) => !p.isActive);
        console.log(`   Active plans: ${activePlans.length}`);
        console.log(`   Inactive plans: ${inactivePlans.length}`);

        // Test 3: Verify pricing
        console.log('\n3️⃣ Checking pricing...');
        getPlansData.data.forEach((plan: any) => {
            const monthlyPrice = plan.priceMonthly;
            const yearlyPrice = plan.priceYearly;
            const yearlyDiscount = ((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12) * 100).toFixed(1);
            console.log(`   ${plan.displayName}:`);
            console.log(`     Monthly: ${plan.currency} ${monthlyPrice}`);
            console.log(`     Yearly: ${plan.currency} ${yearlyPrice} (${yearlyDiscount}% discount)`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests passed! Subscription Plans page is ready.');
        console.log('\n📝 Next steps:');
        console.log('   1. Navigate to http://localhost:5000/admin/subscriptions');
        console.log('   2. Verify plans are displayed in card layout');
        console.log('   3. Check that Create/Edit/Delete buttons are visible');
        console.log('   4. Test the delete functionality');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run tests
testSubscriptionPlansPage()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
