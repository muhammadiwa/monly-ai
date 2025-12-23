import "dotenv/config";
import { db } from "./db";
import {
    subscriptionPlans,
    adminUsers,
    systemSettings,
    type InsertSubscriptionPlan,
    type InsertAdminUser,
    type InsertSystemSetting
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Seed script for Admin Panel initial data
 * Creates:
 * 1. Default subscription plans (Free, Premium, Business)
 * 2. First admin user with hashed password
 * 3. Default system settings
 */

async function seedSubscriptionPlans() {
    console.log("🌱 Seeding subscription plans...");

    const now = Math.floor(Date.now() / 1000);

    const plans: InsertSubscriptionPlan[] = [
        {
            name: "free",
            displayName: "Free",
            description: "Perfect for getting started with personal finance management",
            priceMonthly: 0,
            priceYearly: 0,
            currency: "IDR",
            features: JSON.stringify([
                "Up to 50 transactions per month",
                "Basic budgeting tools",
                "3 financial goals",
                "Basic reports",
                "Email support"
            ]),
            limits: JSON.stringify({
                transactionLimit: 50,
                accountLimit: 2,
                budgetLimit: 5,
                goalLimit: 3,
                aiInsights: false,
                advancedReports: false,
                prioritySupport: false,
                apiAccess: false
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            name: "premium",
            displayName: "Premium",
            description: "Advanced features for serious financial planning",
            priceMonthly: 49000,
            priceYearly: 490000, // ~2 months free
            currency: "IDR",
            features: JSON.stringify([
                "Unlimited transactions",
                "Advanced budgeting with alerts",
                "Unlimited financial goals",
                "AI-powered insights",
                "Advanced reports & analytics",
                "WhatsApp notifications",
                "Priority email support",
                "Export to Excel/PDF"
            ]),
            limits: JSON.stringify({
                transactionLimit: -1, // unlimited
                accountLimit: 10,
                budgetLimit: -1,
                goalLimit: -1,
                aiInsights: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: false
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            name: "business",
            displayName: "Business",
            description: "Complete solution for business financial management",
            priceMonthly: 99000,
            priceYearly: 990000, // ~2 months free
            currency: "IDR",
            features: JSON.stringify([
                "Everything in Premium",
                "Multi-user access (up to 5 users)",
                "API access for integrations",
                "Custom categories & tags",
                "Advanced analytics & forecasting",
                "Dedicated account manager",
                "24/7 priority support",
                "Custom reports",
                "Data export automation"
            ]),
            limits: JSON.stringify({
                transactionLimit: -1,
                accountLimit: -1,
                budgetLimit: -1,
                goalLimit: -1,
                aiInsights: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: true
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    ];

    try {
        // Check if plans already exist
        const existingPlans = await db.select().from(subscriptionPlans).all();

        if (existingPlans.length > 0) {
            console.log("⚠️  Subscription plans already exist. Skipping...");
            return;
        }

        // Insert plans
        for (const plan of plans) {
            await db.insert(subscriptionPlans).values(plan).run();
            console.log(`✅ Created plan: ${plan.displayName}`);
        }

        console.log("✅ Subscription plans seeded successfully");
    } catch (error) {
        console.error("❌ Error seeding subscription plans:", error);
        throw error;
    }
}

async function seedAdminUser() {
    console.log("🌱 Seeding admin user...");

    const now = Math.floor(Date.now() / 1000);

    // Default admin credentials
    const adminEmail = "admin@monly.app";
    const adminPassword = "Admin123!@#"; // Strong default password
    const adminName = "System Administrator";

    try {
        // Check if admin already exists
        const existingAdmin = await db
            .select()
            .from(adminUsers)
            .where((admin) => admin.email === adminEmail)
            .get();

        if (existingAdmin) {
            console.log("⚠️  Admin user already exists. Skipping...");
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const adminUser: InsertAdminUser = {
            id: randomUUID(),
            email: adminEmail,
            name: adminName,
            password: hashedPassword,
            role: "super_admin",
            lastLogin: null,
            createdAt: now,
            updatedAt: now
        };

        await db.insert(adminUsers).values(adminUser).run();

        console.log("✅ Admin user created successfully");
        console.log("📧 Email:", adminEmail);
        console.log("🔑 Password:", adminPassword);
        console.log("⚠️  IMPORTANT: Change this password after first login!");
    } catch (error) {
        console.error("❌ Error seeding admin user:", error);
        throw error;
    }
}

async function seedSystemSettings() {
    console.log("🌱 Seeding system settings...");

    const now = Math.floor(Date.now() / 1000);

    const settings: InsertSystemSetting[] = [
        // General settings
        {
            category: "general",
            key: "app_name",
            value: "Monly - Personal Finance Manager",
            dataType: "string",
            description: "Application name displayed in UI",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "general",
            key: "app_timezone",
            value: "Asia/Jakarta",
            dataType: "string",
            description: "Default timezone for the application",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "general",
            key: "app_currency",
            value: "IDR",
            dataType: "string",
            description: "Default currency for the application",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "general",
            key: "maintenance_mode",
            value: "false",
            dataType: "boolean",
            description: "Enable maintenance mode to prevent user access",
            updatedBy: null,
            updatedAt: now
        },

        // Payment settings
        {
            category: "payment",
            key: "midtrans_enabled",
            value: "false",
            dataType: "boolean",
            description: "Enable Midtrans payment gateway",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "payment",
            key: "midtrans_environment",
            value: "sandbox",
            dataType: "string",
            description: "Midtrans environment: sandbox or production",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "payment",
            key: "midtrans_server_key",
            value: "",
            dataType: "string",
            description: "Midtrans server key (encrypted)",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "payment",
            key: "midtrans_client_key",
            value: "",
            dataType: "string",
            description: "Midtrans client key",
            updatedBy: null,
            updatedAt: now
        },

        // Email settings
        {
            category: "email",
            key: "smtp_enabled",
            value: "false",
            dataType: "boolean",
            description: "Enable email notifications",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "email",
            key: "smtp_host",
            value: "smtp.gmail.com",
            dataType: "string",
            description: "SMTP server host",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "email",
            key: "smtp_port",
            value: "587",
            dataType: "number",
            description: "SMTP server port",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "email",
            key: "smtp_user",
            value: "",
            dataType: "string",
            description: "SMTP username",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "email",
            key: "smtp_from",
            value: "noreply@monly.app",
            dataType: "string",
            description: "Email sender address",
            updatedBy: null,
            updatedAt: now
        },

        // WhatsApp settings
        {
            category: "whatsapp",
            key: "bot_enabled",
            value: "false",
            dataType: "boolean",
            description: "Enable WhatsApp bot for all users",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "whatsapp",
            key: "bot_phone_number",
            value: "",
            dataType: "string",
            description: "WhatsApp bot phone number",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "whatsapp",
            key: "bot_session_path",
            value: "./.wwebjs_auth/session-monly-bot",
            dataType: "string",
            description: "WhatsApp bot session storage path",
            updatedBy: null,
            updatedAt: now
        },

        // Feature flags
        {
            category: "features",
            key: "ai_insights_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable AI-powered financial insights",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "receipt_ocr_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable receipt OCR scanning",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "whatsapp_notifications_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable WhatsApp notifications for users",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "transaction_reminders_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable transaction reminders",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "budget_alerts_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable budget alerts",
            updatedBy: null,
            updatedAt: now
        },
        {
            category: "features",
            key: "goal_tracking_enabled",
            value: "true",
            dataType: "boolean",
            description: "Enable financial goal tracking",
            updatedBy: null,
            updatedAt: now
        }
    ];

    try {
        // Check if settings already exist
        const existingSettings = await db.select().from(systemSettings).all();

        if (existingSettings.length > 0) {
            console.log("⚠️  System settings already exist. Skipping...");
            return;
        }

        // Insert settings
        for (const setting of settings) {
            await db.insert(systemSettings).values(setting).run();
            console.log(`✅ Created setting: ${setting.category}.${setting.key}`);
        }

        console.log("✅ System settings seeded successfully");
    } catch (error) {
        console.error("❌ Error seeding system settings:", error);
        throw error;
    }
}

async function testDatabaseConnection() {
    console.log("🔍 Testing database connection...");

    try {
        // Test subscription plans query
        const plans = await db.select().from(subscriptionPlans).all();
        console.log(`✅ Found ${plans.length} subscription plans`);

        // Test admin users query
        const admins = await db.select().from(adminUsers).all();
        console.log(`✅ Found ${admins.length} admin users`);

        // Test system settings query
        const settings = await db.select().from(systemSettings).all();
        console.log(`✅ Found ${settings.length} system settings`);

        console.log("✅ Database connection test successful");
    } catch (error) {
        console.error("❌ Database connection test failed:", error);
        throw error;
    }
}

async function main() {
    console.log("🚀 Starting admin data seeding...\n");

    try {
        // Seed subscription plans
        await seedSubscriptionPlans();
        console.log("");

        // Seed admin user
        await seedAdminUser();
        console.log("");

        // Seed system settings
        await seedSystemSettings();
        console.log("");

        // Test database connection
        await testDatabaseConnection();
        console.log("");

        console.log("🎉 Admin data seeding completed successfully!");
        console.log("\n📝 Summary:");
        console.log("   - 3 subscription plans created (Free, Premium, Business)");
        console.log("   - 1 admin user created (admin@monly.app)");
        console.log("   - 22 system settings created");
        console.log("\n⚠️  IMPORTANT: Change the default admin password after first login!");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Seeding failed:", error);
        process.exit(1);
    }
}

// Run the seed script
main();
