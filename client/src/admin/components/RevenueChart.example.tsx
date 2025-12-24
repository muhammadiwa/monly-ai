/**
 * RevenueChart Component Examples
 * 
 * This file demonstrates various usage patterns for the RevenueChart component.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RevenueChart from './RevenueChart';

const queryClient = new QueryClient();

// Example 1: Basic usage with default settings
export function BasicRevenueChart() {
    return (
        <QueryClientProvider client={queryClient}>
            <RevenueChart />
        </QueryClientProvider>
    );
}

// Example 2: With custom default period (week)
export function WeeklyRevenueChart() {
    return (
        <QueryClientProvider client={queryClient}>
            <RevenueChart defaultPeriod="week" />
        </QueryClientProvider>
    );
}

// Example 3: With custom default period (year)
export function YearlyRevenueChart() {
    return (
        <QueryClientProvider client={queryClient}>
            <RevenueChart defaultPeriod="year" />
        </QueryClientProvider>
    );
}

// Example 4: With USD currency
export function USDRevenueChart() {
    return (
        <QueryClientProvider client={queryClient}>
            <RevenueChart currency="USD" />
        </QueryClientProvider>
    );
}

// Example 5: In a dashboard layout
export function DashboardWithRevenueChart() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="space-y-6 p-6">
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>

                {/* Revenue Chart */}
                <RevenueChart defaultPeriod="month" currency="IDR" />

                {/* Other dashboard components would go here */}
            </div>
        </QueryClientProvider>
    );
}

// Example 6: Multiple charts with different periods
export function MultipleRevenueCharts() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                <RevenueChart defaultPeriod="week" currency="IDR" />
                <RevenueChart defaultPeriod="month" currency="IDR" />
            </div>
        </QueryClientProvider>
    );
}
