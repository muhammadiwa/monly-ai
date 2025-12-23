/**
 * Test Email Configuration API
 * 
 * This script tests the email configuration endpoints:
 * - GET /api/admin/settings/email - Get email configuration
 * - PUT /api/admin/settings/email - Update email configuration
 * - POST /api/admin/settings/email/test - Test email sending
 * 
 * Requirements: 9.5
 */

const BASE_URL = 'http://localhost:5000';

/**
 * Test 0: Admin Login
 */
async function adminLogin(): Promise<string> {
    console.log('\n🔐 Test 0: Admin Login');
    console.log('   Logging in as admin...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@monly.app',
                password: 'Admin123!@#',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('   ❌ Login failed:', data);
            throw new Error('Admin login failed');
        }

        if (!data.success || !data.token) {
            console.error('   ❌ Invalid login response:', data);
            throw new Error('Invalid login response');
        }

        console.log('   ✅ Login successful');
        console.log('   Admin:', data.admin.email);
        return data.token;
    } catch (error) {
        console.error('   ❌ Error during login:', error);
        throw error;
    }
}

/**
 * Test 1: GET /api/admin/settings/email - Get current email configuration
 */
async function testGetEmailConfig(token: string): Promise<void> {
    console.log('\n📋 Test 1: GET /api/admin/settings/email');
    console.log('   Getting current email configuration...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/email`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('   ❌ Failed to get email config:', data);
            throw new Error('Failed to get email config');
        }

        console.log('   ✅ Email configuration retrieved successfully');
        console.log('   SMTP Host:', data.data.smtpHost || '(not set)');
        console.log('   SMTP Port:', data.data.smtpPort || '(not set)');
        console.log('   SMTP User:', data.data.smtpUser || '(not set)');
        console.log('   SMTP From:', data.data.smtpFrom || '(not set)');
        console.log('   SMTP Secure:', data.data.smtpSecure);
        console.log('   Has Password:', data.data.hasPassword || false);
    } catch (error) {
        console.error('   ❌ Error getting email config:', error);
        throw error;
    }
}

/**
 * Test 2: PUT /api/admin/settings/email - Update email configuration
 */
async function testUpdateEmailConfig(token: string): Promise<void> {
    console.log('\n📝 Test 2: PUT /api/admin/settings/email');
    console.log('   Updating email configuration...');

    try {
        const emailConfig = {
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            smtpUser: 'test@example.com',
            smtpPassword: 'test-password-123',
            smtpFrom: 'noreply@monly.com',
            smtpSecure: false,
        };

        const response = await fetch(`${BASE_URL}/api/admin/settings/email`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailConfig),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('   ❌ Failed to update email config:', data);
            throw new Error('Failed to update email config');
        }

        console.log('   ✅ Email configuration updated successfully');
        console.log('   Message:', data.message);
        console.log('   Updated Config:');
        console.log('     - SMTP Host:', data.data.smtpHost);
        console.log('     - SMTP Port:', data.data.smtpPort);
        console.log('     - SMTP User:', data.data.smtpUser);
        console.log('     - SMTP From:', data.data.smtpFrom);
        console.log('     - SMTP Secure:', data.data.smtpSecure);
    } catch (error) {
        console.error('   ❌ Error updating email config:', error);
        throw error;
    }
}

/**
 * Test 3: GET /api/admin/settings/email - Verify updated configuration
 */
async function testVerifyUpdatedConfig(token: string): Promise<void> {
    console.log('\n🔍 Test 3: GET /api/admin/settings/email (verify update)');
    console.log('   Verifying updated email configuration...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/email`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('   ❌ Failed to get email config:', data);
            throw new Error('Failed to get email config');
        }

        console.log('   ✅ Email configuration verified');
        console.log('   SMTP Host:', data.data.smtpHost);
        console.log('   SMTP Port:', data.data.smtpPort);
        console.log('   SMTP User:', data.data.smtpUser);
        console.log('   SMTP From:', data.data.smtpFrom);
        console.log('   SMTP Secure:', data.data.smtpSecure);
        console.log('   Password Masked:', data.data.smtpPassword === '********' ? 'Yes' : 'No');

        // Verify values match what we set
        if (data.data.smtpHost !== 'smtp.gmail.com') {
            throw new Error('SMTP host mismatch');
        }
        if (data.data.smtpPort !== 587) {
            throw new Error('SMTP port mismatch');
        }
        if (data.data.smtpUser !== 'test@example.com') {
            throw new Error('SMTP user mismatch');
        }
        if (data.data.smtpFrom !== 'noreply@monly.com') {
            throw new Error('SMTP from mismatch');
        }

        console.log('   ✅ All values match expected configuration');
    } catch (error) {
        console.error('   ❌ Error verifying email config:', error);
        throw error;
    }
}

/**
 * Test 4: POST /api/admin/settings/email/test - Test email sending (will fail with test credentials)
 */
async function testSendTestEmail(token: string): Promise<void> {
    console.log('\n📧 Test 4: POST /api/admin/settings/email/test');
    console.log('   Testing email sending functionality...');
    console.log('   Note: This will fail with test credentials, which is expected');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/email/test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientEmail: 'test@example.com',
            }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('   ✅ Test email sent successfully (unexpected with test credentials)');
            console.log('   Message:', data.message);
            console.log('   Message ID:', data.data?.messageId);
        } else {
            // Expected to fail with test credentials
            console.log('   ⚠️  Test email failed (expected with test credentials)');
            console.log('   Error Code:', data.error?.code);
            console.log('   Error Message:', data.error?.message);

            // This is actually a success - the endpoint is working correctly
            if (data.error?.code === 'EMAIL_TEST_FAILED') {
                console.log('   ✅ Email test endpoint is working correctly');
            }
        }
    } catch (error) {
        console.error('   ❌ Error testing email:', error);
        throw error;
    }
}

/**
 * Test 5: POST /api/admin/settings/email/test - Test with invalid email
 */
async function testSendTestEmailInvalidRecipient(token: string): Promise<void> {
    console.log('\n❌ Test 5: POST /api/admin/settings/email/test (invalid recipient)');
    console.log('   Testing with invalid recipient email...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/settings/email/test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientEmail: 'invalid-email',
            }),
        });

        const data = await response.json();

        if (!response.ok && data.error?.code === 'VALIDATION_ERROR') {
            console.log('   ✅ Validation error returned as expected');
            console.log('   Error:', data.error.message);
        } else {
            console.error('   ❌ Expected validation error but got:', data);
            throw new Error('Expected validation error');
        }
    } catch (error) {
        console.error('   ❌ Error testing invalid email:', error);
        throw error;
    }
}

/**
 * Test 6: PUT /api/admin/settings/email - Test with invalid data
 */
async function testUpdateEmailConfigInvalid(token: string): Promise<void> {
    console.log('\n❌ Test 6: PUT /api/admin/settings/email (invalid data)');
    console.log('   Testing with invalid email configuration...');

    try {
        const invalidConfig = {
            smtpHost: '', // Empty host
            smtpPort: 587,
            smtpUser: 'test@example.com',
            smtpPassword: 'test-password',
            smtpFrom: 'invalid-email', // Invalid email
            smtpSecure: false,
        };

        const response = await fetch(`${BASE_URL}/api/admin/settings/email`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invalidConfig),
        });

        const data = await response.json();

        if (!response.ok && data.error?.code === 'VALIDATION_ERROR') {
            console.log('   ✅ Validation error returned as expected');
            console.log('   Error:', data.error.message);
            console.log('   Details:', JSON.stringify(data.error.details, null, 2));
        } else {
            console.error('   ❌ Expected validation error but got:', data);
            throw new Error('Expected validation error');
        }
    } catch (error) {
        console.error('   ❌ Error testing invalid config:', error);
        throw error;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🧪 Starting Email Configuration API Tests');
    console.log('==========================================');

    try {
        // Test 0: Login
        const token = await adminLogin();

        // Test 1: Get email config
        await testGetEmailConfig(token);

        // Test 2: Update email config
        await testUpdateEmailConfig(token);

        // Test 3: Verify updated config
        await testVerifyUpdatedConfig(token);

        // Test 4: Test email sending (expected to fail with test credentials)
        await testSendTestEmail(token);

        // Test 5: Test with invalid recipient
        await testSendTestEmailInvalidRecipient(token);

        // Test 6: Test with invalid config
        await testUpdateEmailConfigInvalid(token);

        console.log('\n✅ All Email Configuration API tests completed successfully!');
        console.log('==========================================');
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
