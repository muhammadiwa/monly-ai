import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

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
    return localStorage.getItem('admin-token');
};

const getStoredAdminUser = (): AdminUser | null => {
    try {
        const storedUser = localStorage.getItem('admin-user');
        return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
        console.error('Error parsing stored admin user:', error);
        return null;
    }
};

const clearAdminAuthData = () => {
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-user');
};

const redirectToAdminLogin = () => {
    window.location.href = '/admin/login';
};

export function useAdminAuth() {
    const queryClient = useQueryClient();
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [hasToken, setHasToken] = useState(false);

    // Check for admin token in localStorage on mount
    useEffect(() => {
        const checkAuth = () => {
            try {
                const adminToken = getAdminToken();
                const storedAdminUser = getStoredAdminUser();

                if (adminToken && storedAdminUser) {
                    setAdminUser(storedAdminUser);
                    setHasToken(true);
                } else {
                    setAdminUser(null);
                    setHasToken(false);
                }
            } catch (error) {
                console.error("Error checking admin auth:", error);
                setAdminUser(null);
                setHasToken(false);
            } finally {
                setIsLoadingAuth(false);
            }
        };

        checkAuth();
    }, []);

    // Fetch admin user from API to verify token is still valid
    const { data: apiAdmin, isLoading: isApiLoading, error } = useQuery<AdminAuthResponse>({
        queryKey: ["/api/admin/auth/me"],
        retry: false,
        enabled: hasToken, // Only run query if we have a token
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes to keep session alive
        queryFn: async () => {
            const adminToken = getAdminToken();
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/auth/me', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (res.status === 401 || res.status === 403) {
                // Token is invalid or expired
                clearAdminAuthData();
                throw new Error('Authentication failed');
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            // Update stored admin user with fresh data
            if (data.success && data.admin) {
                localStorage.setItem('admin-user', JSON.stringify(data.admin));
                setAdminUser(data.admin);
            }

            return data;
        }
    });

    // Handle auth errors
    useEffect(() => {
        if (error && hasToken) {
            console.error('Admin auth error:', error);
            clearAdminAuthData();
            setAdminUser(null);
            setHasToken(false);
            redirectToAdminLogin();
        }
    }, [error, hasToken]);

    // Logout mutation
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const adminToken = getAdminToken();
            if (!adminToken) {
                return;
            }

            const res = await fetch('/api/admin/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
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
            setAdminUser(null);
            setHasToken(false);

            // Clear all queries
            queryClient.clear();

            // Redirect to login
            redirectToAdminLogin();
        },
        onError: (error) => {
            console.error('Logout error:', error);
            // Even if logout fails on server, clear local data
            clearAdminAuthData();
            setAdminUser(null);
            setHasToken(false);
            queryClient.clear();
            redirectToAdminLogin();
        }
    });

    // Token refresh logic (implicit through refetchInterval in useQuery)
    // The query automatically refetches every 5 minutes, which keeps the session alive
    // and updates the admin user data

    // Use priority: apiAdmin > adminUser
    const admin = apiAdmin?.admin || adminUser;
    const isLoading = isLoadingAuth || (hasToken && isApiLoading);
    const isAuthenticated = !!(hasToken && admin);

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
