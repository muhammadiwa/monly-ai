import "dotenv/config";
import { db } from "./db";
import {
    adminUsers,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

/**
 * Seed script for Admin Panel initial data
 * Creates: First admin user with hashed password
 * 
 * Note: 
 * - Subscription plans are seeded separately via seed-subscription-plans.ts
 * - System settings are managed via Admin Panel UI
 */

async function seedAdminUser() {
    console.log("🌱 Seeding admin user...");

    const now = Math.floor(Date.now() / 1000);

    // Default admin credentials
    const adminEmail = "admin@monlyai.web.id";
    const adminPassword = "Admin123"; // Strong default password
    const adminName = "System Administrator";

    try {
        // Check if admin already exists
        const { eq } = await import('drizzle-orm');
        const existingAdmin = await db
            .select()
            .from(adminUsers)
            .where(eq(adminUsers.email, adminEmail))
            .get();

        if (existingAdmin) {
            console.log("⚠️  Admin user already exists. Skipping...");
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const adminUser = {
            id: randomUUID(),
            email: adminEmail,
            name: adminName,
            password: hashedPassword,
            role: "super_admin" as const,
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

async function main() {
    console.log("🚀 Starting admin data seeding...\n");

    try {
        // Seed admin user
        await seedAdminUser();
        console.log("");

        console.log("🎉 Admin data seeding completed successfully!");
        console.log("\n📝 Summary:");
        console.log("   - 1 admin user created (admin@monlyai.web.id)");
        console.log("\n⚠️  IMPORTANT: Change the default admin password after first login!");
        console.log("\n💡 TIP: Run 'npm run seed:plans' to seed subscription plans");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Seeding failed:", error);
        process.exit(1);
    }
}

// Run the seed script
main();
