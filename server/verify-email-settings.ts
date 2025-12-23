/**
 * Verify Email Settings in Database
 * 
 * This script verifies that email settings are correctly stored in the database
 */

import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

console.log('\n📋 Email Settings in Database:');
console.log('================================\n');

const emailSettings = db.prepare(`
    SELECT id, category, key, value, data_type, description, updated_at
    FROM system_settings
    WHERE category = 'email'
    ORDER BY key
`).all();

if (emailSettings.length === 0) {
    console.log('❌ No email settings found in database');
} else {
    console.log(`✅ Found ${emailSettings.length} email settings:\n`);

    for (const setting of emailSettings as any[]) {
        console.log(`Key: ${setting.key}`);
        console.log(`  Value: ${setting.key.includes('password') ? '********' : setting.value}`);
        console.log(`  Type: ${setting.data_type}`);
        console.log(`  Description: ${setting.description}`);
        console.log(`  Updated: ${new Date(setting.updated_at * 1000).toLocaleString()}`);
        console.log('');
    }
}

db.close();
