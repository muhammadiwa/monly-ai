// Load environment variables FIRST
import "dotenv/config";

/**
 * Test script for Admin Storage Layer
 * Tests all storage functions with real database
 */

import { adminStorage } from './admin-storage';
import { hashAdminPassword } from './admin-auth';
import { randomUUID } from 'crypto';

async function testAdminStorage() {
    console.log('🧪 Testing Admin Storage Layer...\n');

    try {
        // Test 1: Create Admin
        console.log('Test 1: Create Admin');
        const testAdminId = randomUUID();
        const testEmail = `test-admin-${Date.now()}@example.com`;
        const hashedPassword = await hashAdminPassword('TestPassword123!');

        const createdAdmin = await adminStorage.createAdmin({
            id: testAdminId,
            email: testEmail,
            name: 'Test Admin',
            password: hashedPassword,
            role: 'admin',
        });

        console.log('✅ Admin created:', {
            id: createdAdmin.id,
            email: createdAdmin.email,
            name: createdAdmin.name,
            role: createdAdmin.role,
        });
        console.log('');

        // Test 2: Get Admin by Email
        console.log('Test 2: Get Admin by Email');
        const adminByEmail = await adminStorage.getAdminByEmail(testEmail);

        if (!adminByEmail) {
            throw new Error('Admin not found by email');
        }

        console.log('✅ Admin found by email:', {
            id: adminByEmail.id,
            email: adminByEmail.email,
            name: adminByEmail.name,
        });
        console.log('');

        // Test 3: Get Admin by ID
        console.log('Test 3: Get Admin by ID');
        const adminById = await adminStorage.getAdminById(testAdminId);

        if (!adminById) {
            throw new Error('Admin not found by ID');
        }

        console.log('✅ Admin found by ID:', {
            id: adminById.id,
            email: adminById.email,
            name: adminById.name,
        });
        console.log('');

        // Test 4: Update Admin
        console.log('Test 4: Update Admin');
        const updatedAdmin = await adminStorage.updateAdmin(testAdminId, {
            name: 'Updated Test Admin',
            role: 'support',
        });

        console.log('✅ Admin updated:', {
            id: updatedAdmin.id,
            name: updatedAdmin.name,
            role: updatedAdmin.role,
        });
        console.log('');

        // Test 5: Update Last Login
        console.log('Test 5: Update Last Login');
        await adminStorage.updateLastLogin(testAdminId);

        const adminAfterLogin = await adminStorage.getAdminById(testAdminId);
        if (!adminAfterLogin || !adminAfterLogin.lastLogin) {
            throw new Error('Last login not updated');
        }

        console.log('✅ Last login updated:', {
            lastLogin: new Date(adminAfterLogin.lastLogin * 1000).toISOString(),
        });
        console.log('');

        // Test 6: Log Admin Activity
        console.log('Test 6: Log Admin Activity');
        await adminStorage.logAdminActivity({
            adminId: testAdminId,
            action: 'test_action',
            resourceType: 'test_resource',
            resourceId: 'test-123',
            details: {
                testField: 'test value',
                timestamp: Date.now(),
            },
            ipAddress: '127.0.0.1',
        });

        console.log('✅ Admin activity logged');
        console.log('');

        // Test 7: Log Activity without Optional Fields
        console.log('Test 7: Log Activity without Optional Fields');
        await adminStorage.logAdminActivity({
            adminId: testAdminId,
            action: 'minimal_test_action',
            resourceType: 'minimal_resource',
        });

        console.log('✅ Admin activity logged (minimal)');
        console.log('');

        // Test 8: Verify Admin Password Hash
        console.log('Test 8: Verify Admin Password Hash');
        const adminWithPassword = await adminStorage.getAdminById(testAdminId);
        if (!adminWithPassword) {
            throw new Error('Admin not found');
        }

        const isPasswordHashed = adminWithPassword.password.startsWith('$2a$') ||
            adminWithPassword.password.startsWith('$2b$');

        if (!isPasswordHashed) {
            throw new Error('Password is not properly hashed');
        }

        console.log('✅ Password is properly hashed (bcrypt)');
        console.log('');

        // Test 9: Test Non-Existent Admin
        console.log('Test 9: Test Non-Existent Admin');
        const nonExistentAdmin = await adminStorage.getAdminByEmail('nonexistent@example.com');

        if (nonExistentAdmin) {
            throw new Error('Should not find non-existent admin');
        }

        console.log('✅ Non-existent admin returns undefined');
        console.log('');

        // Test 10: Test Different Admin Roles
        console.log('Test 10: Test Different Admin Roles');
        const superAdminId = randomUUID();
        const superAdmin = await adminStorage.createAdmin({
            id: superAdminId,
            email: `super-admin-${Date.now()}@example.com`,
            name: 'Super Admin',
            password: await hashAdminPassword('SuperPassword123!'),
            role: 'super_admin',
        });

        console.log('✅ Super admin created:', {
            role: superAdmin.role,
        });
        console.log('');

        console.log('🎉 All Admin Storage Tests Passed!\n');
        console.log('Summary:');
        console.log('- ✅ createAdmin: Working');
        console.log('- ✅ getAdminByEmail: Working');
        console.log('- ✅ getAdminById: Working');
        console.log('- ✅ updateAdmin: Working');
        console.log('- ✅ updateLastLogin: Working');
        console.log('- ✅ logAdminActivity: Working');
        console.log('- ✅ Password hashing: Working');
        console.log('- ✅ Role management: Working');
        console.log('- ✅ Error handling: Working');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
testAdminStorage()
    .then(() => {
        console.log('\n✅ All tests completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    });
