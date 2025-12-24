import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    CreditCard,
    Wallet,
    PieChart,
    Loader2,
    AlertCircle,
    Users,
    UserCheck,
    UserX,
    Percent,
    Download,
    CalendarIcon
} from "lucide-react";
import {
    BarChart,
    Bar,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend
} from "recharts";

type TimePeriod = 'week' | 'month' | 'year';

interface RevenueAnalytics {
    mrr: number;
    arr: number;
    totalRevenue: number;
    revenueGrowth: number;
    revenueByPlan: Record<string, number>;
    revenueByMethod: Record<string, number>;
}

interface RevenueAnalyticsResponse {
    success: boolean;
    data: RevenueAnalytics;
}

interface RevenueChartData {
    labels: string[];
    data: number[];
}

interface RevenueChartResponse {
    success: boolean;
    data: RevenueChartData;
}

interface SubscriptionAnalytics {
    total: number;
    active: number;
    cancelled: number;
    churnRate: number;
    conversionRate: number;
    byPlan: Record<string, number>;
}

interface SubscriptionAnalyticsResponse {
    success: boolean;
    data: SubscriptionAnalytics;
}

export default function RevenueAnalytics() {
    const [period, setPeriod] = useState<TimePeriod>('month');
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportType, setExportType] = useState<'revenue' | 'subscriptions' | 'users'>('revenue');
    const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
    const [isExporting, setIsExporting] = useState(false);

    // Fetch revenue analytics
    const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery<RevenueAnalyticsResponse>({
        queryKey: ['/api/admin/analytics/revenue'],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/analytics/revenue', {
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

    // Fetch revenue chart data
    const { data: chartData, isLoading: chartLoading, error: chartError } = useQuery<RevenueChartResponse>({
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
        staleTime: 60000,
    });

    // Fetch subscription analytics
    const { data: subscriptionData, isLoading: subscriptionLoading, error: subscriptionError } = useQuery<SubscriptionAnalyticsResponse>({
        queryKey: ['/api/admin/analytics/subscriptions'],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/analytics/subscriptions', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        staleTime: 60000,
    });

    const analytics = analyticsData?.data;
    const subscriptionAnalytics = subscriptionData?.data;
    const isLoading = analyticsLoading || chartLoading || subscriptionLoading;
    const error = analyticsError || chartError || subscriptionError;

    // Format currency
    const formatCurrency = (amount: number | undefined | null, currency: string = 'IDR') => {
        const safeAmount = amount ?? 0;
        if (currency === 'IDR') {
            return `Rp ${safeAmount.toLocaleString('id-ID')}`;
        }
        return `$${safeAmount.toLocaleString('en-US')}`;
    };

    // Format percentage
    const formatPercentage = (value: number | undefined | null) => {
        const safeValue = value ?? 0;
        const sign = safeValue >= 0 ? '+' : '';
        return `${sign}${safeValue.toFixed(1)}%`;
    };

    // Transform chart data for Recharts
    const revenueChartData = chartData?.data ? chartData.data.labels.map((label, index) => ({
        date: formatLabel(label, period),
        revenue: chartData.data.data[index],
    })) : [];

    // Format label based on period
    function formatLabel(label: string, period: TimePeriod): string {
        if (period === 'year') {
            const [year, month] = label.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else {
            const date = new Date(label);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    // Transform revenue by plan data for pie chart
    const revenueByPlanData = analytics?.revenueByPlan
        ? Object.entries(analytics.revenueByPlan).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
        }))
        : [];

    // Transform revenue by method data for bar chart
    const revenueByMethodData = analytics?.revenueByMethod
        ? Object.entries(analytics.revenueByMethod).map(([method, value]) => ({
            method: method.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            revenue: value,
        }))
        : [];

    // Colors for charts
    const PLAN_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];
    const METHOD_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'];

    // Handle export
    const handleExport = async () => {
        try {
            setIsExporting(true);

            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            // Build query parameters
            const params = new URLSearchParams({
                type: exportType,
                format: exportFormat,
            });

            if (dateFrom) {
                params.append('dateFrom', Math.floor(dateFrom.getTime() / 1000).toString());
            }

            if (dateTo) {
                params.append('dateTo', Math.floor(dateTo.getTime() / 1000).toString());
            }

            // Fetch export file
            const res = await fetch(`/api/admin/analytics/export?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            // Get filename from Content-Disposition header
            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = `${exportType}-export.${exportFormat === 'csv' ? 'csv' : 'pdf'}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Download file
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Close dialog
            setExportDialogOpen(false);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading revenue analytics...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load revenue analytics. Please try again.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    if (!analytics) {
        return (
            <AdminLayout>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        No revenue analytics data available.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white p-6 rounded-xl border border-green-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-900 to-green-700 bg-clip-text text-transparent">
                            Revenue Analytics
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Comprehensive revenue insights and financial metrics
                        </p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex items-center space-x-2">
                                    <Download className="h-4 w-4" />
                                    <span>Export Reports</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Export Analytics Report</DialogTitle>
                                    <DialogDescription>
                                        Choose the data type, format, and date range for your export.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Export Type */}
                                    <div className="space-y-2">
                                        <Label htmlFor="export-type">Data Type</Label>
                                        <Select value={exportType} onValueChange={(value: any) => setExportType(value)}>
                                            <SelectTrigger id="export-type">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="revenue">Revenue Data</SelectItem>
                                                <SelectItem value="subscriptions">Subscription Data</SelectItem>
                                                <SelectItem value="users">User Data</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Export Format */}
                                    <div className="space-y-2">
                                        <Label htmlFor="export-format">Format</Label>
                                        <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                                            <SelectTrigger id="export-format">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                                                <SelectItem value="excel">PDF (Document)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Date Range */}
                                    <div className="space-y-2">
                                        <Label>Date Range (Optional)</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Date From */}
                                            <div className="space-y-2">
                                                <Label htmlFor="date-from" className="text-xs text-slate-600">From</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            id="date-from"
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal",
                                                                !dateFrom && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={dateFrom}
                                                            onSelect={setDateFrom}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Date To */}
                                            <div className="space-y-2">
                                                <Label htmlFor="date-to" className="text-xs text-slate-600">To</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            id="date-to"
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start text-left font-normal",
                                                                !dateTo && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={dateTo}
                                                            onSelect={setDateTo}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                        {dateFrom && dateTo && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setDateFrom(undefined);
                                                    setDateTo(undefined);
                                                }}
                                                className="text-xs"
                                            >
                                                Clear dates
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setExportDialogOpen(false)}
                                        disabled={isExporting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleExport} disabled={isExporting}>
                                        {isExporting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Export
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <DollarSign className="h-12 w-12 text-green-600" />
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* MRR Card */}
                    <Card className="border-green-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-green-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                Monthly Recurring Revenue
                            </CardTitle>
                            <div className="p-3 rounded-xl bg-green-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-slate-900 mb-2">
                                {formatCurrency(analytics.mrr)}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Recurring monthly income
                            </p>
                        </CardContent>
                    </Card>

                    {/* ARR Card */}
                    <Card className="border-blue-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                Annual Recurring Revenue
                            </CardTitle>
                            <div className="p-3 rounded-xl bg-blue-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-slate-900 mb-2">
                                {formatCurrency(analytics.arr)}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Projected annual income
                            </p>
                        </CardContent>
                    </Card>

                    {/* Total Revenue Card */}
                    <Card className="border-purple-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                Total Revenue
                            </CardTitle>
                            <div className="p-3 rounded-xl bg-purple-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                <Wallet className="h-5 w-5 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="text-3xl font-bold text-slate-900 mb-2">
                                {formatCurrency(analytics.totalRevenue)}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                All-time revenue
                            </p>
                        </CardContent>
                    </Card>

                    {/* Revenue Growth Card */}
                    <Card className={`border-${analytics.revenueGrowth >= 0 ? 'green' : 'red'}-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group`}>
                        <div className={`absolute inset-0 bg-gradient-to-br from-white via-white to-${analytics.revenueGrowth >= 0 ? 'green' : 'red'}-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                Revenue Growth
                            </CardTitle>
                            <div className={`p-3 rounded-xl bg-${analytics.revenueGrowth >= 0 ? 'green' : 'red'}-50 shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                                {analytics.revenueGrowth >= 0 ? (
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : (
                                    <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className={`text-3xl font-bold ${analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'} mb-2`}>
                                {formatPercentage(analytics.revenueGrowth)}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Last 30 days vs previous 30 days
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Revenue Trend Chart */}
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
                        {revenueChartData.length > 0 ? (
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={revenueChartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 12, fill: '#6B7280' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12, fill: '#6B7280' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => {
                                                if (value >= 1000000) {
                                                    return `${(value / 1000000).toFixed(1)}M`;
                                                }
                                                return `${(value / 1000).toFixed(0)}K`;
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            }}
                                            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                        />
                                        <Bar dataKey="revenue" fill="#10B981" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-80">
                                <div className="text-center">
                                    <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-600">No revenue data available</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue Breakdown Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue by Plan */}
                    <Card className="hover:shadow-lg transition-shadow duration-200">
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <PieChart className="h-5 w-5 text-purple-600" />
                                <CardTitle className="text-lg font-semibold">Revenue by Plan</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {revenueByPlanData.length > 0 ? (
                                <>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPieChart>
                                                <Pie
                                                    data={revenueByPlanData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {revenueByPlanData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                            </RechartsPieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {revenueByPlanData.map((item, index) => (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {formatCurrency(item.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-64">
                                    <div className="text-center">
                                        <PieChart className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-600">No plan revenue data</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Revenue by Payment Method */}
                    <Card className="hover:shadow-lg transition-shadow duration-200">
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                <CardTitle className="text-lg font-semibold">Revenue by Payment Method</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {revenueByMethodData.length > 0 ? (
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={revenueByMethodData}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="method"
                                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(value) => {
                                                    if (value >= 1000000) {
                                                        return `${(value / 1000000).toFixed(1)}M`;
                                                    }
                                                    return `${(value / 1000).toFixed(0)}K`;
                                                }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                                }}
                                                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                            />
                                            <Bar dataKey="revenue" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-80">
                                    <div className="text-center">
                                        <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-600">No payment method data</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Subscription Analytics Section */}
                {subscriptionAnalytics && (
                    <>
                        {/* Section Header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl border border-blue-200 shadow-sm mt-8">
                            <div>
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
                                    Subscription Analytics
                                </h2>
                                <p className="text-slate-600 mt-2 font-medium">
                                    Subscription metrics and performance indicators
                                </p>
                            </div>
                            <Users className="h-10 w-10 text-blue-600" />
                        </div>

                        {/* Subscription Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {/* Total Subscriptions */}
                            <Card className="border-blue-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Total Subscriptions
                                    </CardTitle>
                                    <div className="p-3 rounded-xl bg-blue-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                        <Users className="h-5 w-5 text-blue-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">
                                        {subscriptionAnalytics.total.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        All-time subscriptions
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Active Subscriptions */}
                            <Card className="border-green-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-green-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Active Subscriptions
                                    </CardTitle>
                                    <div className="p-3 rounded-xl bg-green-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                        <UserCheck className="h-5 w-5 text-green-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">
                                        {subscriptionAnalytics.active.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Currently active
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Cancelled Subscriptions */}
                            <Card className="border-red-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-red-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Cancelled
                                    </CardTitle>
                                    <div className="p-3 rounded-xl bg-red-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                        <UserX className="h-5 w-5 text-red-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">
                                        {subscriptionAnalytics.cancelled.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Total cancelled
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Churn Rate */}
                            <Card className="border-orange-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Churn Rate
                                    </CardTitle>
                                    <div className="p-3 rounded-xl bg-orange-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                        <TrendingDown className="h-5 w-5 text-orange-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">
                                        {subscriptionAnalytics.churnRate.toFixed(1)}%
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Last 30 days
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Conversion Rate */}
                            <Card className="border-purple-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Conversion Rate
                                    </CardTitle>
                                    <div className="p-3 rounded-xl bg-purple-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                        <Percent className="h-5 w-5 text-purple-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">
                                        {subscriptionAnalytics.conversionRate.toFixed(1)}%
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Free to paid
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Subscriptions by Plan Chart */}
                        <Card className="hover:shadow-lg transition-shadow duration-200">
                            <CardHeader>
                                <div className="flex items-center space-x-2">
                                    <PieChart className="h-5 w-5 text-blue-600" />
                                    <CardTitle className="text-lg font-semibold">Active Subscriptions by Plan</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {Object.keys(subscriptionAnalytics.byPlan).length > 0 ? (
                                    <>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsPieChart>
                                                    <Pie
                                                        data={Object.entries(subscriptionAnalytics.byPlan).map(([name, value]) => ({
                                                            name: name.charAt(0).toUpperCase() + name.slice(1),
                                                            value,
                                                        }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                        outerRadius={80}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {Object.entries(subscriptionAnalytics.byPlan).map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </RechartsPieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            {Object.entries(subscriptionAnalytics.byPlan).map(([name, value], index) => (
                                                <div key={name} className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
                                                        />
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {name.charAt(0).toUpperCase() + name.slice(1)}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-900">
                                                        {value.toLocaleString()} subscriptions
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-center">
                                            <PieChart className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-600">No subscription data available</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
