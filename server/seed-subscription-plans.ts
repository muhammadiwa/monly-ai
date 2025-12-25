import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";

async function seedSubscriptionPlans() {
    console.log("🌱 Seeding subscription plans...");

    const now = Math.floor(Date.now() / 1000);

    const plans = [
        {
            name: "free",
            displayName: "Free",
            description: "Perfect for getting started with basic financial tracking",
            priceMonthly: 0,
            priceYearly: 0,
            currency: "IDR",
            features: JSON.stringify([
                "Up to 50 transactions per month",
                "Basic transaction tracking",
                "1 budget category",
                "1 financial goal",
                "Manual transaction entry",
                "Basic expense categorization",
                "Monthly financial summary",
                "Email support",
            ]),
            limits: JSON.stringify({
                transactions: 50,
                budgets: 1,
                goals: 1,
                aiAnalysis: 0,
                receiptOCR: 0,
                aiChat: 0,
                whatsappNotifications: false,
                exportData: false,
                advancedReports: false,
                prioritySupport: false,
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
        {
            name: "premium",
            displayName: "Premium",
            description: "Advanced features for serious financial management",
            priceMonthly: 49000,
            priceYearly: 490000, // ~2 months free
            currency: "IDR",
            features: JSON.stringify([
                "Unlimited transactions",
                "AI-powered transaction categorization",
                "Up to 10 budget categories",
                "Up to 5 financial goals",
                "Receipt OCR scanning (50/month)",
                "AI chat assistant (100 messages/month)",
                "WhatsApp notifications & reminders",
                "Advanced financial insights",
                "Monthly & yearly reports",
                "Data export (CSV, PDF)",
                "Multi-currency support",
                "Priority email support",
            ]),
            limits: JSON.stringify({
                transactions: -1, // unlimited
                budgets: 10,
                goals: 5,
                aiAnalysis: 100,
                receiptOCR: 50,
                aiChat: 100,
                whatsappNotifications: true,
                exportData: true,
                advancedReports: true,
                prioritySupport: true,
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
        {
            name: "business",
            displayName: "Business",
            description: "Complete solution for businesses and power users",
            priceMonthly: 99000,
            priceYearly: 990000, // ~2 months free
            currency: "IDR",
            features: JSON.stringify([
                "Everything in Premium",
                "Unlimited AI-powered features",
                "Unlimited budget categories",
                "Unlimited financial goals",
                "Unlimited receipt OCR scanning",
                "Unlimited AI chat assistant",
                "Advanced AI financial analysis",
                "Custom financial reports",
                "Automated transaction reminders",
                "Goal savings automation",
                "API access",
                "Team collaboration (coming soon)",
                "Dedicated account manager",
                "24/7 priority support",
            ]),
            limits: JSON.stringify({
                transactions: -1, // unlimited
                budgets: -1, // unlimited
                goals: -1, // unlimited
                aiAnalysis: -1, // unlimited
                receiptOCR: -1, // unlimited
                aiChat: -1, // unlimited
                whatsappNotifications: true,
                exportData: true,
                advancedReports: true,
                prioritySupport: true,
                apiAccess: true,
                customReports: true,
                dedicatedSupport: true,
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
    ];

    try {
        // Check if plans already exist
        const existingPlans = await db.select().from(subscriptionPlans);

        if (existingPlans.length > 0) {
            console.log("⚠️  Subscription plans already exist. Skipping seed.");
            console.log(`   Found ${existingPlans.length} existing plans.`);
            return;
        }

        // Insert plans
        for (const plan of plans) {
            await db.insert(subscriptionPlans).values(plan);
            console.log(`✅ Created plan: ${plan.displayName}`);
        }

        console.log("🎉 Subscription plans seeded successfully!");
        console.log("\n📊 Plan Summary:");
        console.log("   • Free: Rp 0/month - Basic features");
        console.log("   • Premium: Rp 49,000/month - Advanced AI features");
        console.log("   • Business: Rp 99,000/month - Unlimited everything");

    } catch (error) {
        console.error("❌ Error seeding subscription plans:", error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedSubscriptionPlans()
        .then(() => {
            console.log("\n✨ Done!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n💥 Fatal error:", error);
            process.exit(1);
        });
}

export { seedSubscriptionPlans };
