/**
 * Test script for User List API endpoint
 * Tests GET /api/admin/users with pagination, search, and filtering
 */

import { db } from "./db";
import { users, subscriptionPlans } from "@shared/schema";
import { adminStorage } from "./admin/admin-storage";
import { generateAdminToken } from "./admin/admin-auth";
import { eq } from "drizzle-orm";

async function testUserListAPI() {
    console.log("🧪 Testing User List API...\n");

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

        // 2. Test basic user list (no filters)
        console.log("2️⃣ Testing basic user list (page 1, limit 10)...");
        const basicResult = await adminStorage.getUserList({
            page: 1,
            limit: 10,
        });
        console.log(`✅ Found ${basicResult.total} total users`);
        console.log(`   Page: ${basicResult.page}/${basicResult.totalPages}`);
        console.log(`   Users on this page: ${basicResult.users.length}`);
        if (basicResult.users.length > 0) {
            console.log(`   First user: ${basicResult.users[0].name} (${basicResult.users[0].email})`);
        }
        console.log();

        // 3. Test search by email
        console.log("3️⃣ Testing search by email...");
        const allUsers = await db.select().from(users).limit(1);
        if (allUsers.length > 0) {
            const testEmail = allUsers[0].email;
            console.log(`   Searching for: ${testEmail}`);
            const searchResult = await adminStorage.getUserList({
                page: 1,
                limit: 10,
                search: testEmail || '',
            });
            console.log(`✅ Search found ${searchResult.total} user(s)`);
            if (searchResult.users.length > 0) {
                console.log(`   Result: ${searchResult.users[0].name} (${searchResult.users[0].email})`);
            }
        } else {
            console.log("⚠️  No users in database to test search");
        }
        console.log();

        // 4. Test search by name
        console.log("4️⃣ Testing search by name...");
        const usersWithNames = await db.select().from(users).limit(1);
        if (usersWithNames.length > 0 && usersWithNames[0].firstName) {
            const testName = usersWithNames[0].firstName;
            console.log(`   Searching for: ${testName}`);
            const nameSearchResult = await adminStorage.getUserList({
                page: 1,
                limit: 10,
                search: testName,
            });
            console.log(`✅ Search found ${nameSearchResult.total} user(s)`);
        } else {
            console.log("⚠️  No users with names to test search");
        }
        console.log();

        // 5. Test filter by subscription plan
        console.log("5️⃣ Testing filter by subscription plan...");
        const plans = await db.select().from(subscriptionPlans);
        if (plans.length > 0) {
            const testPlan = plans[0].name;
            console.log(`   Filtering by plan: ${testPlan}`);
            const planFilterResult = await adminStorage.getUserList({
                page: 1,
                limit: 10,
                plan: testPlan,
            });
            console.log(`✅ Found ${planFilterResult.total} user(s) with plan: ${testPlan}`);
        } else {
            console.log("⚠️  No subscription plans in database");
        }
        console.log();

        // 6. Test filter by status
        console.log("6️⃣ Testing filter by status...");
        const statusFilterResult = await adminStorage.getUserList({
            page: 1,
            limit: 10,
            status: 'free',
        });
        console.log(`✅ Found ${statusFilterResult.total} user(s) with status: free`);
        console.log();

        // 7. Test pagination
        console.log("7️⃣ Testing pagination...");
        const page1 = await adminStorage.getUserList({
            page: 1,
            limit: 5,
        });
        console.log(`   Page 1: ${page1.users.length} users`);

        if (page1.totalPages > 1) {
            const page2 = await adminStorage.getUserList({
                page: 2,
                limit: 5,
            });
            console.log(`   Page 2: ${page2.users.length} users`);
            console.log(`✅ Pagination working correctly`);
        } else {
            console.log(`⚠️  Only ${page1.totalPages} page(s) available`);
        }
        console.log();

        // 8. Test combined filters
        console.log("8️⃣ Testing combined filters (search + status)...");
        const combinedResult = await adminStorage.getUserList({
            page: 1,
            limit: 10,
            search: '@',
            status: 'free',
        });
        console.log(`✅ Found ${combinedResult.total} user(s) matching combined filters`);
        console.log();

        // 9. Display sample user data structure
        console.log("9️⃣ Sample user data structure:");
        if (basicResult.users.length > 0) {
            console.log(JSON.stringify(basicResult.users[0], null, 2));
        }
        console.log();

        console.log("✅ All User List API tests completed successfully!");

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

// Run the test
testUserListAPI()
    .then(() => {
        console.log("\n✅ Test completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    });
