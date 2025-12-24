/**
 * MetricCard Component Usage Examples
 * 
 * This file demonstrates how to use the MetricCard component
 * with different metric types and configurations.
 */

import MetricCard from './MetricCard';
import { Users, DollarSign, CreditCard, Activity, TrendingUp, TrendingDown } from 'lucide-react';

export function MetricCardExamples() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
            {/* Example 1: Number type with positive trend */}
            <MetricCard
                title="Total Users"
                value={1234}
                type="number"
                trend={{ value: 12.5 }}
                subtitle="500 active users"
                icon={Users}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-50"
            />

            {/* Example 2: Currency type (IDR) with negative trend */}
            <MetricCard
                title="Monthly Revenue (MRR)"
                value={5000000}
                type="currency"
                currency="IDR"
                trend={{ value: -3.2 }}
                subtitle="Total: Rp 50,000,000"
                icon={DollarSign}
                iconColor="text-green-600"
                iconBgColor="bg-green-50"
            />

            {/* Example 3: Currency type (USD) with custom trend label */}
            <MetricCard
                title="Revenue (USD)"
                value={15000}
                type="currency"
                currency="USD"
                trend={{ value: 8.5, label: '8.5% growth' }}
                subtitle="Last 30 days"
                icon={DollarSign}
                iconColor="text-emerald-600"
                iconBgColor="bg-emerald-50"
            />

            {/* Example 4: Number type without trend */}
            <MetricCard
                title="Active Subscriptions"
                value={456}
                type="number"
                subtitle="15% conversion rate"
                icon={CreditCard}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-50"
            />

            {/* Example 5: Percentage type */}
            <MetricCard
                title="System Uptime"
                value={99.9}
                type="percentage"
                trend={{ value: 0.1 }}
                subtitle="Last 30 days"
                icon={Activity}
                iconColor="text-orange-600"
                iconBgColor="bg-orange-50"
            />

            {/* Example 6: String value (pre-formatted) */}
            <MetricCard
                title="API Response Time"
                value="45ms"
                subtitle="Average response time"
                icon={Activity}
                iconColor="text-cyan-600"
                iconBgColor="bg-cyan-50"
            />

            {/* Example 7: Large number with trend */}
            <MetricCard
                title="Total Transactions"
                value={1234567}
                type="number"
                trend={{ value: 25.3 }}
                subtitle="This month"
                icon={TrendingUp}
                iconColor="text-indigo-600"
                iconBgColor="bg-indigo-50"
            />

            {/* Example 8: Negative trend example */}
            <MetricCard
                title="Churn Rate"
                value={2.5}
                type="percentage"
                trend={{ value: -0.5, label: '0.5% decrease' }}
                subtitle="Lower is better"
                icon={TrendingDown}
                iconColor="text-red-600"
                iconBgColor="bg-red-50"
            />

            {/* Example 9: Currency EUR */}
            <MetricCard
                title="Revenue (EUR)"
                value={12500}
                type="currency"
                currency="EUR"
                trend={{ value: 15.8 }}
                icon={DollarSign}
                iconColor="text-green-600"
                iconBgColor="bg-green-50"
            />

            {/* Example 10: Zero trend */}
            <MetricCard
                title="Pending Reviews"
                value={0}
                type="number"
                trend={{ value: 0 }}
                subtitle="All caught up!"
                icon={Activity}
                iconColor="text-slate-600"
                iconBgColor="bg-slate-50"
            />
        </div>
    );
}

/**
 * Usage in Dashboard:
 * 
 * import MetricCard from '@/admin/components/MetricCard';
 * import { Users, DollarSign } from 'lucide-react';
 * 
 * function Dashboard() {
 *   return (
 *     <div className="grid grid-cols-4 gap-6">
 *       <MetricCard
 *         title="Total Users"
 *         value={metrics.users.total}
 *         type="number"
 *         trend={{ value: metrics.users.growthRate }}
 *         subtitle={`${metrics.users.active} active users`}
 *         icon={Users}
 *         iconColor="text-blue-600"
 *         iconBgColor="bg-blue-50"
 *       />
 *       
 *       <MetricCard
 *         title="Monthly Revenue"
 *         value={metrics.revenue.mrr}
 *         type="currency"
 *         currency="IDR"
 *         trend={{ value: metrics.revenue.revenueGrowth }}
 *         subtitle={`Total: ${formatCurrency(metrics.revenue.totalRevenue)}`}
 *         icon={DollarSign}
 *         iconColor="text-green-600"
 *         iconBgColor="bg-green-50"
 *       />
 *     </div>
 *   );
 * }
 */
