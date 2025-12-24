import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecentActivity from './RecentActivity';

// Mock wouter
vi.mock('wouter', () => ({
    Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
}));

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('RecentActivity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('admin-token', 'test-token');
    });

    it('renders loading state initially', () => {
        (global.fetch as any).mockImplementation(() => new Promise(() => { }));

        render(<RecentActivity />, { wrapper: createWrapper() });

        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument(); // Loader2 has role="status"
    });

    it('renders error state when fetch fails', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText(/Failed to load recent activity/i)).toBeInTheDocument();
        });
    });

    it('renders empty state when no activities', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    newUsers: [],
                    newSubscriptions: [],
                    recentPayments: [],
                },
            }),
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('No recent activity')).toBeInTheDocument();
        });
    });

    it('renders new user activities', async () => {
        const mockData = {
            success: true,
            data: {
                newUsers: [
                    {
                        id: 'user-1',
                        name: 'John Doe',
                        email: 'john@example.com',
                        createdAt: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
                    },
                ],
                newSubscriptions: [],
                recentPayments: [],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('New user registration')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('john@example.com')).toBeInTheDocument();
            expect(screen.getByText(/min ago/)).toBeInTheDocument();
        });
    });

    it('renders subscription activities', async () => {
        const mockData = {
            success: true,
            data: {
                newUsers: [],
                newSubscriptions: [
                    {
                        id: 1,
                        userId: 'user-1',
                        planId: 2,
                        status: 'active',
                        createdAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                        userName: 'Jane Smith',
                        planName: 'Premium',
                    },
                ],
                recentPayments: [],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('New subscription')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            expect(screen.getByText(/Plan: Premium/)).toBeInTheDocument();
            expect(screen.getByText('active')).toBeInTheDocument();
        });
    });

    it('renders payment activities', async () => {
        const mockData = {
            success: true,
            data: {
                newUsers: [],
                newSubscriptions: [],
                recentPayments: [
                    {
                        id: 1,
                        userId: 'user-1',
                        amount: 100000,
                        currency: 'IDR',
                        status: 'paid',
                        createdAt: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
                        userName: 'Bob Johnson',
                    },
                ],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Payment received')).toBeInTheDocument();
            expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
            expect(screen.getByText(/Rp 100,000/)).toBeInTheDocument();
            expect(screen.getByText('paid')).toBeInTheDocument();
        });
    });

    it('sorts activities by timestamp (most recent first)', async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockData = {
            success: true,
            data: {
                newUsers: [
                    {
                        id: 'user-1',
                        name: 'Old User',
                        email: 'old@example.com',
                        createdAt: now - 7200, // 2 hours ago
                    },
                ],
                newSubscriptions: [
                    {
                        id: 1,
                        userId: 'user-2',
                        planId: 2,
                        status: 'active',
                        createdAt: now - 300, // 5 minutes ago (most recent)
                        userName: 'Recent Subscriber',
                    },
                ],
                recentPayments: [
                    {
                        id: 1,
                        userId: 'user-3',
                        amount: 50000,
                        currency: 'IDR',
                        status: 'paid',
                        createdAt: now - 3600, // 1 hour ago
                        userName: 'Middle Payment',
                    },
                ],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            const activities = screen.getAllByText(/New|Payment/);
            // First should be the subscription (most recent)
            expect(activities[0]).toHaveTextContent('New subscription');
        });
    });

    it('respects the limit prop', async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockData = {
            success: true,
            data: {
                newUsers: Array.from({ length: 5 }, (_, i) => ({
                    id: `user-${i}`,
                    name: `User ${i}`,
                    email: `user${i}@example.com`,
                    createdAt: now - i * 60,
                })),
                newSubscriptions: [],
                recentPayments: [],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity limit={3} />, { wrapper: createWrapper() });

        await waitFor(() => {
            const activities = screen.getAllByText('New user registration');
            expect(activities).toHaveLength(3);
        });
    });

    it('includes links to detail pages', async () => {
        const mockData = {
            success: true,
            data: {
                newUsers: [
                    {
                        id: 'user-123',
                        name: 'Test User',
                        email: 'test@example.com',
                        createdAt: Math.floor(Date.now() / 1000),
                    },
                ],
                newSubscriptions: [],
                recentPayments: [],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            const link = screen.getByText('View details');
            expect(link).toHaveAttribute('href', '/admin/users/user-123');
        });
    });

    it('formats currency correctly for different currencies', async () => {
        const mockData = {
            success: true,
            data: {
                newUsers: [],
                newSubscriptions: [],
                recentPayments: [
                    {
                        id: 1,
                        userId: 'user-1',
                        amount: 100,
                        currency: 'USD',
                        status: 'paid',
                        createdAt: Math.floor(Date.now() / 1000),
                    },
                ],
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });

        render(<RecentActivity />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText(/\$100/)).toBeInTheDocument();
        });
    });
});
