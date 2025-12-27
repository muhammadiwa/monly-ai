import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'support';
    lastLogin?: number;
}

interface AdminAuthResponse {
    success: boolean;
    admin: AdminUser;
}

// Helper functions for admin auth
const getAdminToken = (): string | null => {
    // Check both localStorage (remember me) and sessionStorage (session only)
    return localStorage.getItem('admin-token') || sessionStorage.getItem('admin-token');
};

const getStoredAdminUser = (): AdminUser | null => {
    try {
        // Check both localStorage and sessionStorage
        const storedUser = localStorage.getItem('admin-user') || sessionStorage.getItem('admin-user');
        return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
        console.error('Error parsing stored admin user:', error);
        return null;
    }
};

const clearAdminAuthData = () => {
    // Clear from both storages
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-user');
    sessionStorage.removeItem('admin-token');
    sessionStorage.removeItem('admin-user');
};

const redirectToAdminLogin = () => {
    window.location.href = '/admin/login';
};

export function useAdminAuth() {
    const queryClient = useQueryClient();

    // Get initial token state synchronously
    const adminToken = getAdminToken();
    const storedAdminUser = getStoredAdminUser();
    const hasToken = !!adminToken;



    // Fetch admin user from API to verify token is still valid
    const { data: apiAdmin, isLoading: isApiLoading, error, isError } = useQuery<AdminAuthResponse>({
        queryKey: ["/api/admin/auth/me"],
        retry: false,
        enabled: hasToken, // Only run query if we have a token
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes to keep session alive
        staleTime: 4 * 60 * 1000, // Consider data fresh for 4 minutes
        queryFn: async () => {
            const token = getAdminToken();
            if (!token) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log('[useAdminAuth] API response status:', res.status);

            if (res.status === 401 || res.status === 403) {
                // Token is invalid or expired
                clearAdminAuthData();
                throw new Error('Authentication failed');
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            console.log('[useAdminAuth] API response data:', data);

            // Update stored admin user with fresh data in the same storage that has the token
            if (data.success && data.admin) {
                if (localStorage.getItem('admin-token')) {
                    localStorage.setItem('admin-user', JSON.stringify(data.admin));
                } else if (sessionStorage.getItem('admin-token')) {
                    sessionStorage.setItem('admin-user', JSON.stringify(data.admin));
                }
            }

            return data;
        }
    });

    // Handle auth errors - clear data and don't redirect (let AdminRoute handle it)
    useEffect(() => {
        if (isError && hasToken) {
            clearAdminAuthData();
        }
    }, [isError, error, hasToken]);

    // Logout mutation
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const token = getAdminToken();
            if (!token) {
                return;
            }

            const res = await fetch('/api/admin/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                throw new Error('Logout failed');
            }

            return res.json();
        },
        onSuccess: () => {
            // Clear auth data
            clearAdminAuthData();

            // Clear all queries
            queryClient.clear();

            // Redirect to login
            redirectToAdminLogin();
        },
        onError: () => {
            // Even if logout fails on server, clear local data
            clearAdminAuthData();
            queryClient.clear();
            redirectToAdminLogin();
        }
    });

    // Determine current admin user
    const admin = apiAdmin?.admin || storedAdminUser;

    // Loading state logic:
    // - If no token: not loading (will redirect to login)
    // - If has token and API is loading: loading (checking token validity)
    // - If has token and API done: not loading
    const isLoading = hasToken && isApiLoading;

    // Authenticated if we have token and admin data (either from API or localStorage)
    // If API returned error, we're not authenticated
    const isAuthenticated = hasToken && !!admin && !isError;

    const logout = () => {
        logoutMutation.mutate();
    };

    return {
        admin,
        isLoading,
        isAuthenticated,
        logout,
        isLoggingOut: logoutMutation.isPending,
    };
}
