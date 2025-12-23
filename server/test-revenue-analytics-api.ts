import 'dotenv/config';
import { adminStorage } from './admin/admin-storage';
import { generateAdminToken } from './admin/admin-auth';

async function testRevenueAnalyticsAPI() {
    console.log('🧪 Testing Revenue Analytics API Endpoint...\n');

    try {
        // First, get an admin user to generate a token
        console.log('🔑 Getting admin user for authentication...');
        const admin = await adminStorage.getAdminByEmail('admin@monly.app');

        if (!admin) {
            console.error('❌ Admin user not found. Please run seed-admin-data.ts first.');
            process.exit(1);
        }

        // Generate admin token - this will use the same JWT_SECRET as the server
        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });

        console.log('✅ Admin token generated');
        console.log(`   Admin: ${admin.name} (${admin.email})`);
        console.log(`   Role: ${admin.role}\n`);

        // Test the API endpoint
        console.log('📡 Testing GET /api/admin/analytics/revenue endpoint...');

        const baseUrl = 'http://localhost:5000';
        const response = await fetch(`${baseUrl}/api/admin/analytics/revenue`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`   Response status: ${response.status}`);

        if (!response.ok) {
            console.error(`❌ API request failed with status: ${response.status}`);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('\n✅ API Response:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify(result, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verify response structure
        console.log('🔍 Verifying API response structure...');
        const checks = [
            { name: 'Response has success field', pass: 'success' in result },
            { name: 'Success is true', pass: result.success === true },
            { name: 'Response has data field', pass: 'data' in result },
            { name: 'Data has mrr field', pass: result.data && 'mrr' in result.data },
            { name: 'Data has arr field', pass: result.data && 'arr' in result.data },
            { name: 'Data has totalRevenue field', pass: result.data && 'totalRevenue' in result.data },
            { name: 'Data has revenueGrowth field', pass: result.data && 'revenueGrowth' in result.data },
            { name: 'Data has revenueByPlan field', pass: result.data && 'revenueByPlan' in result.data },
            { name: 'Data has revenueByMethod field', pass: result.data && 'revenueByMethod' in result.data },
            { name: 'MRR is a number', pass: typeof result.data?.mrr === 'number' },
            { name: 'ARR is a number', pass: typeof result.data?.arr === 'number' },
            { name: 'ARR equals MRR * 12', pass: result.data && Math.abs(result.data.arr - (result.data.mrr * 12)) < 0.01 },
        ];

        checks.forEach(check => {
            console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
        });

        const allPassed = checks.every(check => check.pass);
        if (allPassed) {
            console.log('\n✅ All API checks passed!');
        } else {
            console.log('\n❌ Some API checks failed!');
            process.exit(1);
        }

        // Test without authentication
        console.log('\n🔒 Testing endpoint without authentication...');
        const unauthResponse = await fetch(`${baseUrl}/api/admin/analytics/revenue`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (unauthResponse.status === 401) {
            console.log('✅ Correctly rejected unauthenticated request (401)');
        } else {
            console.log(`❌ Expected 401, got ${unauthResponse.status}`);
        }

        console.log('\n✅ Revenue Analytics API endpoint test completed successfully!');
    } catch (error) {
        console.error('❌ Error testing revenue analytics API:', error);
        throw error;
    }
}

// Run the test
testRevenueAnalyticsAPI()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
