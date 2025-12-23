import "dotenv/config";

/**
 * Test script for Admin Authentication endpoints
 * 
 * Tests:
 * 1. POST /api/admin/auth/login - Admin login
 * 2. GET /api/admin/auth/me - Get admin profile
 * 3. POST /api/admin/auth/logout - Admin logout
 */

const BASE_URL = "http://localhost:5000";

async function testAdminLogin() {
    console.log("\n🧪 Testing POST /api/admin/auth/login");

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "admin@monly.app",
                password: "Admin123!@#",
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Admin login successful");
            console.log("   Token:", data.token.substring(0, 20) + "...");
            console.log("   Admin:", data.admin.name, `(${data.admin.role})`);
            return data.token;
        } else {
            console.log("❌ Admin login failed");
            console.log("   Status:", response.status);
            console.log("   Error:", data.error?.message || data.message);
            return null;
        }
    } catch (error) {
        console.log("❌ Admin login request failed:", error);
        return null;
    }
}

async function testGetAdminProfile(token: string) {
    console.log("\n🧪 Testing GET /api/admin/auth/me");

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Get admin profile successful");
            console.log("   Admin ID:", data.admin.id);
            console.log("   Email:", data.admin.email);
            console.log("   Name:", data.admin.name);
            console.log("   Role:", data.admin.role);
            return true;
        } else {
            console.log("❌ Get admin profile failed");
            console.log("   Status:", response.status);
            console.log("   Error:", data.error?.message || data.message);
            return false;
        }
    } catch (error) {
        console.log("❌ Get admin profile request failed:", error);
        return false;
    }
}

async function testAdminLogout(token: string) {
    console.log("\n🧪 Testing POST /api/admin/auth/logout");

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log("✅ Admin logout successful");
            console.log("   Message:", data.message);
            return true;
        } else {
            console.log("❌ Admin logout failed");
            console.log("   Status:", response.status);
            console.log("   Error:", data.error?.message || data.message);
            return false;
        }
    } catch (error) {
        console.log("❌ Admin logout request failed:", error);
        return false;
    }
}

async function testInvalidCredentials() {
    console.log("\n🧪 Testing invalid credentials");

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "admin@monly.app",
                password: "WrongPassword",
            }),
        });

        const data = await response.json();

        if (response.status === 401 && !data.success) {
            console.log("✅ Invalid credentials properly rejected");
            console.log("   Error code:", data.error?.code);
            return true;
        } else {
            console.log("❌ Invalid credentials test failed");
            console.log("   Expected 401, got:", response.status);
            return false;
        }
    } catch (error) {
        console.log("❌ Invalid credentials test request failed:", error);
        return false;
    }
}

async function testUnauthorizedAccess() {
    console.log("\n🧪 Testing unauthorized access to /api/admin/auth/me");

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/me`, {
            method: "GET",
            headers: {
                "Authorization": "Bearer invalid-token",
            },
        });

        const data = await response.json();

        if (response.status === 403 && !data.success) {
            console.log("✅ Unauthorized access properly blocked");
            console.log("   Error code:", data.error?.code);
            return true;
        } else {
            console.log("❌ Unauthorized access test failed");
            console.log("   Expected 403, got:", response.status);
            return false;
        }
    } catch (error) {
        console.log("❌ Unauthorized access test request failed:", error);
        return false;
    }
}

async function main() {
    console.log("🚀 Starting Admin Authentication Tests");
    console.log("   Base URL:", BASE_URL);
    console.log("   Make sure the server is running on port 5000");

    let passedTests = 0;
    let totalTests = 5;

    // Test 1: Admin login
    const token = await testAdminLogin();
    if (token) passedTests++;

    if (token) {
        // Test 2: Get admin profile
        const profileSuccess = await testGetAdminProfile(token);
        if (profileSuccess) passedTests++;

        // Test 3: Admin logout
        const logoutSuccess = await testAdminLogout(token);
        if (logoutSuccess) passedTests++;
    } else {
        console.log("\n⚠️  Skipping profile and logout tests due to login failure");
        totalTests -= 2;
    }

    // Test 4: Invalid credentials
    const invalidCredsSuccess = await testInvalidCredentials();
    if (invalidCredsSuccess) passedTests++;

    // Test 5: Unauthorized access
    const unauthorizedSuccess = await testUnauthorizedAccess();
    if (unauthorizedSuccess) passedTests++;

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Test Summary");
    console.log("=".repeat(50));
    console.log(`   Passed: ${passedTests}/${totalTests}`);
    console.log(`   Failed: ${totalTests - passedTests}/${totalTests}`);

    if (passedTests === totalTests) {
        console.log("\n🎉 All tests passed!");
        process.exit(0);
    } else {
        console.log("\n❌ Some tests failed");
        process.exit(1);
    }
}

// Run tests
main();
