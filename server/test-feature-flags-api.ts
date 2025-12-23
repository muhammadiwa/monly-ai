/**
 * Test Feature Flags API Endpoints
 * 
 * This script tests the feature flags API endpoints:
 * - GET /api/admin/settings/features - Get all feature flags
 * - PUT /api/admin/settings/features/:key - Update feature flag
 */

const API_BASE_URL = "http://localhost:5000";

let authToken = "";

// Test admin credentials
const ADMIN_EMAIL = "admin@monly.app";
const ADMIN_PASSWORD = "Admin123!@#";

async function login() {
    console.log("🔐 Logging in as admin...");

    const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
        }),
    });

    const data = await response.json();

    if (data.success && data.token) {
        authToken = data.token;
        console.log("✅ Login successful");
        console.log(`   Admin: ${data.admin.name} (${data.admin.email})`);
        return true;
    } else {
        console.error("❌ Login failed:", data);
        return false;
    }
}

async function testGetAllFeatureFlags() {
    console.log("\n📋 Test: GET /api/admin/settings/features (all feature flags)");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (response.ok && data.success) {
        console.log("✅ Successfully fetched feature flags");
        console.log(`   Total feature flags: ${data.data.length}`);

        if (data.data.length > 0) {
            console.log("\n   Feature Flags:");
            data.data.forEach((flag: any) => {
                console.log(`   - ${flag.key}:`);
                console.log(`     Enabled: ${flag.value?.enabled || false}`);
                console.log(`     Plans: ${flag.value?.plans?.join(', ') || 'All plans'}`);
                console.log(`     Description: ${flag.description || 'N/A'}`);
            });
        }
    } else {
        console.error("❌ Failed to fetch feature flags:", data);
    }
}

async function testUpdateFeatureFlag() {
    console.log("\n✏️  Test: PUT /api/admin/settings/features/:key (enable feature)");

    const featureKey = "ai_insights";
    const updateData = {
        enabled: true,
        plans: ["premium", "business"], // Only for premium and business plans
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${featureKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
        console.log("✅ Successfully updated feature flag");
        console.log(`   Key: ${data.data.key}`);
        console.log(`   Enabled: ${data.data.value.enabled}`);
        console.log(`   Plans: ${data.data.value.plans.join(', ')}`);
    } else {
        console.error("❌ Failed to update feature flag:", data);
    }
}

async function testUpdateFeatureFlagAllPlans() {
    console.log("\n✏️  Test: PUT /api/admin/settings/features/:key (enable for all plans)");

    const featureKey = "advanced_reports";
    const updateData = {
        enabled: true,
        plans: [], // Empty array means all plans
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${featureKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
        console.log("✅ Successfully updated feature flag");
        console.log(`   Key: ${data.data.key}`);
        console.log(`   Enabled: ${data.data.value.enabled}`);
        console.log(`   Plans: ${data.data.value.plans.length === 0 ? 'All plans' : data.data.value.plans.join(', ')}`);
    } else {
        console.error("❌ Failed to update feature flag:", data);
    }
}

async function testDisableFeatureFlag() {
    console.log("\n✏️  Test: PUT /api/admin/settings/features/:key (disable feature)");

    const featureKey = "api_access";
    const updateData = {
        enabled: false,
        plans: [],
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${featureKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
        console.log("✅ Successfully disabled feature flag");
        console.log(`   Key: ${data.data.key}`);
        console.log(`   Enabled: ${data.data.value.enabled}`);
    } else {
        console.error("❌ Failed to disable feature flag:", data);
    }
}

async function testUpdateNonExistentFeatureFlag() {
    console.log("\n❌ Test: PUT /api/admin/settings/features/:key (non-existent feature)");

    const featureKey = "non_existent_feature";
    const updateData = {
        enabled: true,
        plans: [],
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${featureKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.status === 404 && !data.success) {
        console.log("✅ Correctly returned 404 for non-existent feature flag");
        console.log(`   Error: ${data.error.message}`);
    } else {
        console.error("❌ Expected 404 error but got:", data);
    }
}

async function testUpdateNonFeatureSetting() {
    console.log("\n❌ Test: PUT /api/admin/settings/features/:key (non-feature setting)");

    const settingKey = "app_name"; // This is a general setting, not a feature flag
    const updateData = {
        enabled: true,
        plans: [],
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.status === 400 && !data.success) {
        console.log("✅ Correctly returned 400 for non-feature setting");
        console.log(`   Error: ${data.error.message}`);
    } else {
        console.error("❌ Expected 400 error but got:", data);
    }
}

async function testInvalidFeatureFlagData() {
    console.log("\n❌ Test: PUT /api/admin/settings/features/:key (invalid data)");

    const featureKey = "ai_insights";
    const updateData = {
        enabled: "not_a_boolean", // Invalid: should be boolean
        plans: "not_an_array", // Invalid: should be array
    };

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/features/${featureKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (response.status === 400 && !data.success) {
        console.log("✅ Correctly returned 400 for invalid data");
        console.log(`   Error: ${data.error.message}`);
    } else {
        console.error("❌ Expected 400 error but got:", data);
    }
}

async function runTests() {
    console.log("🚀 Starting Feature Flags API Tests\n");
    console.log("=".repeat(60));

    // Login first
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error("\n❌ Cannot proceed without authentication");
        return;
    }

    console.log("\n" + "=".repeat(60));

    // Run all tests
    await testGetAllFeatureFlags();
    await testUpdateFeatureFlag();
    await testUpdateFeatureFlagAllPlans();
    await testDisableFeatureFlag();
    await testUpdateNonExistentFeatureFlag();
    await testUpdateNonFeatureSetting();
    await testInvalidFeatureFlagData();

    // Verify final state
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 Final State: GET /api/admin/settings/features");
    await testGetAllFeatureFlags();

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ All Feature Flags API tests completed!");
}

// Run tests
runTests().catch(console.error);
