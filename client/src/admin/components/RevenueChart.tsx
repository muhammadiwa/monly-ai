import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

type TimePeriod = 'week' | 'month' | 'year';

interface RevenueChartData {
    labels: string[];
    data: number[];
}

interface RevenueChartResponse {
    success: boolean;
    data: RevenueChartData;
}

export interface RevenueChartProps {
    defaultPeriod?: TimePeriod;
    currency?: string;
}

export default function RevenueChart({
    defaultPeriod = 'month',
    currency = 'IDR'
}: RevenueChartProps) {
    const [period, setPeriod] = useState<TimePeriod>(defaultPeriod);

    // Fetch revenue chart data
    const { data, isLoading, error } = useQuery<RevenueChartResponse>({
        queryKey: ['/api/admin/dashboard/charts/revenue', period],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/dashboard/charts/revenue?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        staleTime: 60000, // Consider data stale after 1 minute
    });

    // Transform data for Recharts
    const chartData = data?.data ? data.data.labels.map((label, index) => ({
        date: formatLabel(label, period),
        revenue: data.data.data[index],
    })) : [];

    // Format label based on period
    function formatLabel(label: string, period: TimePeriod): string {
        if (period === 'year') {
            // Format YYYY-MM to "Jan 2024"
            const [year, month] = label.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else {
            // Format YYYY-MM-DD to "Jan 1" or "1 Jan"
            const date = new Date(label);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    // Format currency
    function formatCurrency(amount: number): string {
        if (currency === 'IDR') {
            // Format in millions for better readability
            if (amount >= 1000000) {
                return `Rp${(amount / 1000000).toFixed(1)}M`;
            }
            return `Rp${(amount / 1000).toFixed(0)}K`;
        }
        // For other currencies, format in thousands
        if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(1)}K`;
        }
        return `$${amount.toFixed(0)}`;
    }

    // Calculate total revenue
    const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);

    // Calculate growth rate (comparing first and last data points)
    const growthRate = chartData.length >= 2
        ? ((chartData[chartData.length - 1].revenue - chartData[0].revenue) / (chartData[0].revenue || 1)) * 100
        : 0;

    return (
        <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg font-semibold">Revenue Trend</CardTitle>
                </div>
                <Select value={period} onValueChange={(value) => setPeriod(value as TimePeriod)}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                        <SelectItem value="year">Last 12 Months</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-600">Loading chart data...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load revenue chart data. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                {!isLoading && !error && chartData.length > 0 && (
                    <>
                        {/* Summary Stats */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-slate-600">Total Revenue</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {currency === 'IDR'
                                        ? `Rp ${totalRevenue.toLocaleString('id-ID')}`
                                        : `$${totalRevenue.toLocaleString('en-US')}`
                                    }
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-600">Growth</p>
                                <p className={`text-lg font-semibold ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="h-64 sm:h-72 md:h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={chartData}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#6B7280' }}
                                        interval={period === 'year' ? 0 : 'preserveStartEnd'}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#6B7280' }}
                                        tickFormatter={formatCurrency}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'white',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            fontSize: '14px'
                                        }}
                                        formatter={(value: number) => {
                                            if (currency === 'IDR') {
                                                return [`Rp ${value.toLocaleString('id-ID')}`, 'Revenue'];
                                            }
                                            return [`$${value.toLocaleString('en-US')}`, 'Revenue'];
                                        }}
                                        labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#10B981"
                                        strokeWidth={2}
                                        fill="url(#revenueGradient)"
                                        animationDuration={500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}

                {!isLoading && !error && chartData.length === 0 && (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-600">No revenue data available</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Revenue data will appear here once payments are received
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
