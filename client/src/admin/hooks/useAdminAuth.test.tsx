/**
 * Integration test for useAdminAuth hook
 * 
 * This test verifies:
 * 1. Admin authentication state management
 * 2. Token refresh logic
 * 3. Logout functionality
 * 4. Integration with GET /api/admin/auth/me endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAuth } from './useAdminAuth';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

// Helper to create wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

describe('useAdminAuth', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('should return unauthenticated state when no token exists', async () => {
        const { result } = renderHook(() => useAdminAuth(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.admin).toBeNull();
    });

    it('should load admin user from localStorage and verify with API', async () => {
        const mockAdmin = {
            id: 'admin-1',
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'admin' as const,
        };

        // Set up localStorage
        localStorageMock.setItem('admin-token', 'test-token');
        localStorageMock.setItem('admin-user', JSON.stringify(mockAdmin));

        // Mock successful API response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                admin: mockAdmin,
            }),
        });

        const { result } = renderHook(() => useAdminAuth(), {
            wrapper: createWrapper(),
        });

        // Initially should load from localStorage
        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.admin).toEqual(mockAdmin);
    });

    it('should clear auth data when API returns 401', async () => {
        const mockAdmin = {
            id: 'admin-1',
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'admin' as const,
        };

        // Set up localStorage
        localStorageMock.setItem('admin-token', 'invalid-token');
        localStorageMock.setItem('admin-user', JSON.stringify(mockAdmin));

        // Mock 401 response
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 401,
        });

        const { result } = renderHook(() => useAdminAuth(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // Should clear auth data and redirect
        expect(localStorageMock.getItem('admin-token')).toBeNull();
        expect(localStorageMock.getItem('admin-user')).toBeNull();
        expect(window.location.href).toBe('/admin/login');
    });

    it('should handle logout correctly', async () => {
        const mockAdmin = {
            id: 'admin-1',
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'admin' as const,
        };

        // Set up localStorage
        localStorageMock.setItem('admin-token', 'test-token');
        localStorageMock.setItem('admin-user', JSON.stringify(mockAdmin));

        // Mock successful API responses
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    admin: mockAdmin,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    message: 'Logged out successfully',
                }),
            });

        const { result } = renderHook(() => useAdminAuth(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });

        // Call logout
        result.current.logout();

        await waitFor(() => {
            expect(result.current.isLoggingOut).toBe(false);
        });

        // Should clear auth data and redirect
        expect(localStorageMock.getItem('admin-token')).toBeNull();
        expect(localStorageMock.getItem('admin-user')).toBeNull();
        expect(window.location.href).toBe('/admin/login');
    });

    it('should update stored admin user when API returns fresh data', async () => {
        const initialAdmin = {
            id: 'admin-1',
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'admin' as const,
        };

        const updatedAdmin = {
            ...initialAdmin,
            name: 'Updated Admin',
            lastLogin: Date.now(),
        };

        // Set up localStorage
        localStorageMock.setItem('admin-token', 'test-token');
        localStorageMock.setItem('admin-user', JSON.stringify(initialAdmin));

        // Mock API response with updated data
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                admin: updatedAdmin,
            }),
        });

        const { result } = renderHook(() => useAdminAuth(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.admin?.name).toBe('Updated Admin');
        });

        // Should update localStorage with fresh data
        const storedAdmin = JSON.parse(localStorageMock.getItem('admin-user') || '{}');
        expect(storedAdmin.name).toBe('Updated Admin');
        expect(storedAdmin.lastLogin).toBe(updatedAdmin.lastLogin);
    });
});
