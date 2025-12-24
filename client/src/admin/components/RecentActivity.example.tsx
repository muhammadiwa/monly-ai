import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecentActivity from './RecentActivity';

// Create a query client for the examples
const queryClient = new QueryClient();

// Mock localStorage for examples
if (typeof window !== 'undefined') {
    localStorage.setItem('admin-token', 'example-token');
}

/**
 * Example 1: Basic Usage
 * 
 * Default configuration showing up to 10 recent activities
 */
export function BasicRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-6 max-w-4xl">
                <RecentActivity />
            </div>
        </QueryClientProvider>
    );
}

/**
 * Example 2: With Auto-Refresh
 * 
 * Automatically refreshes data every 30 seconds
 */
export function AutoRefreshRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-6 max-w-4xl">
                <RecentActivity
                    autoRefresh={true}
                    refreshInterval={30000}
                />
            </div>
        </QueryClientProvider>
    );
}

/**
 * Example 3: Limited Activities
 * 
 * Shows only the 5 most recent activities
 */
export function LimitedRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-6 max-w-4xl">
                <RecentActivity limit={5} />
            </div>
        </QueryClientProvider>
    );
}

/**
 * Example 4: Compact View
 * 
 * Shows only 3 activities with auto-refresh for a compact dashboard widget
 */
export function CompactRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-6 max-w-2xl">
                <RecentActivity
                    limit={3}
                    autoRefresh={true}
                    refreshInterval={60000}
                />
            </div>
        </QueryClientProvider>
    );
}

/**
 * Example 5: In Dashboard Layout
 * 
 * Shows how the component fits in a typical dashboard layout
 */
export function DashboardRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="p-6 bg-slate-50 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                        <p className="text-slate-500 mt-1">Monitor your platform activity</p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <p className="text-sm text-slate-600">Total Users</p>
                            <p className="text-3xl font-bold mt-2">1,234</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <p className="text-sm text-slate-600">Active Subscriptions</p>
                            <p className="text-3xl font-bold mt-2">567</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                            <p className="text-sm text-slate-600">Monthly Revenue</p>
                            <p className="text-3xl font-bold mt-2">Rp 12.5M</p>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <RecentActivity
                        limit={8}
                        autoRefresh={true}
                        refreshInterval={30000}
                    />
                </div>
            </div>
        </QueryClientProvider>
    );
}

/**
 * Example 6: Side Panel Widget
 * 
 * Compact version suitable for a sidebar or side panel
 */
export function SidePanelRecentActivity() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="w-80 p-4 bg-slate-50">
                <RecentActivity
                    limit={5}
                    autoRefresh={true}
                />
            </div>
        </QueryClientProvider>
    );
}

// Export all examples
export default {
    BasicRecentActivity,
    AutoRefreshRecentActivity,
    LimitedRecentActivity,
    CompactRecentActivity,
    DashboardRecentActivity,
    SidePanelRecentActivity,
};
