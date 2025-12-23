import crypto from 'crypto';

/**
 * Midtrans Service
 * 
 * This service provides integration with Midtrans payment gateway.
 * It handles transaction creation, status checking, and webhook verification.
 * 
 * Requirements: 7.1, 7.2
 */

// Midtrans API Configuration
interface MidtransConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
    apiUrl: string;
}

// Transaction creation parameters
interface CreateTransactionParams {
    orderId: string;
    grossAmount: number;
    customerDetails: {
        firstName: string;
        lastName?: string;
        email: string;
        phone?: string;
    };
    itemDetails: Array<{
        id: string;
        price: number;
        quantity: number;
        name: string;
    }>;
    transactionDetails?: {
        orderId: string;
        grossAmount: number;
    };
}

// Transaction response from Midtrans
interface TransactionResponse {
    token?: string;
    redirect_url?: string;
    transaction_id?: string;
    order_id: string;
    gross_amount: string;
    payment_type?: string;
    transaction_time?: string;
    transaction_status?: string;
    fraud_status?: string;
    status_code?: string;
    status_message?: string;
}

// Transaction status response
interface TransactionStatusResponse {
    transaction_id: string;
    order_id: string;
    gross_amount: string;
    payment_type: string;
    transaction_time: string;
    transaction_status: string;
    fraud_status?: string;
    status_code: string;
    status_message: string;
    signature_key?: string;
    settlement_time?: string;
    expiry_time?: string;
}

// Webhook notification payload
interface WebhookNotification {
    transaction_time: string;
    transaction_status: string;
    transaction_id: string;
    status_message: string;
    status_code: string;
    signature_key: string;
    payment_type: string;
    order_id: string;
    merchant_id: string;
    gross_amount: string;
    fraud_status?: string;
    currency?: string;
    settlement_time?: string;
    expiry_time?: string;
}

class MidtransService {
    private config: MidtransConfig;

    constructor() {
        // Initialize Midtrans configuration from environment variables
        const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
        const clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
        const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

        // Set API URL based on environment
        const apiUrl = isProduction
            ? 'https://api.midtrans.com/v2'
            : 'https://api.sandbox.midtrans.com/v2';

        this.config = {
            serverKey,
            clientKey,
            isProduction,
            apiUrl,
        };

        // Validate configuration
        if (!serverKey) {
            console.warn('MIDTRANS_SERVER_KEY is not set in environment variables');
        }
        if (!clientKey) {
            console.warn('MIDTRANS_CLIENT_KEY is not set in environment variables');
        }
    }

    /**
     * Get Midtrans configuration
     */
    getConfig(): MidtransConfig {
        return { ...this.config };
    }

    /**
     * Get authorization header for Midtrans API
     */
    private getAuthHeader(): string {
        const base64Auth = Buffer.from(this.config.serverKey + ':').toString('base64');
        return `Basic ${base64Auth}`;
    }

    /**
     * Create a new transaction with Midtrans
     * 
     * @param params - Transaction parameters
     * @returns Transaction response with token and redirect URL
     */
    async createTransaction(params: CreateTransactionParams): Promise<TransactionResponse> {
        try {
            // Validate server key
            if (!this.config.serverKey) {
                throw new Error('Midtrans server key is not configured');
            }

            // Prepare transaction payload
            const payload = {
                transaction_details: {
                    order_id: params.orderId,
                    gross_amount: params.grossAmount,
                },
                customer_details: {
                    first_name: params.customerDetails.firstName,
                    last_name: params.customerDetails.lastName || '',
                    email: params.customerDetails.email,
                    phone: params.customerDetails.phone || '',
                },
                item_details: params.itemDetails,
            };

            // Make API request to Midtrans
            const response = await fetch(`${this.config.apiUrl}/charge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    `Midtrans API error: ${data.status_message || 'Unknown error'}`
                );
            }

            return data as TransactionResponse;
        } catch (error) {
            console.error('Error creating Midtrans transaction:', error);
            throw error;
        }
    }

    /**
     * Get transaction status from Midtrans
     * 
     * @param orderId - Order ID to check status for
     * @returns Transaction status details
     */
    async getTransactionStatus(orderId: string): Promise<TransactionStatusResponse> {
        try {
            // Validate server key
            if (!this.config.serverKey) {
                throw new Error('Midtrans server key is not configured');
            }

            // Make API request to Midtrans
            const response = await fetch(`${this.config.apiUrl}/${orderId}/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    `Midtrans API error: ${data.status_message || 'Unknown error'}`
                );
            }

            return data as TransactionStatusResponse;
        } catch (error) {
            console.error('Error getting Midtrans transaction status:', error);
            throw error;
        }
    }

    /**
     * Verify webhook signature from Midtrans
     * 
     * This ensures the webhook notification is authentic and comes from Midtrans.
     * 
     * @param notification - Webhook notification payload
     * @returns True if signature is valid, false otherwise
     */
    verifyWebhookSignature(notification: WebhookNotification): boolean {
        try {
            // Validate server key
            if (!this.config.serverKey) {
                console.error('Midtrans server key is not configured');
                return false;
            }

            // Extract signature from notification
            const signatureKey = notification.signature_key;
            if (!signatureKey) {
                console.error('Signature key not found in webhook notification');
                return false;
            }

            // Create signature string
            // Format: order_id + status_code + gross_amount + server_key
            const signatureString =
                notification.order_id +
                notification.status_code +
                notification.gross_amount +
                this.config.serverKey;

            // Generate SHA512 hash
            const hash = crypto
                .createHash('sha512')
                .update(signatureString)
                .digest('hex');

            // Compare signatures
            const isValid = hash === signatureKey;

            if (!isValid) {
                console.error('Webhook signature verification failed');
                console.error('Expected:', hash);
                console.error('Received:', signatureKey);
            }

            return isValid;
        } catch (error) {
            console.error('Error verifying webhook signature:', error);
            return false;
        }
    }

    /**
     * Test Midtrans API connection
     * 
     * @returns True if connection is successful, false otherwise
     */
    async testConnection(): Promise<boolean> {
        try {
            // Try to get status of a dummy order (will fail but confirms API is reachable)
            const response = await fetch(`${this.config.apiUrl}/test-order-id/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });

            // Even if the order doesn't exist, a proper API response means connection works
            return response.status === 404 || response.status === 200;
        } catch (error) {
            console.error('Midtrans connection test failed:', error);
            return false;
        }
    }

    /**
     * Cancel a transaction
     * 
     * @param orderId - Order ID to cancel
     * @returns Cancellation response
     */
    async cancelTransaction(orderId: string): Promise<TransactionStatusResponse> {
        try {
            if (!this.config.serverKey) {
                throw new Error('Midtrans server key is not configured');
            }

            const response = await fetch(`${this.config.apiUrl}/${orderId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    `Midtrans API error: ${data.status_message || 'Unknown error'}`
                );
            }

            return data as TransactionStatusResponse;
        } catch (error) {
            console.error('Error canceling Midtrans transaction:', error);
            throw error;
        }
    }

    /**
     * Approve a transaction (for challenge/pending transactions)
     * 
     * @param orderId - Order ID to approve
     * @returns Approval response
     */
    async approveTransaction(orderId: string): Promise<TransactionStatusResponse> {
        try {
            if (!this.config.serverKey) {
                throw new Error('Midtrans server key is not configured');
            }

            const response = await fetch(`${this.config.apiUrl}/${orderId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    `Midtrans API error: ${data.status_message || 'Unknown error'}`
                );
            }

            return data as TransactionStatusResponse;
        } catch (error) {
            console.error('Error approving Midtrans transaction:', error);
            throw error;
        }
    }

    /**
     * Refund a transaction
     * 
     * @param orderId - Order ID to refund
     * @param amount - Amount to refund (optional, full refund if not specified)
     * @param reason - Reason for refund
     * @returns Refund response
     */
    async refundTransaction(
        orderId: string,
        amount?: number,
        reason?: string
    ): Promise<TransactionStatusResponse> {
        try {
            if (!this.config.serverKey) {
                throw new Error('Midtrans server key is not configured');
            }

            const payload: any = {};
            if (amount) {
                payload.refund_amount = amount;
            }
            if (reason) {
                payload.reason = reason;
            }

            const response = await fetch(`${this.config.apiUrl}/${orderId}/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    `Midtrans API error: ${data.status_message || 'Unknown error'}`
                );
            }

            return data as TransactionStatusResponse;
        } catch (error) {
            console.error('Error refunding Midtrans transaction:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const midtransService = new MidtransService();

// Export types
export type {
    MidtransConfig,
    CreateTransactionParams,
    TransactionResponse,
    TransactionStatusResponse,
    WebhookNotification,
};
