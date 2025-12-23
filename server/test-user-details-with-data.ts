/**
 * Test User Details API with a user that has transactions, budgets, and goals
 */

import 'dotenv/config';
import { adminStorage } from './admin/admin-storage';
import { generateAdminToken } from './admin/admin-auth';

async function testUserDetailsWithData() {
    console.log('=== Testing User Details API with User Data ===\n');

    try {
        // 1. Get admin credentials
        console.log('1. Getting admin credentials...');
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');
        if (!admin) {
            console.log('❌ Admin user not found.');
            return;
        }
        console.log(`✅ Admin found: ${admin.email}\n`);

        // 2. Generate admin token
        console.log('2. Generating admin token...');
        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });
        console.log(`✅ Token generated\n`);

        // 3. Find a user with transactions
        console.log('3. Finding user with transactions...');
        const userList = await adminStorage.getUserList({ page: 1, limit: 10 });
        const userWithData = userList.users.find(u => u.transactionCount > 0);

        if (!userWithData) {
            console.log('❌ No users with transactions found. Testing with first user...');
            if (userList.users.length === 0) {
                console.log('❌ No users found at all.');
                return;
            }
            const testUserId = userList.users[0].id;
            console.log(`Using user: ${testUserId} (${userList.users[0].email})\n`);
        } else {
            console.log(`✅ Found user with ${userWithData.transactionCount} transactions: ${userWithData.email}\n`);
        }

        const testUserId = userWithData ? userWithData.id : userList.users[0].id;

        // 4. Test the endpoint
        console.log('4. Testing GET /api/admin/users/:id endpoint...');
        const baseUrl = process.env.API_URL || 'http://localhost:5000';
        const url = `${baseUrl}/api/admin/users/${testUserId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ Request failed: ${response.status}`);
            console.log('Response:', errorText);
            return;
        }

        const result = await response.json();
        console.log('✅ Request successful\n');

        const userData = result.data;

        // 5. Display detailed user information
        console.log('=== User Details ===');
        console.log(`ID: ${userData.id}`);
        console.log(`Name: ${userData.name}`);
        console.log(`Email: ${userData.email}`);
        console.log(`Status: ${userData.status}`);
        console.log(`Subscription: ${userData.subscriptionPlanDisplay}`);
        console.log(`Registered: ${new Date(userData.registrationDate * 1000).toLocaleString()}`);
        console.log(`Last Login: ${new Date(userData.lastLogin * 1000).toLocaleString()}`);

        console.log('\n=== Profile ===');
        console.log(`First Name: ${userData.profile.firstName}`);
        console.log(`Last Name: ${userData.profile.lastName}`);
        console.log(`Phone: ${userData.profile.phone || 'N/A'}`);
        console.log(`Profile Image: ${userData.profile.profileImageUrl || 'N/A'}`);

        console.log('\n=== Subscription Details ===');
        if (userData.subscription) {
            console.log(`Plan: ${userData.subscription.planDisplay}`);
            console.log(`Status: ${userData.subscription.status}`);
            console.log(`Billing Cycle: ${userData.subscription.billingCycle}`);
            console.log(`Auto Renew: ${userData.subscription.autoRenew ? 'Yes' : 'No'}`);
            console.log(`Start Date: ${new Date(userData.subscription.startDate * 1000).toLocaleDateString()}`);
            console.log(`End Date: ${new Date(userData.subscription.endDate * 1000).toLocaleDateString()}`);
            console.log(`Price: ${userData.subscription.price}`);
        } else {
            console.log('No active subscription (Free plan)');
        }

        console.log('\n=== Usage Statistics ===');
        console.log(`Transactions: ${userData.usage.transactionCount}`);
        console.log(`Budgets: ${userData.usage.budgetCount}`);
        console.log(`Goals: ${userData.usage.goalCount}`);
        console.log(`Accounts: ${userData.usage.accountCount}`);

        console.log('\n=== Activity ===');
        console.log(`Last Active: ${new Date(userData.activity.lastActive * 1000).toLocaleString()}`);
        console.log(`Login History Records: ${userData.activity.loginHistory.length}`);
        if (userData.activity.loginHistory.length > 0) {
            console.log('\nRecent Logins:');
            userData.activity.loginHistory.slice(0, 5).forEach((login: any, index: number) => {
                console.log(`  ${index + 1}. ${new Date(login.timestamp * 1000).toLocaleString()} - IP: ${login.ipAddress} - Device: ${login.device}`);
            });
        }

        // 6. Verify data consistency
        console.log('\n=== Data Consistency Check ===');
        const checks = [
            { name: 'User ID matches', pass: userData.id === testUserId },
            { name: 'Email is valid', pass: userData.email && userData.email.includes('@') },
            { name: 'Registration date is valid', pass: userData.registrationDate > 0 },
            {
                name: 'Usage stats are non-negative', pass:
                    userData.usage.transactionCount >= 0 &&
                    userData.usage.budgetCount >= 0 &&
                    userData.usage.goalCount >= 0
            },
            {
                name: 'Profile has required fields', pass:
                    'firstName' in userData.profile &&
                    'lastName' in userData.profile
            },
            {
                name: 'Activity has login history', pass:
                    Array.isArray(userData.activity.loginHistory)
            },
        ];

        checks.forEach(check => {
            console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
        });

        const allPassed = checks.every(check => check.pass);
        if (allPassed) {
            console.log('\n=== All Consistency Checks Passed ✅ ===');
        } else {
            console.log('\n=== Some Consistency Checks Failed ❌ ===');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testUserDetailsWithData().catch(console.error);
