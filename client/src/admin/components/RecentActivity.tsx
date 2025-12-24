import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, UserPlus, CreditCard, Package, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";

interface User {
    id: string;
    name: string;
    email: string;
    createdAt: number;
}

interface Subscription {
    id: number;
    userId: string;
    planId: number;
    status: string;
    createdAt: number;
    userName?: string;
    planName?: string;
}

interface Payment {
    id: number;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: number;
    userName?: string;
}

interface RecentActivityData {
    newUsers: User[];
    newSubscriptions: Subscription[];
    recentPayments: Payment[];
}

interface RecentActivityResponse {
    success: boolean;
    data: RecentActivityData;
}

export interface RecentActivityProps {
    limit?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export default function RecentActivity({
    limit = 10,
    autoRefresh = false,
    refreshInterval = 30000,
}: RecentActivityProps) {
    // Fetch recent activity data
    const { data, isLoading, error } = useQuery<RecentActivityResponse>({
        queryKey: ["/api/admin/dashboard/recent-activity"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/dashboard/recent-activity', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        refetchInterval: autoRefresh ? refreshInterval : false,
        staleTime: autoRefresh ? refreshInterval - 5000 : Infinity,
    });

    // Format relative time
    const formatRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp * 1000; // Convert to milliseconds
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        return `${days} day${days > 1 ? 's' : ''} ago`;
    };

    // Format currency
    const formatCurrency = (amount: number, currency: string = 'IDR') => {
        if (currency === 'IDR') {
            return `Rp ${amount.toLocaleString('id-ID')}`;
        }
        if (currency === 'USD') {
            return `$${amount.toLocaleString('en-US')}`;
        }
        if (currency === 'EUR') {
            return `€${amount.toLocaleString('en-US')}`;
        }
        return `${currency} ${amount.toLocaleString('en-US')}`;
    };

    // Get status badge variant
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status.toLowerCase()) {
            case 'active':
            case 'paid':
            case 'success':
                return 'default';
            case 'pending':
                return 'secondary';
            case 'failed':
            case 'cancelled':
            case 'expired':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load recent activity. Please try again.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const activityData = data?.data;

    if (!activityData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center py-8 text-slate-500">
                        No activity data available
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Combine all activities and sort by timestamp
    const allActivities: Array<{
        type: 'user' | 'subscription' | 'payment';
        timestamp: number;
        data: User | Subscription | Payment;
    }> = [
            ...activityData.newUsers.map(user => ({
                type: 'user' as const,
                timestamp: user.createdAt,
                data: user,
            })),
            ...activityData.newSubscriptions.map(subscription => ({
                type: 'subscription' as const,
                timestamp: subscription.createdAt,
                data: subscription,
            })),
            ...activityData.recentPayments.map(payment => ({
                type: 'payment' as const,
                timestamp: payment.createdAt,
                data: payment,
            })),
        ];

    // Sort by timestamp (most recent first) and limit
    const sortedActivities = allActivities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

    // Check if there are no activities
    const hasNoActivity = sortedActivities.length === 0;

    return (
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800">Recent Activity</CardTitle>
                    <Activity className="h-5 w-5 text-slate-400" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {hasNoActivity ? (
                    <div className="text-center py-12 text-slate-500">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">No recent activity</p>
                        <p className="text-sm text-slate-400 mt-1">Activity will appear here when users interact with the platform</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {sortedActivities.map((activity, index) => {
                            if (activity.type === 'user') {
                                const user = activity.data as User;
                                return (
                                    <div
                                        key={`user-${user.id}-${index}`}
                                        className="group flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200"
                                    >
                                        <div className="relative">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 group-hover:shadow-xl group-hover:shadow-blue-500/40 transition-all duration-200">
                                                <UserPlus className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 mb-0.5">
                                                New user registration
                                            </p>
                                            <p className="text-sm text-slate-700 truncate font-medium">
                                                {user.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                {user.email}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-full">
                                                {formatRelativeTime(user.createdAt)}
                                            </span>
                                            <Link
                                                href={`/admin/users/${user.id}`}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                                            >
                                                View details →
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }

                            if (activity.type === 'subscription') {
                                const subscription = activity.data as Subscription;
                                return (
                                    <div
                                        key={`subscription-${subscription.id}-${index}`}
                                        className="group flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent transition-all duration-200"
                                    >
                                        <div className="relative">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30 group-hover:shadow-xl group-hover:shadow-purple-500/40 transition-all duration-200">
                                                <Package className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 mb-0.5">
                                                New subscription
                                            </p>
                                            <p className="text-sm text-slate-700 font-medium">
                                                {subscription.userName || `User ${subscription.userId}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {subscription.planName || `Plan ${subscription.planId}`}
                                                </span>
                                                <Badge variant={getStatusVariant(subscription.status)} className="text-xs font-medium">
                                                    {subscription.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-full">
                                                {formatRelativeTime(subscription.createdAt)}
                                            </span>
                                            <Link
                                                href={`/admin/subscriptions/${subscription.id}`}
                                                className="text-xs font-medium text-purple-600 hover:text-purple-700 hover:underline transition-colors"
                                            >
                                                View details →
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }

                            if (activity.type === 'payment') {
                                const payment = activity.data as Payment;
                                return (
                                    <div
                                        key={`payment-${payment.id}-${index}`}
                                        className="group flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-green-50/50 hover:to-transparent transition-all duration-200"
                                    >
                                        <div className="relative">
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30 group-hover:shadow-xl group-hover:shadow-green-500/40 transition-all duration-200">
                                                <CreditCard className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-900 mb-0.5">
                                                Payment received
                                            </p>
                                            <p className="text-sm text-slate-700 font-medium">
                                                {payment.userName || `User ${payment.userId}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </span>
                                                <Badge variant={getStatusVariant(payment.status)} className="text-xs font-medium">
                                                    {payment.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                            <span className="text-xs font-medium text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-full">
                                                {formatRelativeTime(payment.createdAt)}
                                            </span>
                                            <Link
                                                href={`/admin/payments/${payment.id}`}
                                                className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline transition-colors"
                                            >
                                                View details →
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }

                            return null;
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
