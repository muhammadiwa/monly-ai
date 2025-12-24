import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'wouter';
import SystemSettings from './SystemSettings';

// Mock the useToast hook
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: vi.fn(),
    }),
}));

// Mock AdminLayout
vi.mock('../layout/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SystemSettings - Feature Flags Tab', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        // Mock localStorage
        Storage.prototype.getItem = vi.fn(() => 'mock-admin-token');

        // Mock fetch for settings
        global.fetch = vi.fn((url) => {
            if (url === '/api/admin/settings') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: [
                            {
                                id: 1,
                                category: 'general',
                                key: 'app_name',
                                value: 'Monly',
                                dataType: 'string',
                                description: 'Application name',
                                updatedBy: null,
                                updatedAt: Date.now(),
                            },
                        ],
                    }),
                } as Response);
            }

            if (url === '/api/admin/settings/features') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: [
                            {
                                id: 1,
                                category: 'features',
                                key: 'ai_insights',
                                value: {
                                    enabled: true,
                                    plans: ['premium', 'business'],
                                },
                                dataType: 'json',
                                description: 'Enable AI-powered financial insights',
                                updatedBy: null,
                                updatedAt: Date.now(),
                            },
                            {
                                id: 2,
                                category: 'features',
                                key: 'api_access',
                                value: {
                                    enabled: false,
                                    plans: [],
                                },
                                dataType: 'json',
                                description: 'Enable API access',
                                updatedBy: null,
                                updatedAt: Date.now(),
                            },
                        ],
                    }),
                } as Response);
            }

            return Promise.reject(new Error('Unknown URL'));
        }) as any;
    });

    it('renders feature flags tab', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Check if Features tab exists
        expect(screen.getByText('Features')).toBeInTheDocument();
    });

    it('displays feature flags when tab is clicked', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('ai_insights')).toBeInTheDocument();
        });

        // Check if feature flag details are displayed
        expect(screen.getByText('Enable AI-powered financial insights')).toBeInTheDocument();
        expect(screen.getByText('api_access')).toBeInTheDocument();
        expect(screen.getByText('Enable API access')).toBeInTheDocument();
    });

    it('displays enabled badge for enabled features', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('ai_insights')).toBeInTheDocument();
        });

        // Check if enabled badge is displayed
        const enabledBadges = screen.getAllByText('Enabled');
        expect(enabledBadges.length).toBeGreaterThan(0);
    });

    it('displays disabled badge for disabled features', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('api_access')).toBeInTheDocument();
        });

        // Check if disabled badge is displayed
        expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('displays plan badges for features', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('ai_insights')).toBeInTheDocument();
        });

        // Check if plan badges are displayed
        expect(screen.getByText('premium')).toBeInTheDocument();
        expect(screen.getByText('business')).toBeInTheDocument();
    });

    it('displays "All Plans" badge when plans array is empty', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('api_access')).toBeInTheDocument();
        });

        // Check if "All Plans" badge is displayed for api_access (which has empty plans array)
        expect(screen.getByText('All Plans')).toBeInTheDocument();
    });

    it('displays toggle switches for each feature flag', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <SystemSettings />
                </BrowserRouter>
            </QueryClientProvider>
        );

        // Wait for the page to load
        await waitFor(() => {
            expect(screen.getByText('System Settings')).toBeInTheDocument();
        });

        // Click on Features tab
        const featuresTab = screen.getByText('Features');
        featuresTab.click();

        // Wait for feature flags to load
        await waitFor(() => {
            expect(screen.getByText('ai_insights')).toBeInTheDocument();
        });

        // Check if toggle switches are rendered (they have role="switch")
        const switches = screen.getAllByRole('switch');
        expect(switches.length).toBe(2); // We have 2 feature flags in mock data
    });
});
