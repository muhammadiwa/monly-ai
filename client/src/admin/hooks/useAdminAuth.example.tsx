/**
 * Example usage of useAdminAuth hook
 * 
 * This file demonstrates how to use the useAdminAuth hook in admin components
 */

import { useAdminAuth } from './useAdminAuth';
import { Button } from '@/components/ui/button';

// Example 1: Basic usage in a component
export function AdminProfileExample() {
    const { admin, isLoading, isAuthenticated, logout } = useAdminAuth();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <div>Not authenticated</div>;
    }

    return (
        <div>
            <h1>Welcome, {admin?.name}</h1>
            <p>Email: {admin?.email}</p>
            <p>Role: {admin?.role}</p>
            <Button onClick={logout}>Logout</Button>
        </div>
    );
}

// Example 2: Usage in AdminHeader component
export function AdminHeaderExample() {
    const { admin, logout, isLoggingOut } = useAdminAuth();

    return (
        <header>
            <div>
                <span>{admin?.name}</span>
                <span>{admin?.email}</span>
            </div>
            <Button onClick={logout} disabled={isLoggingOut}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
        </header>
    );
}

// Example 3: Protected route component
export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAdminAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Hook will automatically redirect to /admin/login
        return null;
    }

    return <>{children}</>;
}

// Example 4: Role-based access control
export function SuperAdminOnlyExample() {
    const { admin, isAuthenticated } = useAdminAuth();

    if (!isAuthenticated || admin?.role !== 'super_admin') {
        return <div>Access denied. Super admin only.</div>;
    }

    return (
        <div>
            <h1>Super Admin Dashboard</h1>
            {/* Super admin content */}
        </div>
    );
}

// Example 5: Displaying last login time
export function LastLoginExample() {
    const { admin } = useAdminAuth();

    if (!admin?.lastLogin) {
        return null;
    }

    const lastLoginDate = new Date(admin.lastLogin * 1000);

    return (
        <div>
            <p>Last login: {lastLoginDate.toLocaleString()}</p>
        </div>
    );
}
