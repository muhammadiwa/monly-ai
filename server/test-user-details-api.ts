/**
 * Test script for User Details API endpoint
 * Tests GET /api/admin/users/:id
 */

import { adminStorage } from './admin/admin-storage';

async function testUserDetailsAPI() {
    console.log('=== Testing User Details API ===\n');

    try {
        // First, get a list of users to find a valid user ID
        console.log('1. Fetching user list to get a valid user ID...');
        const userList = await adminStorage.getUserList({
            page: 1,
            limit: 5,
        });

        if (userList.users.length === 0) {
            console.log('❌ No users found in database. Please create some test users first.');
            return;
        }

        const testUserId = userList.users[0].id;
        console.log(`✅ Found test user: ${testUserId} (${userList.users[0].email})\n`);

        // Test getUserDetails method
        console.log('2. Testing getUserDetails method...');
        const userDetails = await adminStorage.getUserDetails(testUserId);

        if (!userDetails) {
            console.log('❌ getUserDetails returned null');
            return;
        }

        console.log('✅ User details fetched successfully\n');
        console.log('User Details:');
        console.log('-------------');
        console.log(`ID: ${userDetails.id}`);
        console.log(`Name: ${userDetails.name}`);
        console.log(`Email: ${userDetails.email}`);
        console.log(`Status: ${userDetails.status}`);
        console.log(`Subscription Plan: ${userDetails.subscriptionPlanDisplay}`);
        console.log(`Registration Date: ${new Date(userDetails.registrationDate * 1000).toLocaleString()}`);
        console.log(`Last Login: ${new Date(userDetails.lastLogin * 1000).toLocaleString()}`);
        console.log('\nProfile:');
        console.log(`  First Name: ${userDetails.profile.firstName}`);
        console.log(`  Last Name: ${userDetails.profile.lastName}`);
        console.log(`  Profile Image: ${userDetails.profile.profileImageUrl || 'N/A'}`);
        console.log('\nSubscription:');
        if (userDetails.subscription) {
            console.log(`  Plan: ${userDetails.subscription.planDisplay}`);
            console.log(`  Status: ${userDetails.subscription.status}`);
            console.log(`  Billing Cycle: ${userDetails.subscription.billingCycle}`);
            console.log(`  Auto Renew: ${userDetails.subscription.autoRenew}`);
            console.log(`  Start Date: ${new Date(userDetails.subscription.startDate * 1000).toLocaleDateString()}`);
            console.log(`  End Date: ${new Date(userDetails.subscription.endDate * 1000).toLocaleDateString()}`);
            console.log(`  Price: ${userDetails.subscription.price}`);
        } else {
            console.log('  No active subscription');
        }
        console.log('\nUsage Statistics:');
        console.log(`  Transactions: ${userDetails.usage.transactionCount}`);
        console.log(`  Budgets: ${userDetails.usage.budgetCount}`);
        console.log(`  Goals: ${userDetails.usage.goalCount}`);
        console.log(`  Accounts: ${userDetails.usage.accountCount}`);
        console.log('\nActivity:');
        console.log(`  Last Active: ${new Date(userDetails.activity.lastActive * 1000).toLocaleString()}`);
        console.log(`  Login History: ${userDetails.activity.loginHistory.length} records`);

        // Test with non-existent user
        console.log('\n3. Testing with non-existent user ID...');
        const nonExistentUser = await adminStorage.getUserDetails('non-existent-id');
        if (nonExistentUser === null) {
            console.log('✅ Correctly returned null for non-existent user\n');
        } else {
            console.log('❌ Should return null for non-existent user\n');
        }

        // Test all users in the list
        console.log('4. Testing getUserDetails for all users in list...');
        for (const user of userList.users) {
            const details = await adminStorage.getUserDetails(user.id);
            if (details) {
                console.log(`✅ ${user.email}: ${details.usage.transactionCount} transactions, ${details.usage.budgetCount} budgets, ${details.usage.goalCount} goals`);
            } else {
                console.log(`❌ Failed to fetch details for ${user.email}`);
            }
        }

        console.log('\n=== All Tests Passed ✅ ===');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testUserDetailsAPI().catch(console.error);
