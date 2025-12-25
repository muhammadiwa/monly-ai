import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Loader2,
    Crown,
    Calendar,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
} from "lucide-react";

interface UsageStats {
    receiptOCR: { used: number; limit: number };
    aiChat: { used: number; limit: number };
    aiAnalysis: { used: number; limit: number };
}

interface UserSubscription {
    id: number | null;
    planName: string;
    planDisplayName: string;
    status: string;
    billingCycle: string | null;
    startDate: number | null;
    endDate: number | null;
    autoRenew: boolean;
    features: string[];
    limits: {
        transactions: number;
        budgets: number;
        goals: number;
        aiAnalysis: number;
        receiptOCR: number;
        aiChat: number;
        whatsappNotifications: boolean;
        exportData: boolean;
        advancedReports: boolean;
        prioritySupport: boolean;
    };
    usage?: UsageStats;
}

export default function SubscriptionDashboard() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    // Fetch current subscription
    const { data: subscriptionResponse, isLoading: subscriptionLoading } = useQuery({
        queryKey: ['/api/subscription/current'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/current');
            if (!response.ok) throw new Error('Failed to fetch subscription');
            return response.json();
        },
    });

    // Fetch usage stats
    const { data: usageResponse, isLoading: usageLoading } = useQuery({
        queryKey: ['/api/subscription/usage'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/usage');
            if (!response.ok) throw new Error('Failed to fetch usage');
            return response.json();
        },
    });

    // Cancel subscription mutation
    const cancelMutation = useMutation({
        mutationFn: async () => {
            const response = await apiRequest('POST', '/api/subscription/cancel', {
                reason: 'User requested cancellation',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to cancel subscription');
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Subscription Cancelled",
                description: "Your subscription has been cancelled. Access will continue until the end of your billing period.",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
            setCancelDialogOpen(false);
        },
        onError: (error: any) => {
            toast({
                title: "Cancellation Failed",
                description: error.message || "Failed to cancel subscription. Please try again.",
                variant: "destructive",
            });
        },
    });

    const subscription: UserSubscription | null = subscriptionResponse?.data || null;
    const usage: UsageStats | null = usageResponse?.data || subscription?.usage || null;

    const isLoading = subscriptionLoading || usageLoading;

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatLimit = (limit: number) => {
        if (limit === -1) return 'Unlimited';
        return limit.toLocaleString();
    };

    const getUsagePercentage = (used: number, limit: number) => {
        if (limit === -1) return 0;
        if (limit === 0) return 0;
        return Math.min(100, (used / limit) * 100);
    };

    const isNearLimit = (used: number, limit: number) => {
        if (limit === -1) return false;
        if (limit === 0) return false;
        return (used / limit) >= 0.8; // 80% threshold
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
                return (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                    </Badge>
                );
            case 'cancelled':
                return (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancelled
                    </Badge>
                );
            case 'expired':
                return (
                    <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Expired
                    </Badge>
                );
            case 'pending':
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Pending
                    </Badge>
                );
            case 'free':
                return (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                        Free Plan
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">
                        {status}
                    </Badge>
                );
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-gray-600">Loading subscription details...</p>
                </div>
            </div>
        );
    }

    if (!subscription) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-900">Error Loading Subscription</CardTitle>
                    <CardDescription className="text-red-700">
                        Unable to load your subscription details. Please try again later.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Plan Card */}
            <Card className="border-2">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                                <Crown className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">{subscription.planDisplayName}</CardTitle>
                                <CardDescription>Your current subscription plan</CardDescription>
                            </div>
                        </div>
                        {getStatusBadge(subscription.status)}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Plan Details */}
                    {subscription.id && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-600">Billing Cycle</p>
                                    <p className="font-semibold text-gray-900 capitalize">
                                        {subscription.billingCycle || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-600">Start Date</p>
                                    <p className="font-semibold text-gray-900">
                                        {formatDate(subscription.startDate)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-600">Next Billing Date</p>
                                    <p className="font-semibold text-gray-900">
                                        {formatDate(subscription.endDate)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Features */}
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Plan Features</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {subscription.features.map((feature, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    <span className="text-sm text-gray-700">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        {subscription.planName.toLowerCase() !== 'business' && (
                            <Button
                                onClick={() => window.location.href = '/pricing'}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                            >
                                <ArrowUpRight className="w-4 h-4 mr-2" />
                                Upgrade Plan
                            </Button>
                        )}
                        {subscription.id && subscription.status === 'active' && (
                            <Button
                                variant="outline"
                                onClick={() => setCancelDialogOpen(true)}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                                Cancel Subscription
                            </Button>
                        )}
                        {subscription.status === 'cancelled' && (
                            <Button
                                onClick={() => window.location.href = '/pricing'}
                                variant="outline"
                            >
                                Reactivate Subscription
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Usage Stats Card */}
            {usage && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <CardTitle>Usage Statistics</CardTitle>
                                <CardDescription>Your current monthly usage</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Receipt OCR Usage */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">Receipt OCR</span>
                                    {isNearLimit(usage.receiptOCR.used, usage.receiptOCR.limit) && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            Near Limit
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-sm text-gray-600">
                                    {usage.receiptOCR.used} / {formatLimit(usage.receiptOCR.limit)}
                                </span>
                            </div>
                            <Progress
                                value={getUsagePercentage(usage.receiptOCR.used, usage.receiptOCR.limit)}
                                className={`h-2 ${isNearLimit(usage.receiptOCR.used, usage.receiptOCR.limit) ? 'bg-amber-100' : ''}`}
                            />
                        </div>

                        {/* AI Chat Usage */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">AI Chat</span>
                                    {isNearLimit(usage.aiChat.used, usage.aiChat.limit) && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            Near Limit
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-sm text-gray-600">
                                    {usage.aiChat.used} / {formatLimit(usage.aiChat.limit)}
                                </span>
                            </div>
                            <Progress
                                value={getUsagePercentage(usage.aiChat.used, usage.aiChat.limit)}
                                className={`h-2 ${isNearLimit(usage.aiChat.used, usage.aiChat.limit) ? 'bg-amber-100' : ''}`}
                            />
                        </div>

                        {/* AI Analysis Usage */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">AI Analysis</span>
                                    {isNearLimit(usage.aiAnalysis.used, usage.aiAnalysis.limit) && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            Near Limit
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-sm text-gray-600">
                                    {usage.aiAnalysis.used} / {formatLimit(usage.aiAnalysis.limit)}
                                </span>
                            </div>
                            <Progress
                                value={getUsagePercentage(usage.aiAnalysis.used, usage.aiAnalysis.limit)}
                                className={`h-2 ${isNearLimit(usage.aiAnalysis.used, usage.aiAnalysis.limit) ? 'bg-amber-100' : ''}`}
                            />
                        </div>

                        {/* Upgrade Prompt if near limits */}
                        {(isNearLimit(usage.receiptOCR.used, usage.receiptOCR.limit) ||
                            isNearLimit(usage.aiChat.used, usage.aiChat.limit) ||
                            isNearLimit(usage.aiAnalysis.used, usage.aiAnalysis.limit)) && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-amber-900 mb-1">
                                                Approaching Usage Limit
                                            </h4>
                                            <p className="text-sm text-amber-700 mb-3">
                                                You're approaching your monthly usage limit for some features.
                                                Upgrade your plan to get higher limits and unlock more features.
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={() => window.location.href = '/pricing'}
                                                className="bg-amber-600 hover:bg-amber-700"
                                            >
                                                View Upgrade Options
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                    </CardContent>
                </Card>
            )}

            {/* Plan Limits Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle>Plan Limits</CardTitle>
                            <CardDescription>Your subscription limits</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Transactions</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.transactions)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Budgets</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.budgets)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Goals</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.goals)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">AI Analysis (monthly)</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.aiAnalysis)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Receipt OCR (monthly)</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.receiptOCR)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">AI Chat (monthly)</span>
                            <span className="font-semibold text-gray-900">
                                {formatLimit(subscription.limits.aiChat)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cancel Subscription Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel your subscription? You will continue to have access
                            to premium features until the end of your current billing period (
                            {formatDate(subscription.endDate)}). After that, your account will be downgraded to the Free plan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancelMutation.isPending}>
                            Keep Subscription
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => cancelMutation.mutate()}
                            disabled={cancelMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {cancelMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Cancelling...
                                </>
                            ) : (
                                'Yes, Cancel Subscription'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
