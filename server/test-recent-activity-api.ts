async function testRecentActivityAPI() {
    console.log('🧪 Testing Recent Activity API...\n');

    try {
        // Login to get a fresh token
        console.log('🔐 Logging in as admin...');
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
            const errorData = await loginResponse.json();
            console.error('❌ Login failed:', loginResponse.status, errorData);
            return;
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;

        console.log('✅ Admin logged in successfully\n');

        // Test GET /api/admin/dashboard/recent-activity
        console.log('📊 Testing GET /api/admin/dashboard/recent-activity...');
        const response = await fetch('http://localhost:5000/api/admin/dashboard/recent-activity', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Request failed:', response.status, errorData);
            return;
        }

        const data = await response.json();
        console.log('✅ Recent Activity API Response:');
        console.log(JSON.stringify(data, null, 2));

        // Validate response structure
        if (!data.success) {
            console.error('❌ Response indicates failure');
            return;
        }

        if (!data.data) {
            console.error('❌ Missing data field in response');
            return;
        }

        const { newUsers, newSubscriptions, recentPayments } = data.data;

        console.log('\n📈 Recent Activity Summary:');
        console.log(`  - New Users: ${newUsers?.length || 0}`);
        console.log(`  - New Subscriptions: ${newSubscriptions?.length || 0}`);
        console.log(`  - Recent Payments: ${recentPayments?.length || 0}`);

        // Display sample data
        if (newUsers && newUsers.length > 0) {
            console.log('\n👥 Sample New User:');
            console.log(`  - ID: ${newUsers[0].id}`);
            console.log(`  - Email: ${newUsers[0].email}`);
            console.log(`  - Name: ${newUsers[0].firstName} ${newUsers[0].lastName}`);
            console.log(`  - Created: ${new Date(newUsers[0].createdAt * 1000).toLocaleString()}`);
        }

        if (newSubscriptions && newSubscriptions.length > 0) {
            console.log('\n💳 Sample New Subscription:');
            console.log(`  - ID: ${newSubscriptions[0].id}`);
            console.log(`  - User: ${newSubscriptions[0].userFirstName} ${newSubscriptions[0].userLastName} (${newSubscriptions[0].userEmail})`);
            console.log(`  - Plan: ${newSubscriptions[0].planDisplayName}`);
            console.log(`  - Status: ${newSubscriptions[0].status}`);
            console.log(`  - Billing: ${newSubscriptions[0].billingCycle}`);
            console.log(`  - Created: ${new Date(newSubscriptions[0].createdAt * 1000).toLocaleString()}`);
        }

        if (recentPayments && recentPayments.length > 0) {
            console.log('\n💰 Sample Recent Payment:');
            console.log(`  - ID: ${recentPayments[0].id}`);
            console.log(`  - User: ${recentPayments[0].userFirstName} ${recentPayments[0].userLastName} (${recentPayments[0].userEmail})`);
            console.log(`  - Amount: ${recentPayments[0].currency} ${recentPayments[0].amount}`);
            console.log(`  - Status: ${recentPayments[0].status}`);
            console.log(`  - Method: ${recentPayments[0].paymentMethod}`);
            console.log(`  - Created: ${new Date(recentPayments[0].createdAt * 1000).toLocaleString()}`);
        }

        console.log('\n✅ All tests passed! Recent Activity API is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testRecentActivityAPI();
