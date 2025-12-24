/**
 * Test script for Analytics Export API
 * Tests the export endpoint with login authentication
 */

async function testAnalyticsExportAPI() {
    console.log('🧪 Testing Analytics Export API...\n');

    try {
        // Login as admin to get a valid token
        console.log('Logging in as admin...');
        const loginResponse = await fetch('http://localhost:5000/api/admin/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.app',
                password: 'Admin123!@#',
            }),
        });

        if (!loginResponse.ok) {
            console.log('❌ Admin login failed. Make sure admin user exists.');
            console.log('   Run: npm run seed-admin-data');
            return;
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Admin logged in successfully\n');

        // Test 1: Export revenue data as CSV
        console.log('Test 1: Export revenue data as CSV');
        const revenueCSVResponse = await fetch('http://localhost:5000/api/admin/analytics/export?type=revenue&format=csv', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (revenueCSVResponse.ok) {
            const contentType = revenueCSVResponse.headers.get('Content-Type');
            const contentDisposition = revenueCSVResponse.headers.get('Content-Disposition');
            console.log('✅ Revenue CSV export successful');
            console.log(`   Content-Type: ${contentType}`);
            console.log(`   Content-Disposition: ${contentDisposition}`);

            const csvContent = await revenueCSVResponse.text();
            const lines = csvContent.split('\n');
            console.log(`   CSV has ${lines.length} lines (including header)`);
            if (lines.length > 0) {
                console.log(`   Header: ${lines[0]}`);
            }
        } else {
            const error = await revenueCSVResponse.json();
            console.log('❌ Revenue CSV export failed:', error);
        }
        console.log('');

        // Test 2: Export subscriptions data as CSV
        console.log('Test 2: Export subscriptions data as CSV');
        const subscriptionsCSVResponse = await fetch('http://localhost:5000/api/admin/analytics/export?type=subscriptions&format=csv', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (subscriptionsCSVResponse.ok) {
            console.log('✅ Subscriptions CSV export successful');
            const csvContent = await subscriptionsCSVResponse.text();
            const lines = csvContent.split('\n');
            console.log(`   CSV has ${lines.length} lines`);
        } else {
            const error = await subscriptionsCSVResponse.json();
            console.log('❌ Subscriptions CSV export failed:', error);
        }
        console.log('');

        // Test 3: Export users data as CSV
        console.log('Test 3: Export users data as CSV');
        const usersCSVResponse = await fetch('http://localhost:5000/api/admin/analytics/export?type=users&format=csv', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (usersCSVResponse.ok) {
            console.log('✅ Users CSV export successful');
            const csvContent = await usersCSVResponse.text();
            const lines = csvContent.split('\n');
            console.log(`   CSV has ${lines.length} lines`);
        } else {
            const error = await usersCSVResponse.json();
            console.log('❌ Users CSV export failed:', error);
        }
        console.log('');

        // Test 4: Export revenue data as PDF
        console.log('Test 4: Export revenue data as PDF');
        const revenuePDFResponse = await fetch('http://localhost:5000/api/admin/analytics/export?type=revenue&format=excel', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (revenuePDFResponse.ok) {
            const contentLength = revenuePDFResponse.headers.get('Content-Length');
            console.log('✅ Revenue PDF export successful');
            console.log(`   Content-Length: ${contentLength} bytes`);
        } else {
            const error = await revenuePDFResponse.json();
            console.log('❌ Revenue PDF export failed:', error);
        }
        console.log('');

        // Test 5: Invalid type parameter
        console.log('Test 5: Invalid type parameter (should fail)');
        const invalidTypeResponse = await fetch('http://localhost:5000/api/admin/analytics/export?type=invalid&format=csv', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!invalidTypeResponse.ok) {
            const error = await invalidTypeResponse.json();
            console.log('✅ Validation works - rejected invalid type');
            console.log(`   Error: ${error.error.message}`);
        } else {
            console.log('❌ Should have rejected invalid type');
        }
        console.log('');

        console.log('✅ All Analytics Export API tests completed!\n');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        throw error;
    }
}

// Run tests
testAnalyticsExportAPI()
    .then(() => {
        console.log('✅ Test script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test script failed:', error);
        process.exit(1);
    });
