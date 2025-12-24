/**
 * Test env-manager utility
 */

import { readEnvFile, parseEnvFile, updateEnvVariable, getEnvVariable } from './utils/env-manager';

console.log('Testing env-manager utility...\n');

// Test 1: Read .env file
console.log('1. Reading .env file...');
const content = readEnvFile();
console.log(`   Content length: ${content.length} characters`);
console.log(`   First 100 chars: ${content.substring(0, 100)}...\n`);

// Test 2: Parse .env file
console.log('2. Parsing .env file...');
const parsed = parseEnvFile(content);
console.log(`   Found ${Object.keys(parsed).length} variables`);
console.log(`   MIDTRANS_SERVER_KEY: ${parsed.MIDTRANS_SERVER_KEY ? parsed.MIDTRANS_SERVER_KEY.substring(0, 15) + '...' : 'Not found'}`);
console.log(`   MIDTRANS_CLIENT_KEY: ${parsed.MIDTRANS_CLIENT_KEY ? parsed.MIDTRANS_CLIENT_KEY.substring(0, 15) + '...' : 'Not found'}\n`);

// Test 3: Get env variable
console.log('3. Getting env variable...');
const serverKey = getEnvVariable('MIDTRANS_SERVER_KEY');
console.log(`   MIDTRANS_SERVER_KEY from process.env: ${serverKey ? serverKey.substring(0, 15) + '...' : 'Not found'}\n`);

// Test 4: Update env variable
console.log('4. Updating env variable...');
const testKey = 'TEST_ENV_UPDATE_' + Date.now();
const testValue = 'test-value-' + Date.now();
console.log(`   Setting ${testKey}=${testValue}`);
const updateSuccess = updateEnvVariable(testKey, testValue);
console.log(`   Update success: ${updateSuccess}`);

if (updateSuccess) {
    // Verify it was written
    const newContent = readEnvFile();
    if (newContent.includes(testKey)) {
        console.log(`   ✅ Variable was written to .env file`);
    } else {
        console.log(`   ❌ Variable was NOT written to .env file`);
    }

    // Verify it's in process.env
    if (process.env[testKey] === testValue) {
        console.log(`   ✅ Variable is in process.env`);
    } else {
        console.log(`   ❌ Variable is NOT in process.env`);
    }
} else {
    console.log(`   ❌ Failed to update variable`);
}

console.log('\nTest complete!');
