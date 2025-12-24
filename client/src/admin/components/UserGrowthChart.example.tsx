import UserGrowthChart from './UserGrowthChart';

/**
 * Example 1: Basic usage with default period (month)
 */
export function BasicUserGrowthChart() {
    return (
        <div className="p-6">
            <UserGrowthChart />
        </div>
    );
}

/**
 * Example 2: User growth chart with week period
 */
export function WeeklyUserGrowthChart() {
    return (
        <div className="p-6">
            <UserGrowthChart defaultPeriod="week" />
        </div>
    );
}

/**
 * Example 3: User growth chart with year period
 */
export function YearlyUserGrowthChart() {
    return (
        <div className="p-6">
            <UserGrowthChart defaultPeriod="year" />
        </div>
    );
}

/**
 * Example 4: Multiple charts in a grid layout
 */
export function DashboardWithUserGrowth() {
    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <UserGrowthChart defaultPeriod="month" />

                {/* Other charts would go here */}
                <div className="border rounded-lg p-6 bg-slate-50">
                    <p className="text-slate-600">Other chart placeholder</p>
                </div>
            </div>
        </div>
    );
}

/**
 * Example 5: Full-width user growth chart
 */
export function FullWidthUserGrowthChart() {
    return (
        <div className="p-6">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-xl font-semibold mb-4">User Growth Analysis</h2>
                <UserGrowthChart defaultPeriod="year" />
            </div>
        </div>
    );
}

/**
 * Example 6: User growth chart in a card layout
 */
export function CardLayoutUserGrowth() {
    return (
        <div className="p-6 bg-slate-100 min-h-screen">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold mb-2">User Analytics</h2>
                    <p className="text-slate-600 mb-6">
                        Track your user growth over time and identify trends
                    </p>
                    <UserGrowthChart defaultPeriod="month" />
                </div>
            </div>
        </div>
    );
}

/**
 * Example 7: Responsive dashboard layout
 */
export function ResponsiveDashboard() {
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-600 mt-1">Monitor your platform metrics</p>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <UserGrowthChart defaultPeriod="month" />
                    <UserGrowthChart defaultPeriod="week" />
                </div>
            </div>
        </div>
    );
}

export default {
    BasicUserGrowthChart,
    WeeklyUserGrowthChart,
    YearlyUserGrowthChart,
    DashboardWithUserGrowth,
    FullWidthUserGrowthChart,
    CardLayoutUserGrowth,
    ResponsiveDashboard,
};
