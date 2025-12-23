import "dotenv/config";
import { db } from "./db";
import { subscriptionPlans, adminUsers, systemSettings } from "@shared/schema";

/**
 * Verification script to check seeded data
 */

async function verifyData() {
    console.log("🔍 Verifying seeded data...\n");

    try {
        // Verify subscription plans
        console.log("📦 Subscription Plans:");
        const plans = await db.select().from(subscriptionPlans).all();
        plans.forEach(plan => {
            console.log(`  - ${plan.displayName} (${plan.name})`);
            console.log(`    Monthly: ${plan.currency} ${plan.priceMonthly}`);
            console.log(`    Yearly: ${plan.currency} ${plan.priceYearly}`);
            console.log(`    Active: ${plan.isActive ? 'Yes' : 'No'}`);
            console.log("");
        });

        // Verify admin users
        console.log("👤 Admin Users:");
        const admins = await db.select().from(adminUsers).all();
        admins.forEach(admin => {
            console.log(`  - ${admin.name}`);
            console.log(`    Email: ${admin.email}`);
            console.log(`    Role: ${admin.role}`);
            console.log(`    ID: ${admin.id}`);
            console.log("");
        });

        // Verify system settings by category
        console.log("⚙️  System Settings:");
        const settings = await db.select().from(systemSettings).all();

        const categories = [...new Set(settings.map(s => s.category))];
        categories.forEach(category => {
            console.log(`  ${category}:`);
            const categorySettings = settings.filter(s => s.category === category);
            categorySettings.forEach(setting => {
                console.log(`    - ${setting.key}: ${setting.value}`);
            });
            console.log("");
        });

        console.log("✅ Verification complete!");
        console.log(`\n📊 Summary:`);
        console.log(`   - ${plans.length} subscription plans`);
        console.log(`   - ${admins.length} admin users`);
        console.log(`   - ${settings.length} system settings`);

        process.exit(0);
    } catch (error) {
        console.error("❌ Verification failed:", error);
        process.exit(1);
    }
}

verifyData();
