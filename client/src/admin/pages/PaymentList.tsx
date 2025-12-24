import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import PaymentDetailsModal from "../components/PaymentDetailsModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    DollarSign,
    AlertCircle,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Eye,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Calendar,
} from "lucide-react";

interface PaymentListItem {
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
        email: string;
        firstName: string;
        lastName: string;
        fullName: string;
    };
    subscription: {
        id: number;
        planId: number;
        status: string;
        planName: string;
        planDisplayName: string;
    } | null;
    invoice: {
        invoiceNumber: string;
        status: string;
    } | null;
}

interface PaymentListResponse {
    success: boolean;
    data: {
        payments: PaymentListItem[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
    };
}

type SortField = 'user' | 'amount' | 'status' | 'paymentMethod' | 'createdAt' | 'paidAt';
type SortDirection = 'asc' | 'desc' | null;

export default function PaymentList() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchInput, setSearchInput] = useState("");
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const limit = 10;

    // Fetch payments with pagination and filters
    const { data, isLoading, error } = useQuery<PaymentListResponse>({
        queryKey: ["/api/admin/payments", page, search, statusFilter],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (search) {
                params.append('search', search);
            }
            if (statusFilter && statusFilter !== 'all') {
                params.append('status', statusFilter);
            }

            const res = await fetch(`/api/admin/payments?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
    });

    const payments = data?.data?.payments || [];
    const total = data?.data?.total || 0;
    const totalPages = data?.data?.totalPages || 1;

    // Handle search
    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1); // Reset to first page on new search
    };

    const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Handle filter changes
    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setPage(1); // Reset to first page on filter change
    };

    // Format date
    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format currency
    const formatCurrency = (amount: number, currency: string) => {
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

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // Cycle through: asc -> desc -> null
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortDirection(null);
                setSortField(null);
            }
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort payments
    const sortedPayments = [...payments].sort((a, b) => {
        if (!sortField || !sortDirection) return 0;

        let aValue: any;
        let bValue: any;

        switch (sortField) {
            case 'user':
                aValue = a.user.fullName.toLowerCase();
                bValue = b.user.fullName.toLowerCase();
                break;
            case 'amount':
                aValue = a.amount;
                bValue = b.amount;
                break;
            case 'status':
                aValue = a.status;
                bValue = b.status;
                break;
            case 'paymentMethod':
                aValue = a.paymentMethod;
                bValue = b.paymentMethod;
                break;
            case 'createdAt':
                aValue = a.createdAt;
                bValue = b.createdAt;
                break;
            case 'paidAt':
                aValue = a.paidAt || 0;
                bValue = b.paidAt || 0;
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Render sort icon
    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
        }
        if (sortDirection === 'asc') {
            return <ArrowUp className="h-3 w-3 ml-1 text-blue-600" />;
        }
        if (sortDirection === 'desc') {
            return <ArrowDown className="h-3 w-3 ml-1 text-blue-600" />;
        }
        return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
    };

    // Handle view payment details
    const handleViewPayment = (paymentId: number) => {
        setSelectedPaymentId(paymentId);
        setIsDetailsModalOpen(true);
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading payments...</p>
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
                        Failed to load payments. Please try again.
                    </AlertDescription>
                </Alert>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Payment Management
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Monitor and manage all payment transactions
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{total} total payments</span>
                    </div>
                </div>

                {/* Filters and Search */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700">
                            Search & Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search Input */}
                            <div className="md:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by user, transaction ID, or invoice number..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyPress={handleSearchKeyPress}
                                        className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                                    <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="refunded">Refunded</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Search Button */}
                        <div className="mt-4 flex justify-end">
                            <Button
                                onClick={handleSearch}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Search className="h-4 w-4 mr-2" />
                                Search
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Payments Table */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700">
                            Payments List
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {payments.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No payments found</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    Try adjusting your search or filters
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('user')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    User
                                                    {renderSortIcon('user')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('amount')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Amount
                                                    {renderSortIcon('amount')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('paymentMethod')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Method
                                                    {renderSortIcon('paymentMethod')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('status')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Status
                                                    {renderSortIcon('status')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                Plan
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                Invoice
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('createdAt')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Created
                                                    {renderSortIcon('createdAt')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('paidAt')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Paid At
                                                    {renderSortIcon('paidAt')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700 text-right">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedPayments.map((payment) => (
                                            <TableRow
                                                key={payment.id}
                                                className="hover:bg-slate-50 transition-colors"
                                            >
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium text-slate-900">
                                                            {payment.user.fullName}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            {payment.user.email}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-slate-900">
                                                        {formatCurrency(payment.amount, payment.currency)}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {payment.currency}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getPaymentMethodBadgeColor(payment.paymentMethod)} font-medium`}
                                                    >
                                                        {formatPaymentMethod(payment.paymentMethod)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getStatusBadgeColor(payment.status)} font-medium capitalize`}
                                                    >
                                                        {payment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {payment.subscription ? (
                                                        <div className="text-sm">
                                                            <div className="font-medium text-slate-900">
                                                                {payment.subscription.planDisplayName}
                                                            </div>
                                                            <div className="text-xs text-slate-500 capitalize">
                                                                {payment.subscription.status}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.invoice ? (
                                                        <div className="text-sm">
                                                            <div className="font-medium text-slate-900">
                                                                {payment.invoice.invoiceNumber}
                                                            </div>
                                                            <div className="text-xs text-slate-500 capitalize">
                                                                {payment.invoice.status}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-slate-400" />
                                                        {formatDate(payment.createdAt)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm">
                                                    {payment.paidAt ? (
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3 text-slate-400" />
                                                            {formatDate(payment.paidAt)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                                        title="View Details"
                                                        onClick={() => handleViewPayment(payment.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Card className="border-slate-200 shadow-md">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing page {page} of {totalPages} ({total} total payments)
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 1}
                                        className="border-slate-300 hover:bg-slate-50"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={page === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setPage(pageNum)}
                                                    className={
                                                        page === pageNum
                                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                            : "border-slate-300 hover:bg-slate-50"
                                                    }
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(page + 1)}
                                        disabled={page === totalPages}
                                        className="border-slate-300 hover:bg-slate-50"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Payment Details Modal */}
            <PaymentDetailsModal
                open={isDetailsModalOpen}
                onOpenChange={setIsDetailsModalOpen}
                paymentId={selectedPaymentId}
            />
        </AdminLayout>
    );
}
