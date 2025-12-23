import "dotenv/config";

/**
 * Test System Settings API
 * 
 * This script tests the system settings CRUD API endpoints:
 * - GET /api/admin/settings - Get all settings or filter by category
 * - PUT /api/admin/settings/:key - Update setting by key
 * - GET /api/admin/settings/audit-log - Get audit log
 */

const API_BASE_URL = "http://localhost:5000";

// Test admin credentials (from seed data)
const ADMIN_EMAIL = "admin@monly.app";
const ADMIN_PASSWORD = "Admin123!@#";

let authToken = "";

async function login() {
    console.log("\n🔐 Logging in as admin...");

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

    if (!response.ok) {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
    }

    authToken = data.token;
    console.log("✅ Login successful");
    console.log(`   Admin: ${data.admin.name} (${data.admin.email})`);
}

async function testGetAllSettings() {
    console.log("\n📋 Test: GET /api/admin/settings (all settings)");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Total settings: ${data.data.length}`);

    // Group by category
    const byCategory: Record<string, number> = {};
    data.data.forEach((setting: any) => {
        byCategory[setting.category] = (byCategory[setting.category] || 0) + 1;
    });

    console.log("   Settings by category:");
    Object.entries(byCategory).forEach(([category, count]) => {
        console.log(`     - ${category}: ${count}`);
    });

    // Show first few settings
    console.log("\n   Sample settings:");
    data.data.slice(0, 5).forEach((setting: any) => {
        console.log(`     - ${setting.category}.${setting.key}: ${JSON.stringify(setting.value)} (${setting.dataType})`);
    });
}

async function testGetSettingsByCategory() {
    console.log("\n📋 Test: GET /api/admin/settings?category=general");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings?category=general`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   General settings: ${data.data.length}`);

    data.data.forEach((setting: any) => {
        console.log(`     - ${setting.key}: ${JSON.stringify(setting.value)}`);
    });
}

async function testUpdateSetting() {
    console.log("\n✏️  Test: PUT /api/admin/settings/:key (update app_name)");

    const settingKey = "app_name";
    const newValue = "Monly Finance - Updated";

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: newValue,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Updated setting: ${data.data.key}`);
    console.log(`   New value: ${JSON.stringify(data.data.value)}`);
    console.log(`   Updated by: ${data.data.updatedBy}`);
    console.log(`   Updated at: ${new Date(data.data.updatedAt * 1000).toLocaleString()}`);
}

async function testUpdateBooleanSetting() {
    console.log("\n✏️  Test: PUT /api/admin/settings/:key (update boolean setting)");

    const settingKey = "maintenance_mode";
    const newValue = true;

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: newValue,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Updated setting: ${data.data.key}`);
    console.log(`   New value: ${data.data.value} (type: ${typeof data.data.value})`);

    // Revert back to false
    console.log("\n   Reverting maintenance_mode back to false...");
    const revertResponse = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: false,
        }),
    });

    const revertData = await revertResponse.json();
    if (revertResponse.ok) {
        console.log(`   ✅ Reverted to: ${revertData.data.value}`);
    }
}

async function testUpdateNumberSetting() {
    console.log("\n✏️  Test: PUT /api/admin/settings/:key (update number setting)");

    const settingKey = "smtp_port";
    const newValue = 465; // SSL port

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: newValue,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Updated setting: ${data.data.key}`);
    console.log(`   New value: ${data.data.value} (type: ${typeof data.data.value})`);

    // Revert back to 587
    console.log("\n   Reverting smtp_port back to 587...");
    const revertResponse = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: 587,
        }),
    });

    const revertData = await revertResponse.json();
    if (revertResponse.ok) {
        console.log(`   ✅ Reverted to: ${revertData.data.value}`);
    }
}

async function testUpdateNonExistentSetting() {
    console.log("\n❌ Test: PUT /api/admin/settings/:key (non-existent setting)");

    const settingKey = "non_existent_setting";
    const newValue = "test";

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
            value: newValue,
        }),
    });

    const data = await response.json();

    if (response.status === 404) {
        console.log("✅ Correctly returned 404 for non-existent setting");
        console.log(`   Error: ${data.error.message}`);
    } else {
        console.error("❌ Expected 404 but got:", response.status, data);
    }
}

async function testGetAuditLog() {
    console.log("\n📜 Test: GET /api/admin/settings/audit-log");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/audit-log?page=1&limit=10`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Total logs: ${data.data.total}`);
    console.log(`   Page: ${data.data.page} of ${data.data.totalPages}`);
    console.log(`   Logs on this page: ${data.data.logs.length}`);

    // Show recent logs
    console.log("\n   Recent activity:");
    data.data.logs.slice(0, 5).forEach((log: any) => {
        const timestamp = new Date(log.createdAt * 1000).toLocaleString();
        console.log(`     - [${timestamp}] ${log.admin.name}: ${log.action} on ${log.resourceType}`);
        if (log.resourceId) {
            console.log(`       Resource ID: ${log.resourceId}`);
        }
        if (log.details) {
            console.log(`       Details: ${JSON.stringify(log.details)}`);
        }
    });
}

async function testGetAuditLogFiltered() {
    console.log("\n📜 Test: GET /api/admin/settings/audit-log (filtered by action)");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings/audit-log?page=1&limit=5&action=UPDATE_SETTING`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Failed:", data);
        return;
    }

    console.log("✅ Success");
    console.log(`   Total UPDATE_SETTING logs: ${data.data.total}`);
    console.log(`   Showing ${data.data.logs.length} logs`);

    data.data.logs.forEach((log: any) => {
        const timestamp = new Date(log.createdAt * 1000).toLocaleString();
        console.log(`     - [${timestamp}] ${log.admin.name}: ${log.action}`);
        if (log.details) {
            console.log(`       Key: ${log.details.key}`);
            console.log(`       Old: ${JSON.stringify(log.details.oldValue)}`);
            console.log(`       New: ${JSON.stringify(log.details.newValue)}`);
        }
    });
}

async function testInvalidCategory() {
    console.log("\n❌ Test: GET /api/admin/settings?category=invalid");

    const response = await fetch(`${API_BASE_URL}/api/admin/settings?category=invalid`, {
        headers: {
            Authorization: `Bearer ${authToken}`,
        },
    });

    const data = await response.json();

    if (response.status === 400) {
        console.log("✅ Correctly returned 400 for invalid category");
        console.log(`   Error: ${data.error.message}`);
    } else {
        console.error("❌ Expected 400 but got:", response.status, data);
    }
}

async function runTests() {
    try {
        console.log("=".repeat(60));
        console.log("🧪 SYSTEM SETTINGS API TESTS");
        console.log("=".repeat(60));

        // Login first
        await login();

        // Test GET endpoints
        await testGetAllSettings();
        await testGetSettingsByCategory();
        await testInvalidCategory();

        // Test UPDATE endpoints
        await testUpdateSetting();
        await testUpdateBooleanSetting();
        await testUpdateNumberSetting();
        await testUpdateNonExistentSetting();

        // Test audit log
        await testGetAuditLog();
        await testGetAuditLogFiltered();

        console.log("\n" + "=".repeat(60));
        console.log("✅ ALL TESTS COMPLETED");
        console.log("=".repeat(60));
    } catch (error) {
        console.error("\n❌ Test failed with error:");
        console.error(error);
        process.exit(1);
    }
}

// Run tests
runTests();
