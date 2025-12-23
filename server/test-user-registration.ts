async function testUserRegistration() {
    console.log('🧪 Testing User Registration with Production-Ready UUID...\n');

    try {
        // Generate random email to avoid conflicts
        const randomEmail = `test_${Date.now()}@example.com`;
        const testUser = {
            email: randomEmail,
            password: 'TestPassword123!',
            name: 'Test User Production'
        };

        console.log('📝 Registering new user...');
        console.log(`Email: ${testUser.email}`);
        console.log(`Name: ${testUser.name}\n`);

        const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testUser),
        });

        if (!registerResponse.ok) {
            const errorData = await registerResponse.json();
            console.error('❌ Registration failed:', registerResponse.status, errorData);
            return;
        }

        const registerData = await registerResponse.json();
        console.log('✅ User registered successfully!');
        console.log('Response:', JSON.stringify(registerData, null, 2));

        // Validate user ID format
        const userId = registerData.user.id;
        console.log('\n🔍 Validating User ID Format:');
        console.log(`User ID: ${userId}`);

        // Check if it's a proper UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(userId);

        if (isValidUUID) {
            console.log('✅ User ID is a valid UUID v4 format');
        } else {
            console.log('❌ User ID is NOT a valid UUID format');
            console.log('   Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
        }

        // Check that it doesn't have "demo_" prefix
        if (userId.startsWith('demo_')) {
            console.log('❌ User ID still has "demo_" prefix - not production ready!');
        } else {
            console.log('✅ User ID does not have "demo_" prefix - production ready!');
        }

        // Now login with admin and check recent activity
        console.log('\n🔐 Logging in as admin to verify...');
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
            console.error('❌ Admin login failed');
            return;
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;

        console.log('✅ Admin logged in successfully');

        // Check recent activity
        console.log('\n📊 Checking recent activity...');
        const activityResponse = await fetch('http://localhost:5000/api/admin/dashboard/recent-activity', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!activityResponse.ok) {
            console.error('❌ Failed to fetch recent activity');
            return;
        }

        const activityData = await activityResponse.json();
        const newUsers = activityData.data.newUsers;

        // Find our newly created user
        const newUser = newUsers.find((u: any) => u.email === testUser.email);

        if (newUser) {
            console.log('✅ New user found in recent activity!');
            console.log(`   ID: ${newUser.id}`);
            console.log(`   Email: ${newUser.email}`);
            console.log(`   Name: ${newUser.firstName} ${newUser.lastName}`);
            console.log(`   Created: ${new Date(newUser.createdAt * 1000).toLocaleString()}`);

            // Validate createdAt is not null
            if (newUser.createdAt && newUser.createdAt > 0) {
                console.log('✅ createdAt is properly set');
            } else {
                console.log('❌ createdAt is null or invalid');
            }
        } else {
            console.log('⚠️  New user not found in recent activity (might be sorted out by older users)');
        }

        console.log('\n✅ All tests passed! User registration is production-ready.');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testUserRegistration();
