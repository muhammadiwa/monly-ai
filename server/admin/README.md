# Admin Panel Backend

This directory contains the backend implementation for the Admin Panel authentication and management system.

## Files

### `admin-auth.ts`
Admin authentication utilities and middleware:
- `hashAdminPassword()` - Hash passwords with bcrypt (cost factor 12)
- `verifyAdminPassword()` - Verify password against hash
- `generateAdminToken()` - Generate JWT token for admin (1 hour expiry)
- `verifyAdminToken()` - Verify and decode JWT token
- `requireAdminAuth` - Middleware to protect admin routes
- `requireAdminRole()` - Middleware for role-based authorization

### `admin-storage.ts`
Database operations for admin users:
- `getAdminByEmail()` - Find admin by email
- `getAdminById()` - Find admin by ID
- `createAdmin()` - Create new admin user
- `updateAdmin()` - Update admin user
- `updateLastLogin()` - Update last login timestamp
- `logAdminActivity()` - Log admin actions for audit trail

### `admin-routes.ts`
Admin authentication API endpoints:
- `POST /api/admin/auth/login` - Admin login
- `GET /api/admin/auth/me` - Get current admin profile
- `POST /api/admin/auth/logout` - Admin logout

## Authentication Flow

1. **Login**
   ```
   POST /api/admin/auth/login
   Body: { email, password }
   Response: { success, token, admin }
   ```

2. **Access Protected Routes**
   ```
   GET /api/admin/auth/me
   Headers: { Authorization: "Bearer <token>" }
   Response: { success, admin }
   ```

3. **Logout**
   ```
   POST /api/admin/auth/logout
   Headers: { Authorization: "Bearer <token>" }
   Response: { success, message }
   ```

## Security Features

- **Separate JWT Secret**: Admin tokens use `ADMIN_JWT_SECRET` (falls back to `JWT_SECRET`)
- **Short Token Expiry**: Admin tokens expire after 1 hour (vs 7 days for users)
- **Higher Password Security**: bcrypt cost factor 12 (vs 10 for users)
- **Token Type Verification**: Admin tokens include `type: 'admin'` field
- **Audit Logging**: All admin actions are logged to `admin_activity_logs` table
- **Role-Based Access**: Support for `super_admin`, `admin`, and `support` roles

## Default Admin Credentials

After running the seed script (`npm run seed:admin`):
- **Email**: `admin@monly.app`
- **Password**: `Admin123!@#`
- **Role**: `super_admin`

⚠️ **IMPORTANT**: Change the default password after first login!

## Testing

Run the test script to verify admin authentication:
```bash
npx tsx server/test-admin-auth.ts
```

This tests:
- ✅ Admin login with valid credentials
- ✅ Get admin profile with valid token
- ✅ Admin logout
- ✅ Invalid credentials rejection
- ✅ Unauthorized access blocking

## Error Codes

- `UNAUTHORIZED` - No token provided
- `TOKEN_EXPIRED` - Invalid or expired token
- `INVALID_CREDENTIALS` - Wrong email or password
- `VALIDATION_ERROR` - Invalid input data
- `RESOURCE_NOT_FOUND` - Admin not found
- `INTERNAL_SERVER_ERROR` - Server error

## Next Steps

The following admin features will be implemented in subsequent tasks:
- Dashboard metrics and analytics
- User management (view, suspend, delete)
- Subscription plan management
- Payment and invoice management
- System settings configuration
- WhatsApp bot configuration
