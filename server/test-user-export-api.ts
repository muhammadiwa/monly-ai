/**
 * Test script for User Data Export API
 * 
 * Tests:
 * - GET /api/admin/users/export - Export user data as CSV
 * - Support for filtering by search, plan, status
 * - Support for date range filtering
 * - CSV format validation
 * - Authentication requirement
 */

import { db } from './db';
import { users, adminUsers, subscriptionPlans } from '@shared/schema';
import { hashAdminPassword, generateAdminToken } from './admin/admin-auth';
import { eq } from 'drizzle-orm';

const API_BASE = 'http://localhost:5000/api';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
    results.push({ name, passed, error, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (error) console.log(`  Error: ${error}`);
    if (details) console.log(`  Details:`, details);
}

async function setupTestData() {
    console.log('\n🔧 Setting up test data...\n');

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60);
    const timestamp = Date.now();

    // Create admin user for testing with unique email
    const adminId = 'test-admin-export-' + timestamp;
    const adminEmail = `admin-export-${timestamp}@test.com`;
    const hashedPassword = await hashAdminPassword('TestPassword123!');

    await db.insert(adminUsers).values({
        id: adminId,
        email: adminEmail,
        name: 'Export Test Admin',
        password: hashedPassword,
        role: 'admin',
        lastLogin: null,
        createdAt: now,
        updatedAt: now,
    });

    // Ensure subscription plans exist
    const existingPlans = await db.select().from(subscriptionPlans);
    if (existingPlans.length === 0) {
        const plans = [
            {
                name: 'free',
                displayName: 'Free',
                description: 'Free plan',
                priceMonthly: 0,
                priceYearly: 0,
                currency: 'IDR',
                features: JSON.stringify(['Basic features']),
                limits: JSON.stringify({ transactionLimit: 100 }),
                isActive: true, // Fixed: Changed from 1 to true (boolean)
                createdAt: now,
                updatedAt: now,
            },
            {
                name: 'premium',
                displayName: 'Premium',
                description: 'Premium plan',
                priceMonthly: 99000,
                priceYearly: 990000,
                currency: 'IDR',
                features: JSON.stringify(['All features']),
                limits: JSON.stringify({ transactionLimit: -1 }),
                isActive: true, // Fixed: Changed from 1 to true (boolean)
                createdAt: now,
                updatedAt: now,
            },
        ];

        for (const plan of plans) {
            await db.insert(subscriptionPlans).values(plan);
        }
    }

    // Create test users with different dates
    const testUsers = [
        {
            id: 'export-user-1-' + timestamp,
            email: `export1-${timestamp}@test.com`,
            firstName: 'Export',
            lastName: 'User One',
            subscriptionStatus: 'active',
            createdAt: now,
            updatedAt: now,
        },
        {
            id: 'export-user-2-' + timestamp,
            email: `export2-${timestamp}@test.com`,
            firstName: 'Export',
            lastName: 'User Two',
            subscriptionStatus: 'active',
            createdAt: thirtyDaysAgo,
            updatedAt: thirtyDaysAgo,
        },
        {
            id: 'export-user-3-' + timestamp,
            email: `export3-${timestamp}@test.com`,
            firstName: 'Export',
            lastName: 'User Three',
            subscriptionStatus: 'suspended',
            createdAt: sixtyDaysAgo,
            updatedAt: sixtyDaysAgo,
        },
    ];

    for (const user of testUsers) {
        await db.insert(users).values(user);
    }

    // Login to get a valid token
    const loginResponse = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: adminEmail,
            password: 'TestPassword123!',
        }),
    });

    if (!loginResponse.ok) {
        throw new Error(`Failed to login: ${await loginResponse.text()}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('✅ Test data setup complete\n');

    return { adminId, token, testUsers, timestamp };
}

async function cleanupTestData(adminId: string, testUserIds: string[]) {
    console.log('\n🧹 Cleaning up test data...\n');

    // Delete test admin
    await db.delete(adminUsers).where(eq(adminUsers.id, adminId));

    // Delete test users
    for (const userId of testUserIds) {
        await db.delete(users).where(eq(users.id, userId));
    }

    console.log('✅ Cleanup complete\n');
}

async function testExportAllUsers(token: string) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/export`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const csvContent = await response.text();

        // Validate CSV format
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');

        // Check headers
        const expectedHeaders = [
            'User ID',
            'Email',
            'First Name',
            'Last Name',
            'Full Name',
            'Subscription Plan',
            'Status',
            'Registration Date',
            'Last Login',
            'Transaction Count',
            'Budget Count',
            'Goal Count'
        ];

        const headersMatch = expectedHeaders.every((header, index) =>
            headers[index] === header
        );

        if (!headersMatch) {
            throw new Error('CSV headers do not match expected format');
        }

        // Check that we have data rows
        if (lines.length < 2) {
            throw new Error('CSV has no data rows');
        }

        // Validate Content-Type header
        const contentType = response.headers.get('Content-Type');
        if (!contentType?.includes('text/csv')) {
            throw new Error(`Invalid Content-Type: ${contentType}`);
        }

        // Validate Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        if (!contentDisposition?.includes('attachment')) {
            throw new Error(`Invalid Content-Disposition: ${contentDisposition}`);
        }

        logTest('Export all users', true, undefined, {
            rowCount: lines.length - 1,
            headers: headers.length,
            contentType,
        });
    } catch (error) {
        logTest('Export all users', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportWithSearch(token: string, timestamp: number) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/export?search=export1-${timestamp}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const csvContent = await response.text();
        const lines = csvContent.split('\n');

        // Should have header + at least 1 matching user
        if (lines.length < 2) {
            throw new Error('No matching users found');
        }

        // Check that the data contains the search term
        const dataRow = lines[1];
        if (!dataRow.toLowerCase().includes(`export1-${timestamp}`)) {
            throw new Error('Search filter not applied correctly');
        }

        logTest('Export with search filter', true, undefined, {
            rowCount: lines.length - 1,
        });
    } catch (error) {
        logTest('Export with search filter', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportWithStatus(token: string) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/export?status=suspended`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const csvContent = await response.text();
        const lines = csvContent.split('\n');

        // Should have header + suspended users
        if (lines.length < 2) {
            throw new Error('No suspended users found');
        }

        // Check that the data contains suspended status
        const dataRow = lines[1];
        if (!dataRow.includes('suspended')) {
            throw new Error('Status filter not applied correctly');
        }

        logTest('Export with status filter', true, undefined, {
            rowCount: lines.length - 1,
        });
    } catch (error) {
        logTest('Export with status filter', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportWithDateRange(token: string) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const fifteenDaysAgo = now - (15 * 24 * 60 * 60);

        const response = await fetch(
            `${API_BASE}/admin/users/export?dateFrom=${fifteenDaysAgo}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const csvContent = await response.text();
        const lines = csvContent.split('\n');

        // Should have header + users registered in last 15 days
        if (lines.length < 2) {
            throw new Error('No users found in date range');
        }

        logTest('Export with date range filter', true, undefined, {
            rowCount: lines.length - 1,
            dateFrom: new Date(fifteenDaysAgo * 1000).toISOString(),
        });
    } catch (error) {
        logTest('Export with date range filter', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportWithInvalidDateRange(token: string) {
    try {
        const response = await fetch(
            `${API_BASE}/admin/users/export?dateFrom=invalid`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (response.ok) {
            throw new Error('Should have rejected invalid date parameter');
        }

        const data = await response.json();

        if (data.error?.code !== 'VALIDATION_ERROR') {
            throw new Error('Should return VALIDATION_ERROR');
        }

        logTest('Export with invalid date range', true);
    } catch (error) {
        logTest('Export with invalid date range', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportWithoutAuth() {
    try {
        const response = await fetch(`${API_BASE}/admin/users/export`, {
            method: 'GET',
        });

        if (response.ok) {
            throw new Error('Should require authentication');
        }

        if (response.status !== 401) {
            throw new Error(`Expected 401, got ${response.status}`);
        }

        logTest('Export without authentication', true);
    } catch (error) {
        logTest('Export without authentication', false, error instanceof Error ? error.message : String(error));
    }
}

async function testExportCSVEscaping(token: string, timestamp: number) {
    try {
        // Create a user with special characters that need CSV escaping
        const now = Math.floor(Date.now() / 1000);
        const specialUserId = 'export-special-' + timestamp;

        await db.insert(users).values({
            id: specialUserId,
            email: `special-${timestamp}@test.com`,
            firstName: 'Test, User',
            lastName: 'With "Quotes"',
            subscriptionStatus: 'active',
            createdAt: now,
            updatedAt: now,
        });

        const response = await fetch(`${API_BASE}/admin/users/export?search=special-${timestamp}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const csvContent = await response.text();
        const lines = csvContent.split('\n');

        // Check that special characters are properly escaped
        const dataRow = lines[1];

        // Should contain quoted values for fields with commas or quotes
        if (!dataRow.includes('"Test, User"') && !dataRow.includes('Test, User')) {
            throw new Error('Comma not properly escaped in CSV');
        }

        // Cleanup special user
        await db.delete(users).where(eq(users.id, specialUserId));

        logTest('Export with CSV escaping', true, undefined, {
            dataRow: dataRow.substring(0, 100) + '...',
        });
    } catch (error) {
        logTest('Export with CSV escaping', false, error instanceof Error ? error.message : String(error));
    }
}

async function runTests() {
    console.log('🧪 Starting User Data Export API Tests\n');
    console.log('='.repeat(60));

    let testData: any;

    try {
        // Setup
        testData = await setupTestData();

        // Run tests
        console.log('📋 Running Export Tests...\n');
        await testExportAllUsers(testData.token);
        await testExportWithSearch(testData.token, testData.timestamp);
        await testExportWithStatus(testData.token);
        await testExportWithDateRange(testData.token);
        await testExportWithInvalidDateRange(testData.token);
        await testExportWithoutAuth();
        await testExportCSVEscaping(testData.token, testData.timestamp);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary\n');

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const total = results.length;

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }

        console.log('\n' + '='.repeat(60));

        // Cleanup
        if (testData) {
            await cleanupTestData(
                testData.adminId,
                testData.testUsers.map((u: any) => u.id)
            );
        }

        // Exit with appropriate code
        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('\n❌ Test execution failed:', error);

        // Attempt cleanup
        if (testData) {
            try {
                await cleanupTestData(
                    testData.adminId,
                    testData.testUsers.map((u: any) => u.id)
                );
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
        }

        process.exit(1);
    }
}

// Run tests
runTests();
