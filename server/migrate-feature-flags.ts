/**
 * Migrate Feature Flags to New Format
 * 
 * This script migrates feature flags from the old boolean format to the new JSON format
 * that supports per-plan configuration.
 */

import { db } from "./db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function migrateFeatureFlags() {
    console.log("🔄 Migrating feature flags to new format...\n");

    const now = Math.floor(Date.now() / 1000);

    // Delete old feature flags
    console.log("🗑️  Deleting old feature flags...");
    const oldFeatureKeys = [
        "ai_insights_enabled",
        "receipt_ocr_enabled",
        "whatsapp_notifications_enabled",
        "transaction_reminders_enabled",
        "budget_alerts_enabled",
        "goal_tracking_enabled"
    ];

    for (const key of oldFeatureKeys) {
        try {
            await db.delete(systemSettings).where(eq(systemSettings.key, key)).run();
            console.log(`   ✅ Deleted: ${key}`);
        } catch (error) {
            console.log(`   ⚠️  Could not delete ${key} (may not exist)`);
        }
    }

    // Insert new feature flags with JSON format
    console.log("\n📝 Creating new feature flags...");
    const newFeatureFlags = [
        {
            category: "features",
            key: "ai_insights",
            value: JSON.stringify({ enabled: true, plans: ["premium", "business"] }),
            dataType: "json",
            description: "Enable AI-powered financial insights (Premium and Business plans only)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "receipt_ocr",
            value: JSON.stringify({ enabled: true, plans: ["premium", "business"] }),
            dataType: "json",
            description: "Enable receipt OCR scanning (Premium and Business plans only)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "whatsapp_notifications",
            value: JSON.stringify({ enabled: true, plans: [] }),
            dataType: "json",
            description: "Enable WhatsApp notifications for users (All plans)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "transaction_reminders",
            value: JSON.stringify({ enabled: true, plans: [] }),
            dataType: "json",
            description: "Enable transaction reminders (All plans)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "budget_alerts",
            value: JSON.stringify({ enabled: true, plans: [] }),
            dataType: "json",
            description: "Enable budget alerts (All plans)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "goal_tracking",
            value: JSON.stringify({ enabled: true, plans: [] }),
            dataType: "json",
            description: "Enable financial goal tracking (All plans)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "advanced_reports",
            value: JSON.stringify({ enabled: true, plans: ["business"] }),
            dataType: "json",
            description: "Enable advanced financial reports (Business plan only)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "api_access",
            value: JSON.stringify({ enabled: false, plans: ["business"] }),
            dataType: "json",
            description: "Enable API access for third-party integrations (Business plan only)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "priority_support",
            value: JSON.stringify({ enabled: true, plans: ["premium", "business"] }),
            dataType: "json",
            description: "Enable priority customer support (Premium and Business plans)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "multi_currency",
            value: JSON.stringify({ enabled: true, plans: [] }),
            dataType: "json",
            description: "Enable multi-currency support (All plans)",
            updatedBy: null,
            updatedAt: now
        }
    ];

    for (const flag of newFeatureFlags) {
        try {
            await db.insert(systemSettings).values(flag).run();
            const parsedValue = JSON.parse(flag.value);
            const plansText = parsedValue.plans.length === 0 ? "All plans" : parsedValue.plans.join(", ");
            console.log(`   ✅ Created: ${flag.key} (${parsedValue.enabled ? "Enabled" : "Disabled"} for ${plansText})`);
        } catch (error) {
            console.error(`   ❌ Error creating ${flag.key}:`, error);
        }
    }

    console.log("\n✅ Feature flags migration completed!");
}

// Run migration
migrateFeatureFlags()
    .then(() => {
        console.log("\n🎉 Migration successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Migration failed:", error);
        process.exit(1);
    });
