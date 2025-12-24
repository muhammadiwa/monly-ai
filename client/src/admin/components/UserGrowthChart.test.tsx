import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserGrowthChart from './UserGrowthChart';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-admin-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('UserGrowthChart', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        mockFetch.mockClear();
        mockLocalStorage.getItem.mockReturnValue('mock-admin-token');
    });

    const renderWithQueryClient = (component: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>
        );
    };

    it('renders loading state initially', () => {
        mockFetch.mockImplementation(() => new Promise(() => { })); // Never resolves

        renderWithQueryClient(<UserGrowthChart />);

        expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
    });

    it('renders chart with user growth data', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01', '2024-01-02', '2024-01-03'],
                data: [100, 150, 200],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('User Growth')).toBeInTheDocument();
            expect(screen.getByText('Total Users')).toBeInTheDocument();
        });
    });

    it('renders error state when fetch fails', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load user growth chart data. Please try again.')).toBeInTheDocument();
        });
    });

    it('renders empty state when no data available', async () => {
        const mockData = {
            success: true,
            data: {
                labels: [],
                data: [],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('No user data available')).toBeInTheDocument();
            expect(screen.getByText('User growth data will appear here once users register')).toBeInTheDocument();
        });
    });

    it('uses default period of month', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01'],
                data: [100],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('period=month'),
                expect.any(Object)
            );
        });
    });

    it('uses custom default period', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01'],
                data: [100],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart defaultPeriod="week" />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('period=week'),
                expect.any(Object)
            );
        });
    });

    it('includes authorization header in request', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01'],
                data: [100],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-admin-token',
                    }),
                })
            );
        });
    });

    it('calculates growth rate correctly', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01', '2024-01-02', '2024-01-03'],
                data: [100, 150, 200], // 100% growth from first to last
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('Growth')).toBeInTheDocument();
            expect(screen.getByText('+100.0%')).toBeInTheDocument();
        });
    });

    it('displays new users count', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01', '2024-01-02', '2024-01-03'],
                data: [100, 150, 200], // +100 new users
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('+100 users')).toBeInTheDocument();
        });
    });

    it('formats user count correctly', async () => {
        const mockData = {
            success: true,
            data: {
                labels: ['2024-01-01'],
                data: [1500],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        renderWithQueryClient(<UserGrowthChart />);

        await waitFor(() => {
            expect(screen.getByText('1,500')).toBeInTheDocument();
        });
    });
});
