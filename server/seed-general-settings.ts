import "dotenv/config";
import { db } from "./db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Seed General Settings
 * 
 * Minimal general settings yang benar-benar digunakan di aplikasi.
 */

interface GeneralSetting {
    key: string;
    value: string;
    dataType: 'string' | 'number' | 'boolean';
    description: string;
}

const generalSettings: GeneralSetting[] = [
    // Application Info
    {
        key: 'app.name',
        value: 'MonlyAI',
        dataType: 'string',
        description: 'Application name',
    },
    {
        key: 'app.url',
        value: process.env.APP_URL || 'http://localhost:5000',
        dataType: 'string',
        description: 'Base URL of the application (used for payment callbacks)',
    },

    // Localization (already used in code)
    {
        key: 'app.timezone',
        value: process.env.TZ || 'Asia/Jakarta',
        dataType: 'string',
        description: 'Default timezone (used for cron jobs and user preferences)',
    },
    {
        key: 'app.default_currency',
        value: 'IDR',
        dataType: 'string',
        description: 'Default currency for new users',
    },
    {
        key: 'app.default_language',
        value: 'id',
        dataType: 'string',
        description: 'Default language (id = Indonesian, en = English)',
    },
];

async function seedGeneralSettings() {
    console.log('🌱 Seeding general settings...');

    const now = Math.floor(Date.now() / 1000);
    let insertedCount = 0;
    let skippedCount = 0;

    for (const setting of generalSettings) {
        try {
            // Check if setting already exists
            const existing = await db
                .select()
                .from(systemSettings)
                .where(eq(systemSettings.key, setting.key))
                .limit(1);

            if (existing.length > 0) {
                console.log(`   ⏭️  Skipping ${setting.key} (already exists)`);
                skippedCount++;
            } else {
                // Insert new setting
                await db.insert(systemSettings).values({
                    category: 'general',
                    key: setting.key,
                    value: setting.value,
                    dataType: setting.dataType,
                    description: setting.description,
                    updatedBy: null,
                    updatedAt: now,
                });

                console.log(`   ✅ Inserted ${setting.key}`);
                insertedCount++;
            }
        } catch (error) {
            console.error(`   ❌ Error seeding ${setting.key}:`, error);
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Inserted: ${insertedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📝 Total: ${generalSettings.length}`);
}

async function main() {
    try {
        console.log('🚀 Starting general settings seeding...\n');
        await seedGeneralSettings();
        console.log('\n✅ General settings seeding completed!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
}

main();
