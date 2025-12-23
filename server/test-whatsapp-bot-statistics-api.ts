/**
 * Test script for WhatsApp Bot Statistics API endpoint
 * Tests GET /api/admin/whatsapp/statistics
 */

import { db } from './db';
import { notificationLogs, whatsappIntegrations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const API_BASE_URL = 'http://localhost:5000';

// Test admin credentials (from seed data)
const ADMIN_EMAIL = 'admin@monly.com';
const ADMIN_PASSWORD = 'admin123';

let authToken: string | null = null;

/**
 * Admin login to get auth token
 */
async function adminLogin() {
    console.log('\n🔐 Logging in as admin...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
            }),
        });

        const data = await response.json();

        if (data.success && data.token) {
            authToken = data.token;
            console.log('✅ Admin login successful');
            console.log('👤 Admin:', data.admin.name, `(${data.admin.email})`);
            return true;
        } else {
            console.error('❌ Admin login failed:', data.error?.message || 'Unknown error');
            return false;
        }
    } catch (error) {
        console.error('❌ Admin login error:', error);
        return false;
    }
}

/**
 * Seed test data for WhatsApp statistics
 */
async function seedTestData() {
    console.log('\n📊 Seeding test data for WhatsApp statistics...');

    try {
        const now = Math.floor(Date.now() / 1000);

        // Get a test user
        const testUsers = await db.select().from(users).limit(1);
        if (testUsers.length === 0) {
            console.log('⚠️ No users found in database. Creating test user...');
            // Create a test user if none exists
            await db.insert(users).values({
                id: 'test-user-whatsapp',
                email: 'testwhatsapp@example.com',
                firstName: 'Test',
                lastName: 'WhatsApp',
                createdAt: now,
                updatedAt: now,
            });
        }

        const userId = testUsers.length > 0 ? testUsers[0].id : 'test-user-whatsapp';

        // Create WhatsApp integration if not exists
        const existingIntegration = await db
            .select()
            .from(whatsappIntegrations)
            .where(eq(whatsappIntegrations.userId, userId))
            .limit(1);

        if (existingIntegration.length === 0) {
            await db.insert(whatsappIntegrations).values({
                userId,
                whatsappNumber: '6281234567890',
                displayName: 'Test User',
                status: 'active',
                activatedAt: now,
                createdAt: now,
            });
            console.log('✅ Created WhatsApp integration');
        }

        // Create notification logs (mix of sent and failed)
        const notificationData = [
            {
                userId,
                type: 'transaction_reminder',
                whatsappNumber: '6281234567890',
                message: 'Reminder: Record your daily transactions',
                status: 'sent' as const,
                sentAt: now - 3600,
                createdAt: now - 3600,
            },
            {
                userId,
                type: 'budget_alert',
                whatsappNumber: '6281234567890',
                message: 'Budget alert: You have exceeded 80% of your budget',
                status: 'sent' as const,
                sentAt: now - 7200,
                createdAt: now - 7200,
            },
            {
                userId,
                type: 'transaction_reminder',
                whatsappNumber: '6281234567890',
                message: 'Reminder: Record your daily transactions',
                status: 'failed' as const,
                sentAt: now - 10800,
                errorMessage: 'WhatsApp connection timeout',
                createdAt: now - 10800,
            },
            {
                userId,
                type: 'goal_achievement',
                whatsappNumber: '6281234567890',
                message: 'Congratulations! You reached your savings goal',
                status: 'sent' as const,
                sentAt: now - 14400,
                createdAt: now - 14400,
            },
            {
                userId,
                type: 'transaction_reminder',
                whatsappNumber: '6281234567890',
                message: 'Reminder: Record your daily transactions',
                status: 'failed' as const,
                sentAt: now - 18000,
                errorMessage: 'Invalid WhatsApp number',
                createdAt: now - 18000,
            },
        ];

        // Check if we already have notification logs
        const existingLogs = await db.select().from(notificationLogs).limit(1);
        if (existingLogs.length === 0) {
            await db.insert(notificationLogs).values(notificationData);
            console.log('✅ Created notification logs');
        } else {
            console.log('ℹ️ Notification logs already exist');
        }

        console.log('✅ Test data seeded successfully');
        return true;
    } catch (error) {
        console.error('❌ Error seeding test data:', error);
        return false;
    }
}

/**
 * Test GET /api/admin/whatsapp/statistics
 */
async function testGetWhatsAppBotStatistics() {
    console.log('\n📊 Testing GET /api/admin/whatsapp/statistics...');

    if (!authToken) {
        console.error('❌ No auth token available');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/statistics`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        console.log('\n📋 Response Status:', response.status);
        console.log('📋 Response Data:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('\n✅ WhatsApp Bot Statistics retrieved successfully');
            console.log('\n📊 Statistics:');
            console.log(`   Total Messages Sent: ${data.data.totalMessagesSent}`);
            console.log(`   Active Connections: ${data.data.activeConnections}`);
            console.log(`   Success Rate: ${data.data.successRate}%`);
            console.log(`   Error Logs Count: ${data.data.errorLogs.length}`);

            if (data.data.errorLogs.length > 0) {
                console.log('\n❌ Recent Error Logs:');
                data.data.errorLogs.forEach((log: any, index: number) => {
                    console.log(`   ${index + 1}. [${log.type}] ${log.errorMessage || 'No error message'}`);
                    console.log(`      Sent at: ${new Date(log.sentAt * 1000).toISOString()}`);
                });
            }

            // Validate response structure
            if (typeof data.data.totalMessagesSent !== 'number') {
                console.error('❌ Invalid totalMessagesSent type');
                return false;
            }
            if (typeof data.data.activeConnections !== 'number') {
                console.error('❌ Invalid activeConnections type');
                return false;
            }
            if (typeof data.data.successRate !== 'number') {
                console.error('❌ Invalid successRate type');
                return false;
            }
            if (!Array.isArray(data.data.errorLogs)) {
                console.error('❌ Invalid errorLogs type');
                return false;
            }

            return true;
        } else {
            console.error('❌ Failed to get WhatsApp Bot statistics');
            console.error('Error:', data.error?.message || 'Unknown error');
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing WhatsApp Bot statistics:', error);
        return false;
    }
}

/**
 * Test without authentication
 */
async function testUnauthorizedAccess() {
    console.log('\n🔒 Testing unauthorized access...');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/whatsapp/statistics`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.status === 401 && !data.success) {
            console.log('✅ Unauthorized access correctly blocked');
            return true;
        } else {
            console.error('❌ Unauthorized access was not blocked properly');
            return false;
        }
    } catch (error) {
        console.error('❌ Error testing unauthorized access:', error);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting WhatsApp Bot Statistics API Tests');
    console.log('='.repeat(50));

    const results = {
        seedData: false,
        login: false,
        getStatistics: false,
        unauthorized: false,
    };

    // Seed test data
    results.seedData = await seedTestData();

    // Test unauthorized access
    results.unauthorized = await testUnauthorizedAccess();

    // Admin login
    results.login = await adminLogin();

    if (results.login) {
        // Test get statistics
        results.getStatistics = await testGetWhatsAppBotStatistics();
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('='.repeat(50));
    console.log(`Seed Test Data:        ${results.seedData ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Unauthorized Access:   ${results.unauthorized ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Admin Login:           ${results.login ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Get Statistics:        ${results.getStatistics ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(50));

    const allPassed = Object.values(results).every(result => result === true);
    if (allPassed) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
