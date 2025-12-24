import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminRoute from './AdminRoute';
import * as useAdminAuthModule from '@/admin/hooks/useAdminAuth';

// Mock the useAdminAuth hook
vi.mock('@/admin/hooks/useAdminAuth');

// Mock wouter's useLocation
const mockSetLocation = vi.fn();
vi.mock('wouter', () => ({
    useLocation: () => ['/admin/dashboard', mockSetLocation],
}));

describe('AdminRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('should show loading spinner when authentication is loading', () => {
        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: false,
            isLoading: true,
            admin: null,
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(screen.getByText('Verifying admin access...')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should render children when authenticated', () => {
        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            admin: {
                id: '1',
                email: 'admin@test.com',
                name: 'Test Admin',
                role: 'admin' as const,
            },
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not render children when not authenticated', () => {
        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', () => {
        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(mockSetLocation).toHaveBeenCalledWith('/admin/login');
    });

    it('should store current path in sessionStorage before redirecting', () => {
        // Mock window.location.pathname
        Object.defineProperty(window, 'location', {
            value: { pathname: '/admin/dashboard' },
            writable: true,
        });

        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(sessionStorage.getItem('admin-redirect-after-login')).toBe('/admin/dashboard');
    });

    it('should not store login path in sessionStorage', () => {
        // Mock window.location.pathname
        Object.defineProperty(window, 'location', {
            value: { pathname: '/admin/login' },
            writable: true,
        });

        vi.spyOn(useAdminAuthModule, 'useAdminAuth').mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            logout: vi.fn(),
            isLoggingOut: false,
        });

        render(
            <AdminRoute>
                <div>Protected Content</div>
            </AdminRoute>
        );

        expect(sessionStorage.getItem('admin-redirect-after-login')).toBeNull();
    });
});
