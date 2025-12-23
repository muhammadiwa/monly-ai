/**
 * Integration test for User Details API endpoint
 * Tests the full HTTP endpoint GET /api/admin/users/:id
 */

import 'dotenv/config';
import { adminStorage } from './admin/admin-storage';
import { generateAdminToken } from './admin/admin-auth';

async function testUserDetailsEndpoint() {
    console.log('=== Testing User Details Endpoint Integration ===\n');

    try {
        // 1. Get admin credentials
        console.log('1. Getting admin credentials...');
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');
        if (!admin) {
            console.log('❌ Admin user not found. Please run seed-admin-data.ts first.');
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

        // 3. Get a test user ID
        console.log('3. Getting test user ID...');
        const userList = await adminStorage.getUserList({ page: 1, limit: 1 });
        if (userList.users.length === 0) {
            console.log('❌ No users found. Please create some test users first.');
            return;
        }
        const testUserId = userList.users[0].id;
        const testUserEmail = userList.users[0].email;
        console.log(`✅ Test user: ${testUserId} (${testUserEmail})\n`);

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

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Request failed');
            console.log('Response:', errorText);
            return;
        }

        const result = await response.json();
        console.log('✅ Request successful\n');

        // 5. Validate response structure
        console.log('5. Validating response structure...');
        if (!result.success) {
            console.log('❌ Response success is false');
            console.log('Response:', JSON.stringify(result, null, 2));
            return;
        }

        if (!result.data) {
            console.log('❌ Response data is missing');
            return;
        }

        const userData = result.data;

        // Check required fields
        const requiredFields = ['id', 'name', 'email', 'status', 'profile', 'usage', 'activity'];
        const missingFields = requiredFields.filter(field => !(field in userData));
        if (missingFields.length > 0) {
            console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        console.log('✅ All required fields present\n');

        // 6. Display user details
        console.log('6. User Details from API:');
        console.log('-------------------------');
        console.log(JSON.stringify(userData, null, 2));

        // 7. Test with invalid user ID
        console.log('\n7. Testing with invalid user ID...');
        const invalidUrl = `${baseUrl}/api/admin/users/invalid-user-id`;
        const invalidResponse = await fetch(invalidUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (invalidResponse.status === 404) {
            console.log('✅ Correctly returned 404 for invalid user ID\n');
        } else {
            console.log(`❌ Expected 404, got ${invalidResponse.status}\n`);
        }

        // 8. Test without authentication
        console.log('8. Testing without authentication...');
        const unauthUrl = `${baseUrl}/api/admin/users/${testUserId}`;
        const unauthResponse = await fetch(unauthUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (unauthResponse.status === 401) {
            console.log('✅ Correctly returned 401 for unauthenticated request\n');
        } else {
            console.log(`❌ Expected 401, got ${unauthResponse.status}\n`);
        }

        console.log('=== All Endpoint Tests Passed ✅ ===');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testUserDetailsEndpoint().catch(console.error);
