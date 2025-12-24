import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Webhook,
    Receipt,
    Download,
    FileCheck,
    RefreshCcw,
} from "lucide-react";

interface PaymentDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paymentId: number | null;
}

export type { PaymentDetailsModalProps };

interface PaymentDetails {
    id: number;
    userId: string;
    subscriptionId: number | null;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    midtransTransactionId: string | null;
    midtransOrderId: string | null;
    paidAt: number | null;
    createdAt: number;
    updatedAt: number;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        fullName: string;
        profileImageUrl: string | null;
    };
    subscription: {
        id: number;
        planId: number;
        status: string;
        billingCycle: string;
        startDate: number;
        endDate: number;
        autoRenew: boolean;
        plan: {
            name: string;
            displayName: string;
            description: string | null;
            priceMonthly: number;
            priceYearly: number;
        };
    } | null;
    invoice: {
        id: number;
        invoiceNumber: string;
        amount: number;
        currency: string;
        items: any[];
        status: string;
        issuedAt: number;
        dueAt: number;
        paidAt: number | null;
        createdAt: number;
        updatedAt: number;
    } | null;
    webhookLogs: Array<{
        id: number;
        orderId: string;
        transactionId: string | null;
        eventType: string;
        payload: any;
        signature: string | null;
        status: string;
        errorMessage: string | null;
        createdAt: number;
    }>;
}

interface PaymentDetailsResponse {
    success: boolean;
    data: PaymentDetails;
}

export default function PaymentDetailsModal({
    open,
    onOpenChange,
    paymentId,
}: PaymentDetailsModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [showRefundDialog, setShowRefundDialog] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [refundAmount, setRefundAmount] = useState("");

    // Fetch payment details
    const { data, isLoading, error } = useQuery<PaymentDetailsResponse>({
        queryKey: ["/api/admin/payments", paymentId],
        queryFn: async () => {
            if (!paymentId) {
                throw new Error('No payment ID');
            }

            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        enabled: open && !!paymentId,
    });

    const payment = data?.data;

    // Generate invoice mutation
    const generateInvoiceMutation = useMutation({
        mutationFn: async (paymentId: number) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch('/api/admin/invoices/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paymentId }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Invoice Generated",
                description: `Invoice ${data.data.invoice.invoiceNumber} has been generated successfully.`,
            });

            // Refresh payment details to show the new invoice
            queryClient.invalidateQueries({ queryKey: ["/api/admin/payments", paymentId] });

            // Download PDF
            if (data.data.pdf) {
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${data.data.pdf}`;
                link.download = `${data.data.invoice.invoiceNumber}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            setIsGeneratingInvoice(false);
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to generate invoice. Please try again.",
                variant: "destructive",
            });
            setIsGeneratingInvoice(false);
        },
    });

    // Handle generate invoice
    const handleGenerateInvoice = () => {
        if (!paymentId) return;
        setIsGeneratingInvoice(true);
        generateInvoiceMutation.mutate(paymentId);
    };

    // Refund payment mutation
    const refundPaymentMutation = useMutation({
        mutationFn: async ({ paymentId, reason, amount }: { paymentId: number; reason: string; amount?: number }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason, amount }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || `HTTP ${res.status}`);
            }

            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Payment Refunded",
                description: `Payment has been refunded successfully.`,
            });

            // Refresh payment details
            queryClient.invalidateQueries({ queryKey: ["/api/admin/payments", paymentId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });

            // Close dialog and reset form
            setShowRefundDialog(false);
            setRefundReason("");
            setRefundAmount("");
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to refund payment. Please try again.",
                variant: "destructive",
            });
        },
    });

    // Handle refund payment
    const handleRefundPayment = () => {
        if (!paymentId || !refundReason.trim()) {
            toast({
                title: "Error",
                description: "Please provide a reason for the refund.",
                variant: "destructive",
            });
            return;
        }

        const amount = refundAmount ? parseFloat(refundAmount) : undefined;
        refundPaymentMutation.mutate({ paymentId, reason: refundReason, amount });
    };

    // Open refund dialog
    const handleOpenRefundDialog = () => {
        if (payment) {
            setRefundAmount(payment.amount.toString());
        }
        setShowRefundDialog(true);
    };

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
        const currencyMap: Record<string, { locale: string; currency: string }> = {
            'IDR': { locale: 'id-ID', currency: 'IDR' },
            'USD': { locale: 'en-US', currency: 'USD' },
            'EUR': { locale: 'en-EU', currency: 'EUR' },
        };

        const config = currencyMap[currency] || { locale: 'en-US', currency: 'USD' };

        return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: config.currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'failed':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'refunded':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'sent':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'draft':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'processed':
                return 'bg-green-100 text-green-700 border-green-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Get payment method badge color
    const getPaymentMethodBadgeColor = (method: string) => {
        switch (method) {
            case 'credit_card':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'bank_transfer':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'e_wallet':
                return 'bg-pink-100 text-pink-700 border-pink-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Format payment method display name
    const formatPaymentMethod = (method: string) => {
        const methodMap: Record<string, string> = {
            'credit_card': 'Credit Card',
            'bank_transfer': 'Bank Transfer',
            'e_wallet': 'E-Wallet',
        };
        return methodMap[method] || method;
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
            case 'refunded':
                return <DollarSign className="h-4 w-4 text-orange-600" />;
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
                        Payment Details
                    </DialogTitle>
                    <DialogDescription>
                        View complete payment information, Midtrans transaction details, invoice, and webhook logs
                    </DialogDescription>
                </DialogHeader>

                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-600">Loading payment details...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load payment details. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                {payment && (
                    <div className="space-y-6">
                        {/* Payment Overview */}
                        <Card className="border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                    Payment Overview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Left Column */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Payment ID</label>
                                            <p className="text-base font-semibold text-slate-900">#{payment.id}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Amount</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-2xl font-bold text-slate-900">
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </p>
                                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                                    {payment.currency}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Payment Method</label>
                                            <div className="mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={`${getPaymentMethodBadgeColor(payment.paymentMethod)} font-medium`}
                                                >
                                                    {formatPaymentMethod(payment.paymentMethod)}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Status</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getPaymentStatusIcon(payment.status)}
                                                <Badge
                                                    variant="outline"
                                                    className={`${getStatusBadgeColor(payment.status)} font-medium capitalize`}
                                                >
                                                    {payment.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Created At</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                <p className="text-base text-slate-900">{formatDateTime(payment.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Paid At</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                <p className="text-base text-slate-900">{formatDateTime(payment.paidAt)}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Midtrans Transaction ID</label>
                                            <p className="text-base text-slate-900 font-mono text-sm">
                                                {payment.midtransTransactionId || 'N/A'}
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Midtrans Order ID</label>
                                            <p className="text-base text-slate-900 font-mono text-sm">
                                                {payment.midtransOrderId || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Refund Button - Only show for paid payments */}
                                {payment.status === 'paid' && (
                                    <>
                                        <Separator className="my-6" />
                                        <div className="flex justify-end">
                                            <Button
                                                variant="destructive"
                                                onClick={handleOpenRefundDialog}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                <RefreshCcw className="h-4 w-4 mr-2" />
                                                Refund Payment
                                            </Button>
                                        </div>
                                    </>
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
                                        <p className="text-base text-slate-900">{payment.user.fullName}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">Email</label>
                                        <p className="text-base text-slate-900">{payment.user.email}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-500">User ID</label>
                                        <p className="text-base text-slate-900 font-mono text-sm">{payment.user.id}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Subscription Information */}
                        {payment.subscription && (
                            <Card className="border-slate-200">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                    <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <Package className="h-5 w-5 text-blue-600" />
                                        Subscription Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Plan</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 font-medium">
                                                    {payment.subscription.plan.displayName}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Status</label>
                                            <div className="mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={`${getStatusBadgeColor(payment.subscription.status)} font-medium capitalize`}
                                                >
                                                    {payment.subscription.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Billing Cycle</label>
                                            <p className="text-base text-slate-900 capitalize">{payment.subscription.billingCycle}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Price</label>
                                            <p className="text-base text-slate-900">
                                                {formatCurrency(
                                                    payment.subscription.billingCycle === 'monthly'
                                                        ? payment.subscription.plan.priceMonthly
                                                        : payment.subscription.plan.priceYearly,
                                                    payment.currency
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Start Date</label>
                                            <p className="text-base text-slate-900">{formatDate(payment.subscription.startDate)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">End Date</label>
                                            <p className="text-base text-slate-900">{formatDate(payment.subscription.endDate)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Invoice Information */}
                        {payment.invoice && (
                            <Card className="border-slate-200">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                            Invoice Information
                                        </CardTitle>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGenerateInvoice}
                                            disabled={isGeneratingInvoice}
                                            className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                        >
                                            {isGeneratingInvoice ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Download PDF
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Invoice Number</label>
                                            <p className="text-base text-slate-900 font-mono">{payment.invoice.invoiceNumber}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Status</label>
                                            <div className="mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={`${getStatusBadgeColor(payment.invoice.status)} font-medium capitalize`}
                                                >
                                                    {payment.invoice.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Amount</label>
                                            <p className="text-base text-slate-900 font-semibold">
                                                {formatCurrency(payment.invoice.amount, payment.invoice.currency)}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Issued At</label>
                                            <p className="text-base text-slate-900">{formatDate(payment.invoice.issuedAt)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Due At</label>
                                            <p className="text-base text-slate-900">{formatDate(payment.invoice.dueAt)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Paid At</label>
                                            <p className="text-base text-slate-900">{formatDate(payment.invoice.paidAt)}</p>
                                        </div>
                                    </div>

                                    {payment.invoice.items && payment.invoice.items.length > 0 && (
                                        <>
                                            <Separator className="my-4" />
                                            <div>
                                                <label className="text-sm font-medium text-slate-500 mb-2 block">Invoice Items</label>
                                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-slate-50">
                                                                <TableHead className="font-semibold text-slate-700">Description</TableHead>
                                                                <TableHead className="font-semibold text-slate-700 text-right">Quantity</TableHead>
                                                                <TableHead className="font-semibold text-slate-700 text-right">Unit Price</TableHead>
                                                                <TableHead className="font-semibold text-slate-700 text-right">Total</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {payment.invoice.items.map((item: any, index: number) => (
                                                                <TableRow key={index}>
                                                                    <TableCell className="text-slate-900">{item.description}</TableCell>
                                                                    <TableCell className="text-slate-900 text-right">{item.quantity}</TableCell>
                                                                    <TableCell className="text-slate-900 text-right">
                                                                        {formatCurrency(item.unitPrice, payment.invoice!.currency)}
                                                                    </TableCell>
                                                                    <TableCell className="text-slate-900 text-right font-semibold">
                                                                        {formatCurrency(item.total, payment.invoice!.currency)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Generate Invoice Section - Show if no invoice exists */}
                        {!payment.invoice && payment.status === 'paid' && (
                            <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-white">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                                    <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <FileCheck className="h-5 w-5 text-blue-600" />
                                        Generate Invoice
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-slate-700 font-medium mb-2">
                                                No invoice has been generated for this payment yet.
                                            </p>
                                            <p className="text-slate-600 text-sm">
                                                Generate an invoice to create a PDF document with payment details,
                                                subscription information, and itemized charges.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleGenerateInvoice}
                                            disabled={isGeneratingInvoice}
                                            className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {isGeneratingInvoice ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <FileCheck className="h-4 w-4 mr-2" />
                                                    Generate Invoice
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Midtrans Transaction Details */}
                        {(payment.midtransTransactionId || payment.midtransOrderId) && (
                            <Card className="border-slate-200">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                    <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <Receipt className="h-5 w-5 text-blue-600" />
                                        Midtrans Transaction Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Transaction ID</label>
                                            <p className="text-base text-slate-900 font-mono text-sm">
                                                {payment.midtransTransactionId || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Order ID</label>
                                            <p className="text-base text-slate-900 font-mono text-sm">
                                                {payment.midtransOrderId || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Payment Method</label>
                                            <p className="text-base text-slate-900">{formatPaymentMethod(payment.paymentMethod)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Payment Status</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getPaymentStatusIcon(payment.status)}
                                                <span className="text-base text-slate-900 capitalize">{payment.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Webhook Logs */}
                        {payment.webhookLogs && payment.webhookLogs.length > 0 && (
                            <Card className="border-slate-200">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                    <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <Webhook className="h-5 w-5 text-blue-600" />
                                        Webhook Logs ({payment.webhookLogs.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        {payment.webhookLogs.map((log) => (
                                            <div key={log.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                                <div className="grid grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500">Event Type</label>
                                                        <p className="text-sm text-slate-900 font-medium">{log.eventType}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500">Status</label>
                                                        <div className="mt-1">
                                                            <Badge
                                                                variant="outline"
                                                                className={`${getStatusBadgeColor(log.status)} text-xs`}
                                                            >
                                                                {log.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500">Transaction ID</label>
                                                        <p className="text-sm text-slate-900 font-mono">{log.transactionId || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-500">Timestamp</label>
                                                        <p className="text-sm text-slate-900">{formatDateTime(log.createdAt)}</p>
                                                    </div>
                                                </div>

                                                {log.errorMessage && (
                                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                                                        <label className="text-xs font-medium text-red-700">Error Message</label>
                                                        <p className="text-sm text-red-900 mt-1">{log.errorMessage}</p>
                                                    </div>
                                                )}

                                                <details className="mt-3">
                                                    <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                                                        View Payload
                                                    </summary>
                                                    <pre className="mt-2 p-3 bg-white border border-slate-200 rounded text-xs overflow-x-auto">
                                                        {JSON.stringify(log.payload, null, 2)}
                                                    </pre>
                                                </details>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {payment.webhookLogs && payment.webhookLogs.length === 0 && (
                            <Card className="border-slate-200">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                    <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <Webhook className="h-5 w-5 text-blue-600" />
                                        Webhook Logs
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="text-center py-8">
                                        <Webhook className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">No webhook logs found</p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            Webhook logs will appear here when Midtrans sends notifications
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </DialogContent>

            {/* Refund Confirmation Dialog */}
            <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <RefreshCcw className="h-5 w-5 text-red-600" />
                            Refund Payment
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will process a refund for this payment. Please provide a reason for the refund.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="refund-amount">Refund Amount</Label>
                            <Input
                                id="refund-amount"
                                type="number"
                                placeholder="Enter refund amount"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                className="border-slate-300"
                            />
                            <p className="text-xs text-slate-500">
                                Leave empty to refund the full amount ({payment && formatCurrency(payment.amount, payment.currency)})
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="refund-reason">Reason for Refund *</Label>
                            <Textarea
                                id="refund-reason"
                                placeholder="Enter the reason for this refund..."
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                className="border-slate-300 min-h-[100px]"
                                required
                            />
                        </div>

                        {payment && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Warning:</strong> This will refund the payment and update the subscription status.
                                    The user will be notified via email.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setRefundReason("");
                            setRefundAmount("");
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRefundPayment}
                            disabled={!refundReason.trim() || refundPaymentMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {refundPaymentMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="h-4 w-4 mr-2" />
                                    Confirm Refund
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
