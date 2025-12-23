/**
 * Test script for Subscription Plans CRUD API
 * 
 * This script tests all subscription plan endpoints:
 * - GET /api/admin/plans - Get all plans
 * - POST /api/admin/plans - Create new plan
 * - PUT /api/admin/plans/:id - Update plan
 * - DELETE /api/admin/plans/:id - Delete plan
 */

import { db } from './db';
import { adminUsers, subscriptionPlans, userSubscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const API_BASE_URL = 'http://localhost:5000';

// Helper function to make authenticated requests
async function makeAuthenticatedRequest(
    endpoint: string,
    token: string,
    method: string = 'GET',
    body?: any
) {
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    return { response, data };
}

// Helper function to login as admin
async function loginAsAdmin(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
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

    if (!data.success) {
        throw new Error('Failed to login as admin');
    }

    return data.token;
}

async function testSubscriptionPlansAPI() {
    console.log('🧪 Testing Subscription Plans CRUD API\n');

    try {
        // Step 1: Login as admin
        console.log('1️⃣ Logging in as admin...');
        const token = await loginAsAdmin();
        console.log('✅ Admin login successful\n');

        // Step 2: Get all plans (should have seeded plans)
        console.log('2️⃣ Testing GET /api/admin/plans...');
        const { response: getResponse, data: getPlansData } = await makeAuthenticatedRequest(
            '/api/admin/plans',
            token
        );

        if (getResponse.status === 200 && getPlansData.success) {
            console.log('✅ GET /api/admin/plans successful');
            console.log(`   Found ${getPlansData.data.length} plans:`);
            getPlansData.data.forEach((plan: any) => {
                console.log(`   - ${plan.displayName} (${plan.name}): $${plan.price.monthly}/mo`);
            });
        } else {
            console.log('❌ GET /api/admin/plans failed');
            console.log('   Response:', getPlansData);
        }
        console.log('');

        // Step 3: Create a new plan
        console.log('3️⃣ Testing POST /api/admin/plans...');
        const timestamp = Date.now();
        const newPlanData = {
            name: `enterprise_${timestamp}`,
            displayName: 'Enterprise',
            description: 'For large organizations with advanced needs',
            priceMonthly: 99000,
            priceYearly: 990000,
            currency: 'IDR',
            features: [
                'Unlimited transactions',
                'Unlimited accounts',
                'Unlimited budgets',
                'Unlimited goals',
                'Advanced AI insights',
                'Custom reports',
                'Priority support',
                'API access',
                'Dedicated account manager',
            ],
            limits: {
                transactionLimit: -1,
                accountLimit: -1,
                budgetLimit: -1,
                goalLimit: -1,
                aiInsights: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: true,
            },
            isActive: true,
        };

        const { response: createResponse, data: createData } = await makeAuthenticatedRequest(
            '/api/admin/plans',
            token,
            'POST',
            newPlanData
        );

        let createdPlanId: number | null = null;

        if (createResponse.status === 201 && createData.success) {
            console.log('✅ POST /api/admin/plans successful');
            console.log(`   Created plan: ${createData.data.displayName} (ID: ${createData.data.id})`);
            createdPlanId = createData.data.id;
        } else {
            console.log('❌ POST /api/admin/plans failed');
            console.log('   Response:', createData);
        }
        console.log('');

        // Step 4: Update the created plan
        if (createdPlanId) {
            console.log('4️⃣ Testing PUT /api/admin/plans/:id...');
            const updatePayload = {
                priceMonthly: 89000,
                priceYearly: 890000,
                description: 'For large organizations - Special pricing!',
            };

            const { response: updateResponse, data: updateData } = await makeAuthenticatedRequest(
                `/api/admin/plans/${createdPlanId}`,
                token,
                'PUT',
                updatePayload
            );

            if (updateResponse.status === 200 && updateData.success) {
                console.log('✅ PUT /api/admin/plans/:id successful');
                console.log(`   Updated plan: ${updateData.data.displayName}`);
                console.log(`   New monthly price: $${updateData.data.price.monthly}`);
                console.log(`   New description: ${updateData.data.description}`);
            } else {
                console.log('❌ PUT /api/admin/plans/:id failed');
                console.log('   Response:', updateData);
            }
            console.log('');
        }

        // Step 5: Try to delete a plan with active subscriptions (should fail)
        console.log('5️⃣ Testing DELETE /api/admin/plans/:id with active subscriptions...');

        // Find a plan that has active subscriptions (likely the free plan)
        const plansWithSubscriptions = await db
            .select({
                planId: userSubscriptions.planId,
            })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.status, 'active'))
            .limit(1);

        if (plansWithSubscriptions.length > 0) {
            const planIdWithSubs = plansWithSubscriptions[0].planId;
            const { response: deleteFailResponse, data: deleteFailData } = await makeAuthenticatedRequest(
                `/api/admin/plans/${planIdWithSubs}`,
                token,
                'DELETE'
            );

            if (deleteFailResponse.status === 409) {
                console.log('✅ DELETE correctly prevented for plan with active subscriptions');
                console.log(`   Error message: ${deleteFailData.error.message}`);
            } else {
                console.log('❌ DELETE should have failed for plan with active subscriptions');
                console.log('   Response:', deleteFailData);
            }
        } else {
            console.log('⚠️  No plans with active subscriptions found to test');
        }
        console.log('');

        // Step 6: Delete the created plan (should succeed)
        if (createdPlanId) {
            console.log('6️⃣ Testing DELETE /api/admin/plans/:id...');
            const { response: deleteResponse, data: deleteData } = await makeAuthenticatedRequest(
                `/api/admin/plans/${createdPlanId}`,
                token,
                'DELETE'
            );

            if (deleteResponse.status === 200 && deleteData.success) {
                console.log('✅ DELETE /api/admin/plans/:id successful');
                console.log(`   Deleted plan ID: ${createdPlanId}`);
            } else {
                console.log('❌ DELETE /api/admin/plans/:id failed');
                console.log('   Response:', deleteData);
            }
            console.log('');
        }

        // Step 7: Verify the plan was deleted (soft delete - isActive = false)
        if (createdPlanId) {
            console.log('7️⃣ Verifying plan was soft deleted...');
            const { response: verifyResponse, data: verifyData } = await makeAuthenticatedRequest(
                '/api/admin/plans',
                token
            );

            if (verifyResponse.status === 200 && verifyData.success) {
                const deletedPlan = verifyData.data.find((p: any) => p.id === createdPlanId);
                if (deletedPlan && !deletedPlan.isActive) {
                    console.log('✅ Plan was soft deleted (isActive = false)');
                } else if (!deletedPlan) {
                    console.log('⚠️  Plan not found in list (may be filtered out)');
                } else {
                    console.log('❌ Plan is still active after deletion');
                }
            }
            console.log('');
        }

        // Step 8: Test validation errors
        console.log('8️⃣ Testing validation errors...');
        const invalidPlanData = {
            name: '', // Invalid: empty name
            displayName: 'Test',
            priceMonthly: -100, // Invalid: negative price
            priceYearly: 1000,
            currency: 'IDR',
            features: [], // Invalid: empty features array
            limits: {
                transactionLimit: 100,
                accountLimit: 5,
                budgetLimit: 10,
                goalLimit: 5,
                aiInsights: false,
                advancedReports: false,
                prioritySupport: false,
                apiAccess: false,
            },
        };

        const { response: validationResponse, data: validationData } = await makeAuthenticatedRequest(
            '/api/admin/plans',
            token,
            'POST',
            invalidPlanData
        );

        if (validationResponse.status === 400 && validationData.error.code === 'VALIDATION_ERROR') {
            console.log('✅ Validation errors correctly caught');
            console.log(`   Errors: ${validationData.error.details.length} validation issues`);
        } else {
            console.log('❌ Validation should have failed');
            console.log('   Response:', validationData);
        }
        console.log('');

        console.log('✅ All Subscription Plans CRUD API tests completed!\n');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        throw error;
    }
}

// Run the test
testSubscriptionPlansAPI()
    .then(() => {
        console.log('✅ Test script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test script failed:', error);
        process.exit(1);
    });
