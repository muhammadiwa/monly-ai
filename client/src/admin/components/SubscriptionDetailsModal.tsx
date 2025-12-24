import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
    CreditCard,
    User,
    Calendar,
    DollarSign,
    FileText,
    AlertCircle,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    Package,
    ArrowUp,
    ArrowDown,
    CalendarPlus,
    Ban,
} from "lucide-react";

interface SubscriptionDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscriptionId: number | null;
}

interface SubscriptionPlan {
    id: number;
    name: string;
    displayName: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
}

type ActionType = 'extend' | 'upgrade' | 'downgrade' | 'cancel' | null;

interface SubscriptionDetails {
    id: number;
    user: {
        id: string;
        email: string;
        name: string;
        firstName: string;
        lastName: string;
    };
    plan: {
        id: number;
        name: string;
        displayName: string;
        description: string | null;
        priceMonthly: number;
        priceYearly: number;
        currency: string;
        features: string[];
        limits: {
            transactionLimit: number;
            accountLimit: number;
            budgetLimit: number;
            goalLimit: number;
            aiInsights: boolean;
            advancedReports: boolean;
            prioritySupport: boolean;
            apiAccess: boolean;
        };
    };
    status: 'active' | 'expired' | 'cancelled' | 'pending';
    billingCycle: 'monthly' | 'yearly';
    startDate: number;
    endDate: number;
    autoRenew: boolean;
    cancelledAt: number | null;
    cancellationReason: string | null;
    createdAt: number;
    updatedAt: number;
    renewalStatus: {
        status: string;
        nextBillingDate: number | null;
        daysUntilRenewal: number | null;
        willRenew: boolean;
    };
    paymentHistory: Array<{
        id: number;
        amount: number;
        currency: string;
        paymentMethod: string;
        status: string;
        midtransTransactionId: string | null;
        midtransOrderId: string | null;
        paidAt: number | null;
        createdAt: number;
    }>;
    invoices: Array<{
        id: number;
        invoiceNumber: string;
        amount: number;
        currency: string;
        status: string;
        issuedAt: number;
        dueAt: number;
        paidAt: number | null;
        items: any[];
    }>;
}

interface SubscriptionDetailsResponse {
    success: boolean;
    data: SubscriptionDetails;
}

export default function SubscriptionDetailsModal({
    open,
    onOpenChange,
    subscriptionId,
}: SubscriptionDetailsModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State for action dialogs
    const [actionType, setActionType] = useState<ActionType>(null);
    const [extendDays, setExtendDays] = useState<string>('30');
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [actionReason, setActionReason] = useState<string>('');

    // Fetch subscription details
    const { data, isLoading, error } = useQuery<SubscriptionDetailsResponse>({
        queryKey: ["/api/admin/subscriptions", subscriptionId],
        queryFn: async () => {
            if (!subscriptionId) {
                throw new Error('No subscription ID');
            }

            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        enabled: open && !!subscriptionId,
    });

    // Fetch available plans for upgrade/downgrade
    const { data: plansData } = useQuery<{ success: boolean; data: SubscriptionPlan[] }>({
        queryKey: ["/api/admin/plans"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/plans', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        enabled: open,
    });

    // Extend subscription mutation
    const extendMutation = useMutation({
        mutationFn: async ({ days, reason }: { days: number; reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/extend`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ days, reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to extend subscription');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Subscription extended successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
            setActionType(null);
            setExtendDays('30');
            setActionReason('');
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Upgrade subscription mutation
    const upgradeMutation = useMutation({
        mutationFn: async ({ planId, reason }: { planId: number; reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/upgrade`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ planId, reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to upgrade subscription');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Subscription upgraded successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
            setActionType(null);
            setSelectedPlanId('');
            setActionReason('');
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Downgrade subscription mutation
    const downgradeMutation = useMutation({
        mutationFn: async ({ planId, reason }: { planId: number; reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/downgrade`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ planId, reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to downgrade subscription');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Subscription downgraded successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
            setActionType(null);
            setSelectedPlanId('');
            setActionReason('');
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Cancel subscription mutation
    const cancelMutation = useMutation({
        mutationFn: async ({ reason }: { reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to cancel subscription');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Subscription cancelled successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions", subscriptionId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
            setActionType(null);
            setActionReason('');
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle action confirmation
    const handleActionConfirm = () => {
        if (!actionType) return;

        switch (actionType) {
            case 'extend':
                const days = parseInt(extendDays);
                if (isNaN(days) || days <= 0) {
                    toast({
                        title: "Error",
                        description: "Please enter a valid number of days",
                        variant: "destructive",
                    });
                    return;
                }
                extendMutation.mutate({ days, reason: actionReason });
                break;

            case 'upgrade':
                if (!selectedPlanId) {
                    toast({
                        title: "Error",
                        description: "Please select a plan",
                        variant: "destructive",
                    });
                    return;
                }
                upgradeMutation.mutate({ planId: parseInt(selectedPlanId), reason: actionReason });
                break;

            case 'downgrade':
                if (!selectedPlanId) {
                    toast({
                        title: "Error",
                        description: "Please select a plan",
                        variant: "destructive",
                    });
                    return;
                }
                downgradeMutation.mutate({ planId: parseInt(selectedPlanId), reason: actionReason });
                break;

            case 'cancel':
                if (!actionReason.trim()) {
                    toast({
                        title: "Error",
                        description: "Please provide a reason for cancellation",
                        variant: "destructive",
                    });
                    return;
                }
                cancelMutation.mutate({ reason: actionReason });
                break;
        }
    };

    // Handle action cancel
    const handleActionCancel = () => {
        setActionType(null);
        setExtendDays('30');
        setSelectedPlanId('');
        setActionReason('');
    };

    const subscription = data?.data;
    const plans = plansData?.data || [];

    // Filter plans for upgrade/downgrade
    const availablePlans = plans.filter(plan =>
        subscription && plan.id !== subscription.plan.id
    );

    // Format date
    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Format date with time
    const formatDateTime = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format currency
    const formatCurrency = (amount: number, currency: string = 'IDR') => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'expired':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'cancelled':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'paid':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'failed':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'sent':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'draft':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Get payment status icon
    const getPaymentStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return <Clock className="h-4 w-4 text-gray-600" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                        Subscription Details
                    </DialogTitle>
                    <DialogDescription>
                        View complete subscription information, payment history, and invoices
                    </DialogDescription>
                </DialogHeader>

                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-600">Loading subscription details...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load subscription details. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                {subscription && (
                    <div className="space-y-6">
                        {/* Action Buttons */}
                        {subscription.status === 'active' && (
                            <Card className="border-blue-200 bg-blue-50">
                                <CardContent className="pt-6">
                                    <div className="flex flex-wrap gap-3">
                                        <Button
                                            onClick={() => setActionType('extend')}
                                            variant="outline"
                                            className="bg-white hover:bg-blue-50"
                                        >
                                            <CalendarPlus className="h-4 w-4 mr-2" />
                                            Extend Subscription
                                        </Button>
                                        <Button
                                            onClick={() => setActionType('upgrade')}
                                            variant="outline"
                                            className="bg-white hover:bg-green-50"
                                        >
                                            <ArrowUp className="h-4 w-4 mr-2" />
                                            Upgrade Plan
                                        </Button>
                                        <Button
                                            onClick={() => setActionType('downgrade')}
                                            variant="outline"
                                            className="bg-white hover:bg-orange-50"
                                        >
                                            <ArrowDown className="h-4 w-4 mr-2" />
                                            Downgrade Plan
                                        </Button>
                                        <Button
                                            onClick={() => setActionType('cancel')}
                                            variant="outline"
                                            className="bg-white hover:bg-red-50 text-red-600 border-red-200"
                                        >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Cancel Subscription
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Subscription Overview */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    Subscription Overview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Left Column */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Subscription ID</label>
                                            <p className="text-base font-semibold text-slate-900">#{subscription.id}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Plan</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 font-medium">
                                                    {subscription.plan.displayName}
                                                </Badge>
                                                <span className="text-sm text-slate-600">
                                                    {formatCurrency(
                                                        subscription.billingCycle === 'monthly'
                                                            ? subscription.plan.priceMonthly
                                                            : subscription.plan.priceYearly,
                                                        subscription.plan.currency
                                                    )}
                                                    /{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Status</label>
                                            <div className="mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={`${getStatusBadgeColor(subscription.status)} font-medium capitalize`}
                                                >
                                                    {subscription.status}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Billing Cycle</label>
                                            <p className="text-base text-slate-900 capitalize">{subscription.billingCycle}</p>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Start Date</label>
                                            <p className="text-base text-slate-900">{formatDate(subscription.startDate)}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">End Date</label>
                                            <p className="text-base text-slate-900">{formatDate(subscription.endDate)}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Auto Renew</label>
                                            <div className="mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        subscription.autoRenew
                                                            ? 'bg-green-100 text-green-700 border-green-200'
                                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    }
                                                >
                                                    {subscription.autoRenew ? 'Enabled' : 'Disabled'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Renewal Status</label>
                                            <p className="text-base text-slate-900">{subscription.renewalStatus.status}</p>
                                            {subscription.renewalStatus.daysUntilRenewal !== null && (
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {subscription.renewalStatus.daysUntilRenewal} days remaining
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {subscription.cancelledAt && (
                                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-sm font-medium text-red-900">Cancellation Information</p>
                                        <p className="text-sm text-red-700 mt-1">
                                            Cancelled on: {formatDate(subscription.cancelledAt)}
                                        </p>
                                        {subscription.cancellationReason && (
                                            <p className="text-sm text-red-700 mt-1">
                                                Reason: {subscription.cancellationReason}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* User Information */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <User className="h-5 w-5 text-blue-600" />
                                    User Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Name</label>
                                        <p className="text-base text-slate-900">{subscription.user.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Email</label>
                                        <p className="text-base text-slate-900">{subscription.user.email}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">User ID</label>
                                        <p className="text-base text-slate-900 font-mono text-sm">{subscription.user.id}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment History */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                    Payment History
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {subscription.paymentHistory.length === 0 ? (
                                    <div className="text-center py-8">
                                        <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">No payment history</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                    <TableHead className="font-semibold text-slate-700">Payment ID</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Amount</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Method</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Paid At</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Created At</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {subscription.paymentHistory.map((payment) => (
                                                    <TableRow key={payment.id} className="hover:bg-slate-50">
                                                        <TableCell className="font-mono text-sm">#{payment.id}</TableCell>
                                                        <TableCell className="font-semibold">
                                                            {formatCurrency(payment.amount, payment.currency)}
                                                        </TableCell>
                                                        <TableCell className="capitalize">{payment.paymentMethod.replace('_', ' ')}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {getPaymentStatusIcon(payment.status)}
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`${getStatusBadgeColor(payment.status)} font-medium capitalize`}
                                                                >
                                                                    {payment.status}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{formatDateTime(payment.paidAt)}</TableCell>
                                                        <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Invoices */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    Invoices
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {subscription.invoices.length === 0 ? (
                                    <div className="text-center py-8">
                                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">No invoices</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                                    <TableHead className="font-semibold text-slate-700">Invoice Number</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Amount</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Issued At</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Due At</TableHead>
                                                    <TableHead className="font-semibold text-slate-700">Paid At</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {subscription.invoices.map((invoice) => (
                                                    <TableRow key={invoice.id} className="hover:bg-slate-50">
                                                        <TableCell className="font-mono text-sm font-semibold">
                                                            {invoice.invoiceNumber}
                                                        </TableCell>
                                                        <TableCell className="font-semibold">
                                                            {formatCurrency(invoice.amount, invoice.currency)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant="outline"
                                                                className={`${getStatusBadgeColor(invoice.status)} font-medium capitalize`}
                                                            >
                                                                {invoice.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                                                        <TableCell>{formatDate(invoice.dueAt)}</TableCell>
                                                        <TableCell>{formatDateTime(invoice.paidAt)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Timestamps */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-blue-600" />
                                    Timestamps
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Created At</label>
                                        <p className="text-base text-slate-900">{formatDateTime(subscription.createdAt)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Last Updated</label>
                                        <p className="text-base text-slate-900">{formatDateTime(subscription.updatedAt)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Extend Subscription Dialog */}
                <AlertDialog open={actionType === 'extend'} onOpenChange={(open) => !open && handleActionCancel()}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <CalendarPlus className="h-5 w-5 text-blue-600" />
                                Extend Subscription
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Add additional days to the subscription end date.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="extend-days">Number of Days</Label>
                                <Input
                                    id="extend-days"
                                    type="number"
                                    min="1"
                                    value={extendDays}
                                    onChange={(e) => setExtendDays(e.target.value)}
                                    placeholder="30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="extend-reason">Reason (Optional)</Label>
                                <Textarea
                                    id="extend-reason"
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    placeholder="Enter reason for extending subscription..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={handleActionCancel}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleActionConfirm}
                                disabled={extendMutation.isPending}
                            >
                                {extendMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Extending...
                                    </>
                                ) : (
                                    'Extend Subscription'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Upgrade Subscription Dialog */}
                <AlertDialog open={actionType === 'upgrade'} onOpenChange={(open) => !open && handleActionCancel()}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <ArrowUp className="h-5 w-5 text-green-600" />
                                Upgrade Subscription
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Upgrade the subscription to a higher plan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="upgrade-plan">Select Plan</Label>
                                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                    <SelectTrigger id="upgrade-plan">
                                        <SelectValue placeholder="Select a plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id.toString()}>
                                                {plan.displayName} - {formatCurrency(
                                                    subscription?.billingCycle === 'monthly'
                                                        ? plan.priceMonthly
                                                        : plan.priceYearly,
                                                    plan.currency
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="upgrade-reason">Reason (Optional)</Label>
                                <Textarea
                                    id="upgrade-reason"
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    placeholder="Enter reason for upgrading subscription..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={handleActionCancel}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleActionConfirm}
                                disabled={upgradeMutation.isPending}
                            >
                                {upgradeMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Upgrading...
                                    </>
                                ) : (
                                    'Upgrade Subscription'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Downgrade Subscription Dialog */}
                <AlertDialog open={actionType === 'downgrade'} onOpenChange={(open) => !open && handleActionCancel()}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <ArrowDown className="h-5 w-5 text-orange-600" />
                                Downgrade Subscription
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Downgrade the subscription to a lower plan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="downgrade-plan">Select Plan</Label>
                                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                    <SelectTrigger id="downgrade-plan">
                                        <SelectValue placeholder="Select a plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id.toString()}>
                                                {plan.displayName} - {formatCurrency(
                                                    subscription?.billingCycle === 'monthly'
                                                        ? plan.priceMonthly
                                                        : plan.priceYearly,
                                                    plan.currency
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="downgrade-reason">Reason (Optional)</Label>
                                <Textarea
                                    id="downgrade-reason"
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    placeholder="Enter reason for downgrading subscription..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={handleActionCancel}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleActionConfirm}
                                disabled={downgradeMutation.isPending}
                            >
                                {downgradeMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Downgrading...
                                    </>
                                ) : (
                                    'Downgrade Subscription'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Cancel Subscription Dialog */}
                <AlertDialog open={actionType === 'cancel'} onOpenChange={(open) => !open && handleActionCancel()}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Ban className="h-5 w-5 text-red-600" />
                                Cancel Subscription
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will cancel the subscription and prevent auto-renewal. The user will retain access until the end date.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    This action cannot be undone. The subscription will be cancelled immediately.
                                </AlertDescription>
                            </Alert>
                            <div className="space-y-2">
                                <Label htmlFor="cancel-reason">Reason (Required)</Label>
                                <Textarea
                                    id="cancel-reason"
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    placeholder="Enter reason for cancelling subscription..."
                                    rows={3}
                                    required
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={handleActionCancel}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleActionConfirm}
                                disabled={cancelMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {cancelMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Cancelling...
                                    </>
                                ) : (
                                    'Cancel Subscription'
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
