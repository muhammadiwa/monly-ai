# Admin Panel Backend

This directory contains the backend implementation for the Admin Panel.

## Completed Features

### ✅ Task 1: Database Schema Setup
- Created migration file with all admin tables
- Added indexes for performance optimization
- Updated shared/schema.ts with Drizzle schemas

### ✅ Task 2: Seed Initial Data
- Created seed script for default subscription plans
- Created first admin user with hashed password
- Seeded default system settings

### ✅ Task 3: Admin Authentication Backend
- Implemented admin login endpoint POST /api/admin/auth/login
- Implemented JWT token generation for admin
- Implemented admin auth middleware (requireAdminAuth)
- Implemented GET /api/admin/auth/me endpoint
- Implemented POST /api/admin/auth/logout endpoint

### ✅ Task 4: Admin Storage Layer
- Created server/admin/admin-storage.ts
- Implemented getAdminByEmail, createAdmin, updateAdmin functions
- Implemented logAdminActivity function for audit trail
- All storage functions tested with real database

### ✅ Task 5: Dashboard Metrics API
- Implemented GET /api/admin/dashboard/metrics endpoint
- Calculate total users, active users, new users from database
- Calculate subscription metrics (total, by plan, churn rate, conversion rate)
- Calculate revenue metrics (MRR, total revenue, growth, revenue by plan)
- Calculate system health metrics (database size, response time, error rate, uptime)
- Fetch recent activity (new users, subscriptions, payments)

## API Endpoints

### Authentication

#### POST /api/admin/auth/login
Login as admin user.

**Request:**
```json
{
  "email": "admin@monly.ai",
  "password": "Admin123!@#"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "admin": {
    "id": "admin-id",
    "email": "admin@monly.ai",
    "name": "Admin User",
    "role": "super_admin"
  }
}
```

#### GET /api/admin/auth/me
Get current admin user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "admin": {
    "id": "admin-id",
    "email": "admin@monly.ai",
    "name": "Admin User",
    "role": "super_admin",
    "lastLogin": 1234567890
  }
}
```

#### POST /api/admin/auth/logout
Logout admin user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Dashboard

#### GET /api/admin/dashboard/metrics
Get comprehensive dashboard metrics.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 100,
      "active": 75,
      "newThisMonth": 15,
      "growthRate": 12.5
    },
    "subscriptions": {
      "total": 50,
      "byPlan": {
        "free": 30,
        "premium": 15,
        "business": 5
      },
      "churnRate": 2.5,
      "conversionRate": 50
    },
    "revenue": {
      "mrr": 5000,
      "totalRevenue": 50000,
      "revenueGrowth": 15.5,
      "revenueByPlan": {
        "premium": 30000,
        "business": 20000
      }
    },
    "system": {
      "databaseSize": 0.21,
      "apiResponseTime": 1,
      "errorRate": 0,
      "uptime": 3600
    },
    "recentActivity": {
      "newUsers": [...],
      "newSubscriptions": [...],
      "recentPayments": [...]
    }
  }
}
```

## Testing

### Test Admin Storage Functions
```bash
npx tsx server/admin/test-admin-storage.ts
```

### Test Admin Authentication
```bash
npx tsx server/test-admin-auth.ts
```

### Test Dashboard Metrics (Direct)
```bash
npx tsx server/test-dashboard-metrics.ts
```

### Test Dashboard Metrics API (HTTP)
```bash
# Start the server first
npm run dev

# In another terminal
npx tsx server/test-dashboard-api.ts
```

## Database Schema

### admin_users
- id (TEXT, PRIMARY KEY)
- email (TEXT, UNIQUE)
- name (TEXT)
- password (TEXT, hashed)
- role (TEXT: super_admin, admin, support)
- last_login (INTEGER, timestamp)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)

### subscription_plans
- id (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- name (TEXT, UNIQUE)
- display_name (TEXT)
- description (TEXT)
- price_monthly (REAL)
- price_yearly (REAL)
- currency (TEXT, default: IDR)
- features (TEXT, JSON array)
- limits (TEXT, JSON object)
- is_active (INTEGER, boolean)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)

### user_subscriptions
- id (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- user_id (TEXT, FOREIGN KEY)
- plan_id (INTEGER, FOREIGN KEY)
- status (TEXT: active, expired, cancelled, pending)
- billing_cycle (TEXT: monthly, yearly)
- start_date (INTEGER, timestamp)
- end_date (INTEGER, timestamp)
- auto_renew (INTEGER, boolean)
- cancelled_at (INTEGER, timestamp)
- cancellation_reason (TEXT)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)

### payments
- id (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- user_id (TEXT, FOREIGN KEY)
- subscription_id (INTEGER, FOREIGN KEY)
- amount (REAL)
- currency (TEXT, default: IDR)
- payment_method (TEXT: credit_card, bank_transfer, e_wallet, other)
- status (TEXT: pending, paid, failed, refunded)
- midtrans_transaction_id (TEXT)
- midtrans_order_id (TEXT, UNIQUE)
- paid_at (INTEGER, timestamp)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)

### admin_activity_logs
- id (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- admin_id (TEXT, FOREIGN KEY)
- action (TEXT)
- resource_type (TEXT)
- resource_id (TEXT)
- details (TEXT, JSON)
- ip_address (TEXT)
- created_at (INTEGER, timestamp)

## Implementation Notes

### Metrics Calculation

**User Metrics:**
- Total: Count all users
- Active: Users with activity in last 30 days (updatedAt >= 30 days ago)
- New This Month: Users created since start of current month
- Growth Rate: (Last 30 days - Previous 30 days) / Previous 30 days * 100

**Subscription Metrics:**
- Total: Count active subscriptions
- By Plan: Group by plan name
- Churn Rate: Cancelled in last 30 days / (Total active + Cancelled) * 100
- Conversion Rate: Paid subscriptions / Total users * 100

**Revenue Metrics:**
- MRR: Sum of monthly subscription prices (yearly normalized to monthly)
- Total Revenue: Sum of all paid payments
- Revenue Growth: (Last 30 days - Previous 30 days) / Previous 30 days * 100
- Revenue By Plan: Sum payments grouped by plan

**System Health:**
- Database Size: Calculated from SQLite page_count * page_size
- API Response Time: Simple query timing
- Error Rate: Placeholder (needs proper error tracking)
- Uptime: Process uptime in seconds

### Security

- Admin passwords are hashed using bcrypt with cost factor 12
- JWT tokens are used for authentication
- All admin actions are logged to admin_activity_logs
- Admin routes require authentication via requireAdminAuth middleware

### Performance

- Dashboard metrics use parallel Promise.all() for better performance
- Proper indexes on frequently queried columns
- Efficient SQL queries with proper WHERE clauses
- Results are rounded to 2 decimal places for consistency

## Next Steps

- [ ] Task 6: Recent Activity API
- [ ] Task 7: Revenue Analytics API
- [ ] Task 8: Chart Data API
- [ ] Task 9: User List API
- [ ] Task 10: User Details API
- [ ] And more...

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

Common error codes:
- UNAUTHORIZED: Admin not authenticated
- INVALID_CREDENTIALS: Invalid email or password
- VALIDATION_ERROR: Invalid input data
- RESOURCE_NOT_FOUND: Resource not found
- INTERNAL_SERVER_ERROR: Server error
