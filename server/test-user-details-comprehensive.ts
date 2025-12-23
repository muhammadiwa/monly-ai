/**
 * Comprehensive test for User Details API
 * Tests all aspects of the implementation
 */

import 'dotenv/config';
import { adminStorage } from './admin/admin-storage';
import { generateAdminToken } from './admin/admin-auth';

async function runComprehensiveTest() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     COMPREHENSIVE USER DETAILS API TEST SUITE             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const results = {
        passed: 0,
        failed: 0,
        tests: [] as Array<{ name: string; passed: boolean; message?: string }>
    };

    function recordTest(name: string, passed: boolean, message?: string) {
        results.tests.push({ name, passed, message });
        if (passed) {
            results.passed++;
            console.log(`✅ ${name}`);
        } else {
            results.failed++;
            console.log(`❌ ${name}`);
            if (message) console.log(`   ${message}`);
        }
    }

    try {
        // Setup
        console.log('📋 SETUP\n');
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');
        if (!admin) {
            console.log('❌ Cannot run tests: Admin user not found');
            return;
        }
        console.log(`✅ Admin authenticated: ${admin.email}\n`);

        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });

        const userList = await adminStorage.getUserList({ page: 1, limit: 5 });
        if (userList.users.length === 0) {
            console.log('❌ Cannot run tests: No users in database');
            return;
        }
        const testUser = userList.users[0];
        console.log(`✅ Test user selected: ${testUser.email}\n`);

        // Test 1: Storage Method - Valid User
        console.log('📦 STORAGE METHOD TESTS\n');
        const userDetails = await adminStorage.getUserDetails(testUser.id);
        recordTest(
            'Storage method returns user details for valid ID',
            userDetails !== null && userDetails.id === testUser.id
        );

        // Test 2: Storage Method - Invalid User
        const invalidUser = await adminStorage.getUserDetails('invalid-id-12345');
        recordTest(
            'Storage method returns null for invalid ID',
            invalidUser === null
        );

        // Test 3: Storage Method - Required Fields
        if (userDetails) {
            const hasRequiredFields =
                'id' in userDetails &&
                'email' in userDetails &&
                'profile' in userDetails &&
                'usage' in userDetails &&
                'activity' in userDetails;
            recordTest(
                'Storage method returns all required fields',
                hasRequiredFields
            );

            // Test 4: Usage Statistics are Numbers
            const usageStatsValid =
                typeof userDetails.usage.transactionCount === 'number' &&
                typeof userDetails.usage.budgetCount === 'number' &&
                typeof userDetails.usage.goalCount === 'number' &&
                userDetails.usage.transactionCount >= 0 &&
                userDetails.usage.budgetCount >= 0 &&
                userDetails.usage.goalCount >= 0;
            recordTest(
                'Usage statistics are valid non-negative numbers',
                usageStatsValid
            );

            // Test 5: Profile Structure
            const profileValid =
                typeof userDetails.profile.firstName === 'string' &&
                typeof userDetails.profile.lastName === 'string';
            recordTest(
                'Profile has correct structure',
                profileValid
            );

            // Test 6: Activity Structure
            const activityValid =
                Array.isArray(userDetails.activity.loginHistory) &&
                typeof userDetails.activity.lastActive === 'number';
            recordTest(
                'Activity has correct structure',
                activityValid
            );
        }

        // HTTP Endpoint Tests
        console.log('\n🌐 HTTP ENDPOINT TESTS\n');
        const baseUrl = process.env.API_URL || 'http://localhost:5000';

        // Test 7: Valid Request
        const validResponse = await fetch(`${baseUrl}/api/admin/users/${testUser.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        recordTest(
            'HTTP endpoint returns 200 for valid request',
            validResponse.status === 200
        );

        // Test 8: Response Structure
        if (validResponse.ok) {
            const data = await validResponse.json();
            const hasCorrectStructure =
                data.success === true &&
                'data' in data &&
                data.data.id === testUser.id;
            recordTest(
                'HTTP response has correct structure',
                hasCorrectStructure
            );
        }

        // Test 9: Invalid User ID
        const invalidResponse = await fetch(`${baseUrl}/api/admin/users/invalid-id`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        recordTest(
            'HTTP endpoint returns 404 for invalid user ID',
            invalidResponse.status === 404
        );

        // Test 10: No Authentication
        const noAuthResponse = await fetch(`${baseUrl}/api/admin/users/${testUser.id}`);
        recordTest(
            'HTTP endpoint returns 401 without authentication',
            noAuthResponse.status === 401
        );

        // Test 11: Invalid Token
        const invalidTokenResponse = await fetch(`${baseUrl}/api/admin/users/${testUser.id}`, {
            headers: { 'Authorization': 'Bearer invalid-token-12345' }
        });
        recordTest(
            'HTTP endpoint returns 403 for invalid token',
            invalidTokenResponse.status === 403
        );

        // Test 12: Multiple Users
        console.log('\n👥 MULTIPLE USERS TEST\n');
        let allUsersValid = true;
        for (const user of userList.users) {
            const details = await adminStorage.getUserDetails(user.id);
            if (!details || details.id !== user.id) {
                allUsersValid = false;
                break;
            }
        }
        recordTest(
            `All ${userList.users.length} users can be fetched successfully`,
            allUsersValid
        );

        // Test 13: Data Consistency
        console.log('\n🔍 DATA CONSISTENCY TESTS\n');
        if (userDetails) {
            // Email format
            recordTest(
                'Email has valid format',
                userDetails.email.includes('@')
            );

            // Name is not empty
            recordTest(
                'User name is not empty',
                userDetails.name.trim().length > 0
            );

            // Subscription plan exists
            recordTest(
                'Subscription plan is defined',
                typeof userDetails.subscriptionPlan === 'string' && userDetails.subscriptionPlan.length > 0
            );

            // Status is valid
            const validStatuses = ['free', 'active', 'suspended', 'deleted'];
            recordTest(
                'User status is valid',
                validStatuses.includes(userDetails.status)
            );
        }

        // Test 14: Performance
        console.log('\n⚡ PERFORMANCE TEST\n');
        const startTime = Date.now();
        await adminStorage.getUserDetails(testUser.id);
        const endTime = Date.now();
        const duration = endTime - startTime;
        recordTest(
            `Query completes in reasonable time (${duration}ms < 100ms)`,
            duration < 100,
            `Actual: ${duration}ms`
        );

        // Test 15: Concurrent Requests
        console.log('\n🔄 CONCURRENT REQUESTS TEST\n');
        const concurrentPromises = userList.users.slice(0, 3).map(user =>
            fetch(`${baseUrl}/api/admin/users/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        );
        const concurrentResults = await Promise.all(concurrentPromises);
        const allConcurrentSuccess = concurrentResults.every(r => r.status === 200);
        recordTest(
            'Handles concurrent requests successfully',
            allConcurrentSuccess
        );

    } catch (error) {
        console.error('\n❌ Test suite failed with error:', error);
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`);

    if (results.failed > 0) {
        console.log('Failed Tests:');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`  ❌ ${t.name}`);
            if (t.message) console.log(`     ${t.message}`);
        });
        console.log('');
    }

    if (results.failed === 0) {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║          🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉             ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
    } else {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║              ⚠️  SOME TESTS FAILED  ⚠️                    ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
    }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
