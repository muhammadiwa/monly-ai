/**
 * Test script for Revenue Analytics Page
 * 
 * This script tests:
 * 1. Admin authentication
 * 2. Revenue analytics endpoint
 * 3. Revenue chart data endpoint
 * 4. Data structure validation
 */

import { adminStorage } from './admin/admin-storage';

const BASE_URL = 'http://localhost:5000';

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    error?: string;
}

const results: TestResult[] = [];

async function adminLogin(): Promise<string> {
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

        if (!response.ok) {
            throw new Error(`Login failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.token) {
            throw new Error('Login response missing token');
        }

        return data.token;
    } catch (error) {
        throw new Error(`Admin login failed: ${error}`);
    }
}

async function testRevenueAnalyticsEndpoint(token: string): Promise<void> {
    console.log('\n📊 Testing Revenue Analytics Endpoint...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/analytics/revenue`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.success) {
            throw new Error('Response indicates failure');
        }

        if (!data.data) {
            throw new Error('Response missing data field');
        }

        const analytics = data.data;

        // Validate required fields
        const requiredFields = ['mrr', 'arr', 'totalRevenue', 'revenueGrowth', 'revenueByPlan', 'revenueByMethod'];
        for (const field of requiredFields) {
            if (!(field in analytics)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate data types
        if (typeof analytics.mrr !== 'number') {
            throw new Error('MRR should be a number');
        }
        if (typeof analytics.arr !== 'number') {
            throw new Error('ARR should be a number');
        }
        if (typeof analytics.totalRevenue !== 'number') {
            throw new Error('Total revenue should be a number');
        }
        if (typeof analytics.revenueGrowth !== 'number') {
            throw new Error('Revenue growth should be a number');
        }
        if (typeof analytics.revenueByPlan !== 'object') {
            throw new Error('Revenue by plan should be an object');
        }
        if (typeof analytics.revenueByMethod !== 'object') {
            throw new Error('Revenue by method should be an object');
        }

        console.log('✅ Revenue Analytics Endpoint Test Passed');
        console.log(`   MRR: Rp ${analytics.mrr.toLocaleString()}`);
        console.log(`   ARR: Rp ${analytics.arr.toLocaleString()}`);
        console.log(`   Total Revenue: Rp ${analytics.totalRevenue.toLocaleString()}`);
        console.log(`   Revenue Growth: ${analytics.revenueGrowth.toFixed(2)}%`);
        console.log(`   Revenue by Plan:`, Object.keys(analytics.revenueByPlan).length, 'plans');
        console.log(`   Revenue by Method:`, Object.keys(analytics.revenueByMethod).length, 'methods');

        results.push({
            name: 'Revenue Analytics Endpoint',
            passed: true,
            message: 'Successfully fetched and validated revenue analytics data',
        });
    } catch (error) {
        console.error('❌ Revenue Analytics Endpoint Test Failed:', error);
        results.push({
            name: 'Revenue Analytics Endpoint',
            passed: false,
            message: 'Failed to fetch or validate revenue analytics data',
            error: String(error),
        });
        throw error;
    }
}

async function testRevenueChartEndpoint(token: string, period: 'week' | 'month' | 'year'): Promise<void> {
    console.log(`\n📈 Testing Revenue Chart Endpoint (${period})...`);

    try {
        const response = await fetch(`${BASE_URL}/api/admin/dashboard/charts/revenue?period=${period}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.success) {
            throw new Error('Response indicates failure');
        }

        if (!data.data) {
            throw new Error('Response missing data field');
        }

        const chartData = data.data;

        // Validate required fields
        if (!Array.isArray(chartData.labels)) {
            throw new Error('Labels should be an array');
        }
        if (!Array.isArray(chartData.data)) {
            throw new Error('Data should be an array');
        }

        // Validate arrays have same length
        if (chartData.labels.length !== chartData.data.length) {
            throw new Error('Labels and data arrays should have same length');
        }

        // Validate data values are numbers
        for (const value of chartData.data) {
            if (typeof value !== 'number') {
                throw new Error('All data values should be numbers');
            }
        }

        console.log(`✅ Revenue Chart Endpoint Test Passed (${period})`);
        console.log(`   Data points: ${chartData.labels.length}`);
        console.log(`   Total revenue in period: Rp ${chartData.data.reduce((a, b) => a + b, 0).toLocaleString()}`);

        results.push({
            name: `Revenue Chart Endpoint (${period})`,
            passed: true,
            message: `Successfully fetched and validated revenue chart data for ${period}`,
        });
    } catch (error) {
        console.error(`❌ Revenue Chart Endpoint Test Failed (${period}):`, error);
        results.push({
            name: `Revenue Chart Endpoint (${period})`,
            passed: false,
            message: `Failed to fetch or validate revenue chart data for ${period}`,
            error: String(error),
        });
        throw error;
    }
}

async function testUnauthorizedAccess(): Promise<void> {
    console.log('\n🔒 Testing Unauthorized Access...');

    try {
        const response = await fetch(`${BASE_URL}/api/admin/analytics/revenue`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            throw new Error('Endpoint should reject unauthorized requests');
        }

        if (response.status !== 401) {
            throw new Error(`Expected 401 status, got ${response.status}`);
        }

        console.log('✅ Unauthorized Access Test Passed');
        console.log('   Endpoint correctly rejects unauthorized requests');

        results.push({
            name: 'Unauthorized Access',
            passed: true,
            message: 'Endpoint correctly rejects unauthorized requests',
        });
    } catch (error) {
        console.error('❌ Unauthorized Access Test Failed:', error);
        results.push({
            name: 'Unauthorized Access',
            passed: false,
            message: 'Endpoint authorization check failed',
            error: String(error),
        });
    }
}

async function runTests() {
    console.log('🚀 Starting Revenue Analytics Page Tests...\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Admin Login
        console.log('\n🔐 Testing Admin Login...');
        const token = await adminLogin();
        console.log('✅ Admin Login Successful');
        results.push({
            name: 'Admin Login',
            passed: true,
            message: 'Successfully authenticated as admin',
        });

        // Test 2: Revenue Analytics Endpoint
        await testRevenueAnalyticsEndpoint(token);

        // Test 3: Revenue Chart Endpoints (all periods)
        await testRevenueChartEndpoint(token, 'week');
        await testRevenueChartEndpoint(token, 'month');
        await testRevenueChartEndpoint(token, 'year');

        // Test 4: Unauthorized Access
        await testUnauthorizedAccess();

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}: ${result.message}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${results.length} tests`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log('='.repeat(60));

    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. Please review the errors above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        console.log('\n✅ Revenue Analytics Page is ready to use!');
        console.log('   Navigate to: http://localhost:5000/admin/revenue');
        process.exit(0);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
