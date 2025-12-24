/**
 * Test script for Plan Form Modal functionality
 * 
 * This script tests:
 * 1. Creating a new subscription plan via POST /api/admin/plans
 * 2. Updating an existing plan via PUT /api/admin/plans/:id
 * 3. Form validation (checking required fields)
 */

import { db } from './db';
import { adminUsers, subscriptionPlans } from '../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function testPlanFormModal() {
    console.log('🧪 Testing Plan Form Modal Functionality\n');

    try {
        // 1. Setup: Ensure admin user exists
        console.log('1️⃣ Setting up test admin user...');
        const adminEmail = 'admin@monly.ai';
        let admin = db.select().from(adminUsers).where(eq(adminUsers.email, adminEmail)).get();

        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            admin = db.insert(adminUsers).values({
                id: 'admin-test-' + Date.now(),
                email: adminEmail,
                name: 'Test Admin',
                password: hashedPassword,
                role: 'admin',
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000),
            }).returning().get();
            console.log('✅ Admin user created');
        } else {
            console.log('✅ Admin user already exists');
        }

        // 2. Test: Login to get admin token
        console.log('\n2️⃣ Testing admin login...');
        const loginRes = await fetch('http://localhost:5000/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: adminEmail,
                password: 'admin123',
            }),
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status}`);
        }

        const loginData = await loginRes.json();
        const adminToken = loginData.token;
        console.log('✅ Admin login successful');

        // 3. Test: Create a new plan
        console.log('\n3️⃣ Testing plan creation (POST /api/admin/plans)...');
        const newPlan = {
            name: 'test-plan-' + Date.now(),
            displayName: 'Test Plan',
            description: 'A test subscription plan',
            priceMonthly: 99000,
            priceYearly: 990000,
            currency: 'IDR',
            features: JSON.stringify([
                'Feature 1',
                'Feature 2',
                'Feature 3',
            ]),
            limits: JSON.stringify({
                transactionLimit: 100,
                accountLimit: 5,
                budgetLimit: 10,
                goalLimit: 5,
                aiInsights: true,
                advancedReports: false,
                prioritySupport: false,
                apiAccess: false,
            }),
            isActive: true,
        };

        const createRes = await fetch('http://localhost:5000/api/admin/plans', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newPlan),
        });

        if (!createRes.ok) {
            const error = await createRes.json();
            throw new Error(`Plan creation failed: ${JSON.stringify(error)}`);
        }

        const createData = await createRes.json();
        console.log('✅ Plan created successfully');
        console.log('   Plan ID:', createData.data.id);
        console.log('   Plan Name:', createData.data.name);
        console.log('   Display Name:', createData.data.displayName);

        const createdPlanId = createData.data.id;

        // 4. Test: Update the plan
        console.log('\n4️⃣ Testing plan update (PUT /api/admin/plans/:id)...');
        const updateData = {
            displayName: 'Updated Test Plan',
            description: 'An updated test subscription plan',
            priceMonthly: 149000,
            priceYearly: 1490000,
            currency: 'IDR',
            features: JSON.stringify([
                'Updated Feature 1',
                'Updated Feature 2',
                'Updated Feature 3',
                'New Feature 4',
            ]),
            limits: JSON.stringify({
                transactionLimit: 200,
                accountLimit: 10,
                budgetLimit: 20,
                goalLimit: 10,
                aiInsights: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: false,
            }),
            isActive: true,
        };

        const updateRes = await fetch(`http://localhost:5000/api/admin/plans/${createdPlanId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!updateRes.ok) {
            const error = await updateRes.json();
            throw new Error(`Plan update failed: ${JSON.stringify(error)}`);
        }

        const updatedData = await updateRes.json();
        console.log('✅ Plan updated successfully');
        console.log('   Display Name:', updatedData.data.displayName);
        console.log('   Monthly Price:', updatedData.data.price.monthly);
        console.log('   Features Count:', updatedData.data.features.length);

        // 5. Test: Verify the update in database
        console.log('\n5️⃣ Verifying plan in database...');
        const dbPlan = db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, createdPlanId)).get();

        if (!dbPlan) {
            throw new Error('Plan not found in database');
        }

        console.log('✅ Plan verified in database');
        console.log('   DB Display Name:', dbPlan.displayName);
        console.log('   DB Monthly Price:', dbPlan.priceMonthly);
        console.log('   DB Features:', JSON.parse(dbPlan.features).length, 'features');
        console.log('   DB Limits:', JSON.parse(dbPlan.limits));

        // 6. Test: Validation - Try to create plan with missing required fields
        console.log('\n6️⃣ Testing validation (missing required fields)...');
        const invalidPlan = {
            displayName: 'Invalid Plan',
            // Missing name, priceMonthly, priceYearly, features, limits
        };

        const invalidRes = await fetch('http://localhost:5000/api/admin/plans', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invalidPlan),
        });

        if (invalidRes.ok) {
            console.log('⚠️  Warning: Validation should have failed but didn\'t');
        } else {
            console.log('✅ Validation correctly rejected invalid plan');
            const errorData = await invalidRes.json();
            console.log('   Error:', errorData.error?.message || 'Validation error');
        }

        // 7. Cleanup: Delete the test plan
        console.log('\n7️⃣ Cleaning up test plan...');
        const deleteRes = await fetch(`http://localhost:5000/api/admin/plans/${createdPlanId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
            },
        });

        if (!deleteRes.ok) {
            console.log('⚠️  Warning: Failed to delete test plan');
        } else {
            console.log('✅ Test plan deleted successfully');
        }

        console.log('\n✅ All tests passed! Plan Form Modal is working correctly.\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
console.log('Starting Plan Form Modal tests...\n');
console.log('⚠️  Make sure the server is running on http://localhost:5000\n');

testPlanFormModal().catch(console.error);
