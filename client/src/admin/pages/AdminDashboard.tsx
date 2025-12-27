import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CreditCard, Activity, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect } from "react";
import { RecentActivity, RevenueChart, UserGrowthChart } from "../components";

interface DashboardMetrics {
    users: {
        total: number;
        active: number;
        newThisMonth: number;
        growthRate: number;
    };
    subscriptions: {
        total: number;
        byPlan: {
            free: number;
            premium: number;
            business: number;
        };
        churnRate: number;
        conversionRate: number;
    };
    revenue: {
        mrr: number;
        totalRevenue: number;
        revenueGrowth: number;
        revenueByPlan: {
            premium: number;
            business: number;
        };
    };
    system: {
        databaseSize: number;
        apiResponseTime: number;
        errorRate: number;
        uptime: number;
    };
    recentActivity: {
        newUsers: Array<{
            id: string;
            name: string;
            email: string;
            createdAt: number;
        }>;
        newSubscriptions: Array<{
            id: number;
            userId: string;
            planId: number;
            status: string;
            createdAt: number;
        }>;
        recentPayments: Array<{
            id: number;
            userId: string;
            amount: number;
            currency: string;
            status: string;
            createdAt: number;
        }>;
    };
}

interface DashboardResponse {
    success: boolean;
    data: DashboardMetrics;
}

export default function AdminDashboard() {
    // Fetch dashboard metrics with auto-refresh every 30 seconds
    const { data, isLoading, error, refetch } = useQuery<DashboardResponse>({
        queryKey: ["/api/admin/dashboard/metrics"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/dashboard/metrics', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
        staleTime: 25000, // Consider data stale after 25 seconds
    });

    // Set up auto-refresh
    useEffect(() => {
        const interval = setInterval(() => {
            refetch();
        }, 30000);

        return () => clearInterval(interval);
    }, [refetch]);

    const metrics = data?.data;

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

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading dashboard metrics...</p>
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
                        Failed to load dashboard metrics. Please try again.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    if (!metrics) {
        return (
            <AdminLayout>
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        No dashboard data available.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    const metricCards = [
        {
            title: "Total Users",
            value: (metrics.users?.total ?? 0).toLocaleString(),
            change: formatPercentage(metrics.users?.growthRate ?? 0),
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            subtitle: `${metrics.users?.active ?? 0} active users`,
        },
        {
            title: "Monthly Revenue (MRR)",
            value: formatCurrency(metrics.revenue?.mrr ?? 0),
            change: formatPercentage(metrics.revenue?.revenueGrowth ?? 0),
            icon: DollarSign,
            color: "text-green-600",
            bgColor: "bg-green-50",
            subtitle: `Total: ${formatCurrency(metrics.revenue?.totalRevenue ?? 0)}`,
        },
        {
            title: "Active Subscriptions",
            value: (metrics.subscriptions?.total ?? 0).toLocaleString(),
            change: `${(metrics.subscriptions?.conversionRate ?? 0).toFixed(1)}% conversion`,
            icon: CreditCard,
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            subtitle: `${(metrics.subscriptions?.churnRate ?? 0).toFixed(1)}% churn rate`,
        },
        {
            title: "System Health",
            value: `${(metrics.system?.uptime ?? 0).toFixed(1)}%`,
            change: `${metrics.system?.apiResponseTime ?? 0}ms response`,
            icon: Activity,
            color: "text-orange-600",
            bgColor: "bg-orange-50",
            subtitle: `${(metrics.system?.errorRate ?? 0).toFixed(2)}% error rate`,
        },
    ];

    return (
        <AdminLayout>
            <div className="space-y-8">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">Welcome back! Here's what's happening today.</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-medium">Auto-refreshing every 30s</span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {metricCards.map((metric) => {
                        const Icon = metric.icon;
                        const isPositive = metric.change.startsWith('+');
                        const changeColor = isPositive ? 'text-green-600' : 'text-red-600';

                        return (
                            <Card
                                key={metric.title}
                                className="relative overflow-hidden border-slate-200 hover:shadow-xl hover:scale-105 transition-all duration-300 group"
                            >
                                {/* Gradient Background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                        {metric.title}
                                    </CardTitle>
                                    <div className={`p-3 rounded-xl ${metric.bgColor} shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                                        <Icon className={`h-5 w-5 ${metric.color}`} />
                                    </div>
                                </CardHeader>
                                <CardContent className="relative">
                                    <div className="text-3xl font-bold text-slate-900 mb-2">{metric.value}</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${changeColor} bg-opacity-10 px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                                            {metric.change}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">
                                        {metric.subtitle}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Subscription Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-slate-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-700">Free Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-3xl font-bold text-slate-900 mb-2">
                                {(metrics.subscriptions?.byPlan?.free ?? 0).toLocaleString()}
                            </div>
                            <p className="text-sm text-slate-500 font-medium">subscribers</p>
                        </CardContent>
                    </Card>
                    <Card className="border-purple-200 hover:shadow-lg hover:shadow-purple-100 transition-all duration-300 hover:scale-105">
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
                            <CardTitle className="text-sm font-semibold text-purple-700">Premium Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-3xl font-bold text-purple-900 mb-2">
                                {(metrics.subscriptions?.byPlan?.premium ?? 0).toLocaleString()}
                            </div>
                            <p className="text-sm text-slate-600 font-medium mt-1">
                                {formatCurrency(metrics.revenue?.revenueByPlan?.premium ?? 0)} revenue
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-200 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 hover:scale-105">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                            <CardTitle className="text-sm font-semibold text-blue-700">Business Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="text-3xl font-bold text-blue-900 mb-2">
                                {(metrics.subscriptions?.byPlan?.business ?? 0).toLocaleString()}
                            </div>
                            <p className="text-sm text-slate-600 font-medium mt-1">
                                {formatCurrency(metrics.revenue?.revenueByPlan?.business ?? 0)} revenue
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RevenueChart />
                    <UserGrowthChart />
                </div>

                {/* Recent Activity */}
                <RecentActivity limit={5} autoRefresh={true} refreshInterval={30000} />
            </div>
        </AdminLayout>
    );
}
