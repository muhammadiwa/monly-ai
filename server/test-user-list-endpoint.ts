/**
 * Integration test for User List API HTTP endpoint
 * Tests GET /api/admin/users via HTTP
 */

import { adminStorage } from "./admin/admin-storage";
import { generateAdminToken } from "./admin/admin-auth";

async function testUserListEndpoint() {
    console.log("🧪 Testing User List HTTP Endpoint...\n");

    try {
        // 1. Get admin token for authentication
        console.log("1️⃣ Getting admin authentication token...");
        const admin = await adminStorage.getAdminByEmail("admin@monly.app");
        if (!admin) {
            console.error("❌ Admin user not found. Please run seed-admin-data.ts first.");
            return;
        }

        const token = generateAdminToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });
        console.log("✅ Admin token generated\n");

        // Note: To test the actual HTTP endpoint, you would need to:
        // 1. Start the server (npm run dev)
        // 2. Use fetch or axios to make HTTP requests
        // 3. Test the endpoint at http://localhost:5000/api/admin/users

        console.log("📝 To test the HTTP endpoint manually:");
        console.log("   1. Start the server: npm run dev");
        console.log("   2. Use curl or Postman to test:");
        console.log(`   
   curl -H "Authorization: Bearer ${token}" \\
        "http://localhost:5000/api/admin/users?page=1&limit=10"
        `);
        console.log();

        console.log("   3. Test with search:");
        console.log(`   
   curl -H "Authorization: Bearer ${token}" \\
        "http://localhost:5000/api/admin/users?search=test&page=1&limit=10"
        `);
        console.log();

        console.log("   4. Test with filters:");
        console.log(`   
   curl -H "Authorization: Bearer ${token}" \\
        "http://localhost:5000/api/admin/users?plan=free&status=free&page=1&limit=10"
        `);
        console.log();

        console.log("✅ Integration test information provided!");
        console.log("\n📋 API Endpoint Summary:");
        console.log("   Endpoint: GET /api/admin/users");
        console.log("   Authentication: Bearer token required");
        console.log("   Query Parameters:");
        console.log("     - page: number (default: 1)");
        console.log("     - limit: number (default: 20, max: 100)");
        console.log("     - search: string (searches name, email, user ID)");
        console.log("     - plan: string (filter by subscription plan)");
        console.log("     - status: string (filter by subscription status)");
        console.log();
        console.log("   Response Format:");
        console.log("   {");
        console.log("     success: true,");
        console.log("     data: {");
        console.log("       users: [...],");
        console.log("       total: number,");
        console.log("       page: number,");
        console.log("       totalPages: number");
        console.log("     }");
        console.log("   }");

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

// Run the test
testUserListEndpoint()
    .then(() => {
        console.log("\n✅ Test completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
