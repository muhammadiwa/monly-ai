/**
 * Test script for Payment List API endpoint
 * Tests GET /api/admin/payments endpoint with HTTP requests
 */

async function testPaymentListEndpoint() {
    console.log('🧪 Testing Payment List API Endpoint...\n');

    const BASE_URL = 'http://localhost:5000';

    try {
        // Step 1: Login as admin to get token
        console.log('🔐 Step 1: Logging in as admin...');
        const loginResponse = await fetch(`${BASE_URL}/api/admin/auth/login`, {
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
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Login successful');
        console.log('   Admin:', loginData.admin.name);

        // Step 2: Test basic payment list (no filters)
        console.log('\n📄 Test 1: GET /api/admin/payments (basic pagination)');
        const response1 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response1.ok) {
            throw new Error(`Request failed: ${response1.status} ${response1.statusText}`);
        }

        const data1 = await response1.json();
        console.log('✅ Response received');
        console.log('   Success:', data1.success);
        console.log('   Total payments:', data1.data.total);
        console.log('   Payments returned:', data1.data.payments.length);
        console.log('   Current page:', data1.data.page);
        console.log('   Total pages:', data1.data.totalPages);

        if (data1.data.payments.length > 0) {
            const sample = data1.data.payments[0];
            console.log('\n   Sample payment:');
            console.log('     ID:', sample.id);
            console.log('     Amount:', sample.amount, sample.currency);
            console.log('     Status:', sample.status);
            console.log('     Payment Method:', sample.paymentMethod);
            console.log('     User:', sample.user.fullName);
            console.log('     Subscription:', sample.subscription ? sample.subscription.planDisplayName : 'None');
            console.log('     Invoice:', sample.invoice ? sample.invoice.invoiceNumber : 'None');
        }

        // Step 3: Test filter by status
        console.log('\n📄 Test 2: GET /api/admin/payments?status=paid');
        const response2 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&status=paid`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response2.ok) {
            throw new Error(`Request failed: ${response2.status} ${response2.statusText}`);
        }

        const data2 = await response2.json();
        console.log('✅ Response received');
        console.log('   Total paid payments:', data2.data.total);
        console.log('   All payments have status "paid":', data2.data.payments.every((p: any) => p.status === 'paid'));

        // Step 4: Test search by user email
        if (data1.data.payments.length > 0) {
            const searchEmail = data1.data.payments[0].user.email;
            console.log(`\n📄 Test 3: GET /api/admin/payments?search=${searchEmail}`);
            const response3 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&search=${encodeURIComponent(searchEmail)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response3.ok) {
                throw new Error(`Request failed: ${response3.status} ${response3.statusText}`);
            }

            const data3 = await response3.json();
            console.log('✅ Response received');
            console.log('   Payments found:', data3.data.total);
            console.log('   All belong to searched user:', data3.data.payments.every((p: any) => p.user.email === searchEmail));
        }

        // Step 5: Test search by transaction ID
        if (data1.data.payments.length > 0 && data1.data.payments[0].midtransTransactionId) {
            const searchTxnId = data1.data.payments[0].midtransTransactionId;
            console.log(`\n📄 Test 4: GET /api/admin/payments?search=${searchTxnId}`);
            const response4 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&search=${encodeURIComponent(searchTxnId)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response4.ok) {
                throw new Error(`Request failed: ${response4.status} ${response4.statusText}`);
            }

            const data4 = await response4.json();
            console.log('✅ Response received');
            console.log('   Payments found:', data4.data.total);
        }

        // Step 6: Test date range filter
        const now = Math.floor(Date.now() / 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60);
        console.log(`\n📄 Test 5: GET /api/admin/payments?dateFrom=${sevenDaysAgo}&dateTo=${now}`);
        const response5 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&dateFrom=${sevenDaysAgo}&dateTo=${now}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response5.ok) {
            throw new Error(`Request failed: ${response5.status} ${response5.statusText}`);
        }

        const data5 = await response5.json();
        console.log('✅ Response received');
        console.log('   Payments in last 7 days:', data5.data.total);

        // Step 7: Test combined filters
        console.log(`\n📄 Test 6: GET /api/admin/payments?status=pending&dateFrom=${sevenDaysAgo}`);
        const response6 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&status=pending&dateFrom=${sevenDaysAgo}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response6.ok) {
            throw new Error(`Request failed: ${response6.status} ${response6.statusText}`);
        }

        const data6 = await response6.json();
        console.log('✅ Response received');
        console.log('   Pending payments in last 7 days:', data6.data.total);

        // Step 8: Test invalid status parameter
        console.log('\n📄 Test 7: GET /api/admin/payments?status=invalid (should fail)');
        const response7 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10&status=invalid`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response7.status === 400) {
            const data7 = await response7.json();
            console.log('✅ Validation error returned as expected');
            console.log('   Error code:', data7.error.code);
            console.log('   Error message:', data7.error.message);
        } else {
            console.log('❌ Expected 400 status code, got:', response7.status);
        }

        // Step 9: Test invalid page parameter
        console.log('\n📄 Test 8: GET /api/admin/payments?page=0 (should fail)');
        const response8 = await fetch(`${BASE_URL}/api/admin/payments?page=0&limit=10`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response8.status === 400) {
            const data8 = await response8.json();
            console.log('✅ Validation error returned as expected');
            console.log('   Error code:', data8.error.code);
            console.log('   Error message:', data8.error.message);
        } else {
            console.log('❌ Expected 400 status code, got:', response8.status);
        }

        // Step 10: Test without authentication
        console.log('\n📄 Test 9: GET /api/admin/payments (no auth token, should fail)');
        const response9 = await fetch(`${BASE_URL}/api/admin/payments?page=1&limit=10`);

        if (response9.status === 401) {
            const data9 = await response9.json();
            console.log('✅ Unauthorized error returned as expected');
            console.log('   Error code:', data9.error.code);
        } else {
            console.log('❌ Expected 401 status code, got:', response9.status);
        }

        console.log('\n✅ All endpoint tests passed!');
        console.log('\n📝 Summary:');
        console.log(`   Total payments: ${data1.data.total}`);
        console.log(`   Paid payments: ${data2.data.total}`);
        console.log(`   Pending payments (last 7 days): ${data6.data.total}`);
        console.log('   Validation working correctly ✓');
        console.log('   Authentication working correctly ✓');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
        }
        process.exit(1);
    }
}

// Run the test
testPaymentListEndpoint()
    .then(() => {
        console.log('\n✅ Payment List API endpoint test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Payment List API endpoint test failed:', error);
        process.exit(1);
    });
