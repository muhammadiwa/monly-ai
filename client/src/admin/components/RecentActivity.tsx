import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, UserPlus, CreditCard, Package, Activity, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

type ActivityFilter = 'all' | 'users' | 'subscriptions' | 'payments';

interface ActivityDetail {
    type: 'user' | 'subscription' | 'payment';
    data: User | Subscription | Payment;
}

export default function RecentActivity({
    limit = 10,
    autoRefresh = false,
    refreshInterval = 30000,
}: RecentActivityProps) {
    const [filter, setFilter] = useState<ActivityFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [detailModal, setDetailModal] = useState<ActivityDetail | null>(null);
    const itemsPerPage = limit;
    const [, setLocation] = useLocation();

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

    // Sort by timestamp (most recent first)
    const sortedActivities = allActivities.sort((a, b) => b.timestamp - a.timestamp);

    // Apply filter
    const filteredActivities = filter === 'all'
        ? sortedActivities
        : sortedActivities.filter(activity => {
            if (filter === 'users') return activity.type === 'user';
            if (filter === 'subscriptions') return activity.type === 'subscription';
            if (filter === 'payments') return activity.type === 'payment';
            return true;
        });

    // Apply pagination
    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedActivities = filteredActivities.slice(startIndex, endIndex);

    // Check if there are no activities
    const hasNoActivity = paginatedActivities.length === 0;

    // Reset to page 1 when filter changes
    const handleFilterChange = (newFilter: ActivityFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    // Open detail modal
    const openDetailModal = (activity: ActivityDetail) => {
        setDetailModal(activity);
    };

    // Navigate to page
    const navigateTo = (path: string) => {
        setDetailModal(null); // Close modal first
        setLocation(path);
    };

    return (
        <>
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-slate-800">Recent Activity</CardTitle>
                        <Activity className="h-5 w-5 text-slate-400" />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <Filter className="h-4 w-4 text-slate-500" />
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterChange('all')}
                            className="h-8"
                        >
                            All ({sortedActivities.length})
                        </Button>
                        <Button
                            variant={filter === 'users' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterChange('users')}
                            className="h-8"
                        >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Users ({activityData.newUsers.length})
                        </Button>
                        <Button
                            variant={filter === 'subscriptions' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterChange('subscriptions')}
                            className="h-8"
                        >
                            <Package className="h-3 w-3 mr-1" />
                            Subscriptions ({activityData.newSubscriptions.length})
                        </Button>
                        <Button
                            variant={filter === 'payments' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleFilterChange('payments')}
                            className="h-8"
                        >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Payments ({activityData.recentPayments.length})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {hasNoActivity ? (
                        <div className="text-center py-12 text-slate-500">
                            <Activity className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">No activity found</p>
                            <p className="text-sm text-slate-400 mt-1">
                                {filter === 'all'
                                    ? 'Activity will appear here when users interact with the platform'
                                    : `No ${filter} activity found`
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-slate-100">
                                {paginatedActivities.map((activity, index) => {
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openDetailModal({ type: 'user', data: user })}
                                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 h-auto p-0"
                                                    >
                                                        View details →
                                                    </Button>
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openDetailModal({ type: 'subscription', data: subscription })}
                                                        className="text-xs font-medium text-purple-600 hover:text-purple-700 h-auto p-0"
                                                    >
                                                        View details →
                                                    </Button>
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openDetailModal({ type: 'payment', data: payment })}
                                                        className="text-xs font-medium text-green-600 hover:text-green-700 h-auto p-0"
                                                    >
                                                        View details →
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return null;
                                })}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                                    <div className="text-sm text-slate-600">
                                        Showing {startIndex + 1}-{Math.min(endIndex, filteredActivities.length)} of {filteredActivities.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="h-8"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-slate-600">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="h-8"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {detailModal?.type === 'user' && 'User Details'}
                            {detailModal?.type === 'subscription' && 'Subscription Details'}
                            {detailModal?.type === 'payment' && 'Payment Details'}
                        </DialogTitle>
                        <DialogDescription>
                            Detailed information about this activity
                        </DialogDescription>
                    </DialogHeader>

                    {detailModal?.type === 'user' && (
                        <div className="space-y-4">
                            {(() => {
                                const user = detailModal.data as User;
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">User ID</label>
                                                <p className="text-sm text-slate-900 mt-1 font-mono bg-slate-50 p-2 rounded">{user.id}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Name</label>
                                                <p className="text-sm text-slate-900 mt-1">{user.name}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Email</label>
                                                <p className="text-sm text-slate-900 mt-1">{user.email}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Registration Date</label>
                                                <p className="text-sm text-slate-900 mt-1">
                                                    {new Date(user.createdAt * 1000).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-4">
                                            <Button
                                                className="w-full"
                                                onClick={() => navigateTo(`/admin/users/${user.id}`)}
                                            >
                                                View Full Profile
                                            </Button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {detailModal?.type === 'subscription' && (
                        <div className="space-y-4">
                            {(() => {
                                const subscription = detailModal.data as Subscription;
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Subscription ID</label>
                                                <p className="text-sm text-slate-900 mt-1 font-mono bg-slate-50 p-2 rounded">{subscription.id}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Status</label>
                                                <div className="mt-1">
                                                    <Badge variant={getStatusVariant(subscription.status)}>
                                                        {subscription.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">User</label>
                                                <p className="text-sm text-slate-900 mt-1">{subscription.userName || subscription.userId}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Plan</label>
                                                <p className="text-sm text-slate-900 mt-1">{subscription.planName || `Plan ${subscription.planId}`}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Created Date</label>
                                                <p className="text-sm text-slate-900 mt-1">
                                                    {new Date(subscription.createdAt * 1000).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-4">
                                            <Button
                                                className="w-full"
                                                onClick={() => navigateTo(`/admin/subscriptions`)}
                                            >
                                                View Subscriptions
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => navigateTo(`/admin/users/${subscription.userId}`)}
                                            >
                                                View User
                                            </Button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {detailModal?.type === 'payment' && (
                        <div className="space-y-4">
                            {(() => {
                                const payment = detailModal.data as Payment;
                                return (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Payment ID</label>
                                                <p className="text-sm text-slate-900 mt-1 font-mono bg-slate-50 p-2 rounded">{payment.id}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Status</label>
                                                <div className="mt-1">
                                                    <Badge variant={getStatusVariant(payment.status)}>
                                                        {payment.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">User</label>
                                                <p className="text-sm text-slate-900 mt-1">{payment.userName || payment.userId}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Amount</label>
                                                <p className="text-lg font-bold text-green-600 mt-1">
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Currency</label>
                                                <p className="text-sm text-slate-900 mt-1">{payment.currency}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-600">Payment Date</label>
                                                <p className="text-sm text-slate-900 mt-1">
                                                    {new Date(payment.createdAt * 1000).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-4">
                                            <Button
                                                className="w-full"
                                                onClick={() => navigateTo(`/admin/payments`)}
                                            >
                                                View Payments
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => navigateTo(`/admin/users/${payment.userId}`)}
                                            >
                                                View User
                                            </Button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
