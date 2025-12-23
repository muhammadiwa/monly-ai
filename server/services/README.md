# Services

This directory contains service modules for external integrations and business logic.

## Midtrans Service

The Midtrans service provides integration with the Midtrans payment gateway for processing subscription payments.

### Features

- **Transaction Creation**: Create new payment transactions with Midtrans
- **Status Checking**: Query transaction status from Midtrans API
- **Webhook Verification**: Verify webhook signatures for security
- **Transaction Management**: Cancel, approve, and refund transactions
- **Connection Testing**: Test API connectivity

### Configuration

Add the following environment variables to your `.env` file:

```bash
# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY=your-server-key-here
MIDTRANS_CLIENT_KEY=your-client-key-here
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_WEBHOOK_URL=https://yourdomain.com/api/webhooks/midtrans
```

### Usage

```typescript
import { midtransService } from './services/midtrans-service.js';

// Create a transaction
const transaction = await midtransService.createTransaction({
  orderId: 'ORDER-123',
  grossAmount: 100000,
  customerDetails: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+628123456789',
  },
  itemDetails: [
    {
      id: 'PREMIUM-PLAN',
      price: 100000,
      quantity: 1,
      name: 'Premium Subscription',
    },
  ],
});

// Check transaction status
const status = await midtransService.getTransactionStatus('ORDER-123');

// Verify webhook signature
const isValid = midtransService.verifyWebhookSignature(webhookPayload);

// Refund a transaction
const refund = await midtransService.refundTransaction(
  'ORDER-123',
  50000,
  'Customer request'
);
```

### API Methods

#### `createTransaction(params: CreateTransactionParams)`

Creates a new payment transaction with Midtrans.

**Parameters:**
- `orderId`: Unique order identifier
- `grossAmount`: Total transaction amount
- `customerDetails`: Customer information
- `itemDetails`: Array of items being purchased

**Returns:** `TransactionResponse` with token and redirect URL

#### `getTransactionStatus(orderId: string)`

Retrieves the current status of a transaction.

**Parameters:**
- `orderId`: Order ID to check

**Returns:** `TransactionStatusResponse` with transaction details

#### `verifyWebhookSignature(notification: WebhookNotification)`

Verifies the authenticity of a webhook notification from Midtrans.

**Parameters:**
- `notification`: Webhook payload from Midtrans

**Returns:** `boolean` - true if signature is valid

#### `cancelTransaction(orderId: string)`

Cancels a pending transaction.

**Parameters:**
- `orderId`: Order ID to cancel

**Returns:** `TransactionStatusResponse`

#### `approveTransaction(orderId: string)`

Approves a challenged transaction.

**Parameters:**
- `orderId`: Order ID to approve

**Returns:** `TransactionStatusResponse`

#### `refundTransaction(orderId: string, amount?: number, reason?: string)`

Refunds a completed transaction.

**Parameters:**
- `orderId`: Order ID to refund
- `amount`: Amount to refund (optional, full refund if not specified)
- `reason`: Reason for refund (optional)

**Returns:** `TransactionStatusResponse`

#### `testConnection()`

Tests the connection to Midtrans API.

**Returns:** `boolean` - true if connection is successful

### Testing

Run the test script to verify the service:

```bash
npm run tsx server/test-midtrans-service.ts
```

### Security

- Server key is used for API authentication (never expose to frontend)
- Client key can be used in frontend for Snap.js integration
- Webhook signatures are verified using SHA512 hash
- All API calls use HTTPS

### Transaction Flow

1. **Create Transaction**: Generate payment token/URL
2. **Customer Payment**: Customer completes payment on Midtrans
3. **Webhook Notification**: Midtrans sends webhook to your server
4. **Verify Signature**: Verify webhook authenticity
5. **Update Status**: Update payment and subscription status in database
6. **Activate Subscription**: Grant user access to premium features

### Webhook Signature Verification

Midtrans webhooks include a signature for security. The signature is calculated as:

```
SHA512(order_id + status_code + gross_amount + server_key)
```

Always verify the signature before processing webhook notifications.

### Error Handling

The service throws errors for:
- Missing configuration (server key not set)
- API errors (invalid request, network issues)
- Invalid responses from Midtrans

Wrap service calls in try-catch blocks:

```typescript
try {
  const transaction = await midtransService.createTransaction(params);
  // Handle success
} catch (error) {
  console.error('Payment error:', error);
  // Handle error
}
```

### Requirements Fulfilled

- ✅ Requirement 7.1: Payment transaction monitoring
- ✅ Requirement 7.2: Payment search and filtering
- ✅ Midtrans API client initialization
- ✅ Transaction creation functionality
- ✅ Transaction status checking
- ✅ Webhook signature verification
- ✅ Transaction management (cancel, approve, refund)

### Next Steps

1. Implement payment webhook handler endpoint
2. Create payment list and details API endpoints
3. Integrate with subscription management
4. Add invoice generation
5. Implement payment refund workflow
