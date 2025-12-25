import { Router, type Request, type Response } from 'express';
import { midtransService, type WebhookNotification } from '../services/midtrans-service';
import { AdminStorage } from '../admin/admin-storage';
import { db } from '../db';
import { payments } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const adminStorage = new AdminStorage();

/**
 * Manual Payment Verification Endpoint
 * 
 * This endpoint allows the frontend to verify payment status when user returns
 * from Midtrans payment page. It checks the transaction status directly with
 * Midtrans API and activates the subscription if payment is successful.
 * 
 * GET /api/payment/verify/:orderId
 */
router.get('/verify/:orderId', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'Order ID is required',
            });
        }

        console.log('Verifying payment for order:', orderId);

        // Find payment by Midtrans order ID
        const payment = await db
            .select()
            .from(payments)
            .where(eq(payments.midtransOrderId, orderId))
            .limit(1);

        if (!payment || payment.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found',
                status: 'not_found',
            });
        }

        const paymentRecord = payment[0];

        // If already paid, check if subscription is active, if not activate it
        if (paymentRecord.status === 'paid') {
            // Double-check subscription is activated
            if (paymentRecord.subscriptionId) {
                try {
                    await adminStorage.activateSubscriptionAfterPayment(paymentRecord.subscriptionId);
                    console.log('Re-activated subscription:', paymentRecord.subscriptionId);
                } catch (err) {
                    console.log('Subscription already active or error:', err);
                }
            }
            return res.json({
                success: true,
                status: 'paid',
                message: 'Payment already verified and subscription activated',
            });
        }

        // Check transaction status from Midtrans
        try {
            const midtransStatus = await midtransService.getTransactionStatus(orderId);
            console.log('Midtrans status for order', orderId, ':', midtransStatus);

            const transactionStatus = midtransStatus.transaction_status;
            const fraudStatus = midtransStatus.fraud_status;

            if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
                // Check fraud status for capture
                if (transactionStatus === 'capture' && fraudStatus !== 'accept') {
                    return res.json({
                        success: false,
                        status: 'fraud_detected',
                        message: 'Payment flagged for fraud review',
                    });
                }

                // Payment successful - activate subscription
                console.log('Payment successful, activating subscription for payment ID:', paymentRecord.id);
                try {
                    await handleSuccessfulPayment(
                        paymentRecord.id,
                        midtransStatus.transaction_id,
                        Math.floor(new Date(midtransStatus.settlement_time || Date.now()).getTime() / 1000)
                    );
                    console.log('Subscription activation completed successfully');
                } catch (activationError) {
                    console.error('Error activating subscription:', activationError);
                    // Still return success for payment, but note the activation error
                    return res.json({
                        success: true,
                        status: 'paid',
                        message: 'Payment verified but subscription activation failed. Please contact support.',
                        error: activationError instanceof Error ? activationError.message : 'Unknown error',
                    });
                }

                return res.json({
                    success: true,
                    status: 'paid',
                    message: 'Payment verified and subscription activated',
                });
            } else if (transactionStatus === 'pending') {
                return res.json({
                    success: true,
                    status: 'pending',
                    message: 'Payment is still pending',
                });
            } else if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
                // Update payment status to failed
                await adminStorage.updatePaymentStatus(
                    paymentRecord.id,
                    'failed',
                    midtransStatus.transaction_id
                );

                return res.json({
                    success: false,
                    status: 'failed',
                    message: `Payment ${transactionStatus}`,
                });
            }

            return res.json({
                success: true,
                status: transactionStatus,
                message: `Payment status: ${transactionStatus}`,
            });
        } catch (midtransError) {
            console.error('Error checking Midtrans status:', midtransError);

            // Return current payment status from database
            // Cast to check against 'paid' since TypeScript infers limited enum
            const isPaid = (paymentRecord.status as string) === 'paid';
            return res.json({
                success: isPaid,
                status: paymentRecord.status,
                message: 'Could not verify with Midtrans, returning stored status',
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * Payment Webhook Handler
 * 
 * Handles Midtrans webhook notifications for payment status updates.
 * This endpoint is called by Midtrans when payment status changes.
 * 
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 4.1
 */
router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const notification: WebhookNotification = req.body;

        console.log('Received Midtrans webhook:', {
            orderId: notification.order_id,
            transactionStatus: notification.transaction_status,
            transactionId: notification.transaction_id,
        });

        // Log webhook to database (before verification for audit purposes)
        await adminStorage.logMidtransWebhook({
            orderId: notification.order_id,
            transactionId: notification.transaction_id,
            eventType: notification.transaction_status,
            payload: JSON.stringify(notification),
            signature: notification.signature_key,
            status: 'processed', // Will be updated if processing fails
            errorMessage: undefined,
        });

        // Verify webhook signature (Requirement 3.3)
        const isValidSignature = midtransService.verifyWebhookSignature(notification);

        if (!isValidSignature) {
            console.error('Invalid webhook signature for order:', notification.order_id);

            // Update webhook log with failure
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id,
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status,
                payload: JSON.stringify(notification),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: 'Invalid webhook signature',
            });

            return res.status(403).json({
                success: false,
                error: 'Invalid signature',
            });
        }

        // Find payment by Midtrans order ID
        const payment = await db
            .select()
            .from(payments)
            .where(eq(payments.midtransOrderId, notification.order_id))
            .limit(1);

        if (!payment || payment.length === 0) {
            console.error('Payment not found for order:', notification.order_id);

            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id,
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status,
                payload: JSON.stringify(notification),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: 'Payment not found',
            });

            return res.status(404).json({
                success: false,
                error: 'Payment not found',
            });
        }

        const paymentRecord = payment[0];
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;

        // Process payment based on transaction status (Requirement 3.4)
        if (transactionStatus === 'capture') {
            // For credit card transactions
            if (fraudStatus === 'accept') {
                // Payment successful (Requirement 3.5)
                await handleSuccessfulPayment(
                    paymentRecord.id,
                    notification.transaction_id,
                    Math.floor(Date.now() / 1000)
                );
            } else {
                // Fraud detected or challenge
                await adminStorage.updatePaymentStatus(
                    paymentRecord.id,
                    'failed',
                    notification.transaction_id
                );
                console.log(`Payment ${paymentRecord.id} marked as failed due to fraud status: ${fraudStatus}`);
            }
        } else if (transactionStatus === 'settlement') {
            // Payment successful (Requirement 3.5)
            await handleSuccessfulPayment(
                paymentRecord.id,
                notification.transaction_id,
                Math.floor(new Date(notification.settlement_time || Date.now()).getTime() / 1000)
            );
        } else if (transactionStatus === 'pending') {
            // Payment is pending
            await adminStorage.updatePaymentStatus(
                paymentRecord.id,
                'pending',
                notification.transaction_id
            );
            console.log(`Payment ${paymentRecord.id} is pending`);
        } else if (
            transactionStatus === 'deny' ||
            transactionStatus === 'expire' ||
            transactionStatus === 'cancel'
        ) {
            // Payment failed (Requirement 3.7)
            await adminStorage.updatePaymentStatus(
                paymentRecord.id,
                'failed',
                notification.transaction_id
            );
            console.log(`Payment ${paymentRecord.id} failed with status: ${transactionStatus}`);

            // TODO: Send failure notification email to user
        }

        // Return success response to Midtrans
        return res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
        });

    } catch (error) {
        console.error('Error processing webhook:', error);

        // Log webhook processing error
        try {
            const notification: WebhookNotification = req.body;
            await adminStorage.logMidtransWebhook({
                orderId: notification.order_id,
                transactionId: notification.transaction_id,
                eventType: notification.transaction_status,
                payload: JSON.stringify(notification),
                signature: notification.signature_key,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        } catch (logError) {
            console.error('Error logging webhook failure:', logError);
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

/**
 * Handle successful payment
 * 
 * This function:
 * 1. Updates payment status to 'paid' (Requirement 3.5)
 * 2. Activates the subscription (Requirement 3.6)
 * 3. Generates invoice (Requirement 4.1)
 * 4. Sends confirmation email (Requirement 3.7)
 */
async function handleSuccessfulPayment(
    paymentId: number,
    transactionId: string,
    paidAt: number
): Promise<void> {
    try {
        // Update payment status to 'paid' (Requirement 3.5)
        await adminStorage.updatePaymentStatus(
            paymentId,
            'paid',
            transactionId,
            paidAt
        );
        console.log(`Payment ${paymentId} marked as paid`);

        // Get payment details to find subscription
        const paymentDetails = await db
            .select()
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (!paymentDetails || paymentDetails.length === 0) {
            throw new Error('Payment not found after update');
        }

        const payment = paymentDetails[0];

        // Activate subscription if payment is for a subscription (Requirement 3.6)
        if (payment.subscriptionId) {
            await adminStorage.activateSubscriptionAfterPayment(payment.subscriptionId);
            console.log(`Subscription ${payment.subscriptionId} activated`);
        }

        // Generate invoice (Requirement 4.1)
        try {
            const invoice = await adminStorage.generateInvoice(paymentId);
            console.log(`Invoice ${invoice.invoiceNumber} generated for payment ${paymentId}`);

            // TODO: Send invoice email to user (Requirement 3.7)
            // This would typically use an email service like SendGrid, AWS SES, etc.
            // For now, we just log it
            console.log(`Invoice email should be sent to user ${payment.userId}`);
        } catch (invoiceError) {
            // Log error but don't fail the webhook processing
            // Invoice can be generated manually later if needed
            console.error('Error generating invoice:', invoiceError);
        }

    } catch (error) {
        console.error('Error handling successful payment:', error);
        throw error; // Re-throw to be caught by webhook handler
    }
}

export default router;
