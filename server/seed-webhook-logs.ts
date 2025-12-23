/**
 * Seed script to create test webhook logs for testing the webhook logs API
 */

import { db } from './db';
import { midtransWebhookLogs } from '@shared/schema';

async function seedWebhookLogs() {
    console.log('🌱 Seeding webhook logs...\n');

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);
    const twoDaysAgo = now - (2 * 24 * 60 * 60);
    const threeDaysAgo = now - (3 * 24 * 60 * 60);

    const testLogs = [
        {
            orderId: 'ORDER-TEST-001',
            transactionId: 'TXN-001',
            eventType: 'transaction.pending',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-001', transaction_status: 'pending' }),
            signature: 'test-signature-1',
            status: 'processed' as const,
            errorMessage: null,
            createdAt: now,
        },
        {
            orderId: 'ORDER-TEST-001',
            transactionId: 'TXN-001',
            eventType: 'transaction.success',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-001', transaction_status: 'settlement' }),
            signature: 'test-signature-2',
            status: 'processed' as const,
            errorMessage: null,
            createdAt: now - 300, // 5 minutes ago
        },
        {
            orderId: 'ORDER-TEST-002',
            transactionId: 'TXN-002',
            eventType: 'transaction.pending',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-002', transaction_status: 'pending' }),
            signature: 'test-signature-3',
            status: 'processed' as const,
            errorMessage: null,
            createdAt: oneDayAgo,
        },
        {
            orderId: 'ORDER-TEST-003',
            transactionId: 'TXN-003',
            eventType: 'transaction.failed',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-003', transaction_status: 'deny' }),
            signature: 'test-signature-4',
            status: 'failed' as const,
            errorMessage: 'Payment denied by bank',
            createdAt: twoDaysAgo,
        },
        {
            orderId: 'ORDER-TEST-004',
            transactionId: 'TXN-004',
            eventType: 'transaction.pending',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-004', transaction_status: 'pending' }),
            signature: 'test-signature-5',
            status: 'processed' as const,
            errorMessage: null,
            createdAt: threeDaysAgo,
        },
        {
            orderId: 'ORDER-TEST-005',
            transactionId: null,
            eventType: 'transaction.expire',
            payload: JSON.stringify({ order_id: 'ORDER-TEST-005', transaction_status: 'expire' }),
            signature: 'test-signature-6',
            status: 'failed' as const,
            errorMessage: 'Transaction expired',
            createdAt: threeDaysAgo - 3600,
        },
    ];

    try {
        for (const log of testLogs) {
            await db.insert(midtransWebhookLogs).values(log);
            console.log(`✅ Created webhook log: ${log.orderId} - ${log.eventType} (${log.status})`);
        }

        console.log(`\n✅ Successfully seeded ${testLogs.length} webhook logs`);
        console.log('\nWebhook logs summary:');
        console.log(`   - Processed: ${testLogs.filter(l => l.status === 'processed').length}`);
        console.log(`   - Failed: ${testLogs.filter(l => l.status === 'failed').length}`);
        console.log(`   - Total: ${testLogs.length}`);

    } catch (error) {
        console.error('❌ Error seeding webhook logs:', error);
        throw error;
    }
}

// Run the seed function
seedWebhookLogs()
    .then(() => {
        console.log('\n🎉 Seeding completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    });
