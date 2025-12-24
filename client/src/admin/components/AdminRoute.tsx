import { ReactNode, useEffect } from "react";
import { useAdminAuth } from "@/admin/hooks/useAdminAuth";
import { useLocation } from "wouter";

interface AdminRouteProps {
    children: ReactNode;
}

/**
 * AdminRoute component protects admin routes by verifying authentication
 * before rendering. Redirects to admin login if not authenticated.
 * 
 * Requirements: 1.3 - Admin authentication verification and access control
 */
export default function AdminRoute({ children }: AdminRouteProps) {
    const { isAuthenticated, isLoading } = useAdminAuth();
    const [, setLocation] = useLocation();

    useEffect(() => {
        // Only redirect if we're done loading and definitely not authenticated
        if (!isLoading && !isAuthenticated) {
            // Store the attempted URL for redirect after login
            const currentPath = window.location.pathname;
            if (currentPath !== '/admin/login') {
                sessionStorage.setItem('admin-redirect-after-login', currentPath);
            }

            // Redirect to admin login
            setLocation('/admin/login');
        }
    }, [isLoading, isAuthenticated, setLocation]);

    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
                    <p className="text-gray-300">Verifying admin access...</p>
                </div>
            </div>
        );
    }

    // Don't render children if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    // Render protected content
    return <>{children}</>;
}
