import "dotenv/config";
import { db } from "./db";
import { subscriptionPlans, userSubscriptions, payments, invoices } from "@shared/schema";

async function seedSubscriptionPlans() {
    console.log("🌱 Seeding subscription plans...");

    const now = Math.floor(Date.now() / 1000);

    const plans = [
        {
            name: "free",
            displayName: "Gratis",
            description: "Mulai kelola keuanganmu tanpa biaya",
            priceMonthly: 0,
            priceYearly: 0,
            currency: "IDR",
            features: JSON.stringify([
                "50 transaksi per bulan",
                "Pencatatan transaksi manual",
                "1 kategori budget",
                "1 target keuangan",
                "Ringkasan bulanan",
                "Kategorisasi dasar",
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
            name: "starter",
            displayName: "Starter",
            description: "Cocok untuk pemula yang ingin lebih teratur",
            priceMonthly: 15000,
            priceYearly: 150000, // 2 bulan gratis
            currency: "IDR",
            features: JSON.stringify([
                "200 transaksi per bulan",
                "5 kategori budget",
                "3 target keuangan",
                "Scan struk (10x/bulan)",
                "AI Chat (20 pesan/bulan)",
                "Notifikasi WhatsApp",
                "Export data CSV",
                "Laporan bulanan",
            ]),
            limits: JSON.stringify({
                transactions: 200,
                budgets: 5,
                goals: 3,
                aiAnalysis: 20,
                receiptOCR: 10,
                aiChat: 20,
                whatsappNotifications: true,
                exportData: true,
                advancedReports: false,
                prioritySupport: false,
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
        {
            name: "plus",
            displayName: "Plus",
            description: "Fitur lengkap untuk pengelolaan keuangan serius",
            priceMonthly: 29000,
            priceYearly: 290000, // 2 bulan gratis
            currency: "IDR",
            features: JSON.stringify([
                "Transaksi unlimited",
                "10 kategori budget",
                "10 target keuangan",
                "Scan struk (50x/bulan)",
                "AI Chat (100 pesan/bulan)",
                "AI Analisis keuangan",
                "Notifikasi WhatsApp",
                "Export data CSV & PDF",
                "Laporan lengkap",
                "Dukungan prioritas",
            ]),
            limits: JSON.stringify({
                transactions: -1,
                budgets: 10,
                goals: 10,
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
            name: "pro",
            displayName: "Pro",
            description: "Semua fitur tanpa batas untuk power user",
            priceMonthly: 49000,
            priceYearly: 490000, // 2 bulan gratis
            currency: "IDR",
            features: JSON.stringify([
                "Semua fitur Plus",
                "Budget unlimited",
                "Target unlimited",
                "Scan struk unlimited",
                "AI Chat unlimited",
                "AI Analisis unlimited",
                "Dukungan prioritas 24/7",
            ]),
            limits: JSON.stringify({
                transactions: -1,
                budgets: -1,
                goals: -1,
                aiAnalysis: -1,
                receiptOCR: -1,
                aiChat: -1,
                whatsappNotifications: true,
                exportData: true,
                advancedReports: true,
                prioritySupport: true,
            }),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        },
    ];

    try {
        // Delete related data first (foreign key constraints) - order matters!
        console.log("🗑️  Clearing related data...");
        await db.delete(invoices);
        console.log("   ✅ Invoices cleared");
        await db.delete(payments);
        console.log("   ✅ Payments cleared");
        await db.delete(userSubscriptions);
        console.log("   ✅ User subscriptions cleared");

        // Delete all existing plans
        console.log("🗑️  Clearing existing subscription plans...");
        await db.delete(subscriptionPlans);
        console.log("✅ Existing plans cleared");

        // Insert fresh plans
        for (const plan of plans) {
            await db.insert(subscriptionPlans).values(plan);
            console.log(`✅ Created plan: ${plan.displayName}`);
        }

        console.log("🎉 Subscription plans seeded successfully!");
        console.log("\n📊 Plan Summary:");
        console.log("   • Gratis: Rp 0/bulan - Fitur dasar");
        console.log("   • Starter: Rp 15.000/bulan - Untuk pemula");
        console.log("   • Plus: Rp 29.000/bulan - Fitur lengkap");
        console.log("   • Pro: Rp 49.000/bulan - Unlimited");

    } catch (error) {
        console.error("❌ Error seeding subscription plans:", error);
        throw error;
    }
}

// Run the seed
seedSubscriptionPlans()
    .then(() => {
        console.log("\n✨ Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Fatal error:", error);
        process.exit(1);
    });

export { seedSubscriptionPlans };
