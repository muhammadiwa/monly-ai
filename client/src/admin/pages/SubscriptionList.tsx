import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../layout/AdminLayout";
import SubscriptionDetailsModal from "../components/SubscriptionDetailsModal";
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
    CreditCard,
    AlertCircle,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Eye,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";

interface SubscriptionListItem {
    id: number;
    userId: string;
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
        priceMonthly: number;
        priceYearly: number;
    };
    status: 'active' | 'expired' | 'cancelled' | 'pending';
    billingCycle: 'monthly' | 'yearly';
    startDate: number;
    endDate: number;
    autoRenew: boolean;
    nextBilling: number | null;
    createdAt: number;
    updatedAt: number;
}

interface SubscriptionListResponse {
    success: boolean;
    data: {
        subscriptions: SubscriptionListItem[];
        total: number;
        page: number;
        totalPages: number;
    };
}

type SortField = 'user' | 'plan' | 'status' | 'billingCycle' | 'startDate' | 'endDate';
type SortDirection = 'asc' | 'desc' | null;

export default function SubscriptionList() {
    const [, setLocation] = useLocation();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [planFilter, setPlanFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchInput, setSearchInput] = useState("");
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
    const limit = 10;

    // Fetch subscriptions with pagination and filters
    const { data, isLoading, error } = useQuery<SubscriptionListResponse>({
        queryKey: ["/api/admin/subscriptions", page, search, planFilter, statusFilter],
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
            if (planFilter && planFilter !== 'all') {
                params.append('plan', planFilter);
            }
            if (statusFilter && statusFilter !== 'all') {
                params.append('status', statusFilter);
            }

            const res = await fetch(`/api/admin/subscriptions?${params.toString()}`, {
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

    const subscriptions = data?.data?.subscriptions || [];
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
    const handlePlanFilterChange = (value: string) => {
        setPlanFilter(value);
        setPage(1); // Reset to first page on filter change
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setPage(1); // Reset to first page on filter change
    };

    // Handle view subscription details
    const handleViewSubscription = (subscriptionId: number) => {
        setSelectedSubscriptionId(subscriptionId);
        setDetailsModalOpen(true);
    };

    // Format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
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
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Get plan badge color
    const getPlanBadgeColor = (planName: string) => {
        switch (planName) {
            case 'free':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'premium':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'business':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
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

    // Sort subscriptions
    const sortedSubscriptions = [...subscriptions].sort((a, b) => {
        if (!sortField || !sortDirection) return 0;

        let aValue: any;
        let bValue: any;

        switch (sortField) {
            case 'user':
                aValue = a.user.name.toLowerCase();
                bValue = b.user.name.toLowerCase();
                break;
            case 'plan':
                aValue = a.plan.displayName.toLowerCase();
                bValue = b.plan.displayName.toLowerCase();
                break;
            case 'status':
                aValue = a.status;
                bValue = b.status;
                break;
            case 'billingCycle':
                aValue = a.billingCycle;
                bValue = b.billingCycle;
                break;
            case 'startDate':
                aValue = a.startDate;
                bValue = b.startDate;
                break;
            case 'endDate':
                aValue = a.endDate;
                bValue = b.endDate;
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

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading subscriptions...</p>
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
                        Failed to load subscriptions. Please try again.
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
                            Subscription Management
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Monitor and manage all user subscriptions
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">{total} total subscriptions</span>
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Search Input */}
                            <div className="md:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by user name, email, or subscription ID..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyPress={handleSearchKeyPress}
                                        className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Plan Filter */}
                            <div>
                                <Select value={planFilter} onValueChange={handlePlanFilterChange}>
                                    <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                                        <SelectValue placeholder="Filter by plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Plans</SelectItem>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="premium">Premium</SelectItem>
                                        <SelectItem value="business">Business</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                                    <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
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

                {/* Subscriptions Table */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700">
                            Subscriptions List
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {subscriptions.length === 0 ? (
                            <div className="text-center py-12">
                                <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No subscriptions found</p>
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
                                                    onClick={() => handleSort('plan')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Plan
                                                    {renderSortIcon('plan')}
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
                                                <button
                                                    onClick={() => handleSort('billingCycle')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Billing
                                                    {renderSortIcon('billingCycle')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('startDate')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    Start Date
                                                    {renderSortIcon('startDate')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                <button
                                                    onClick={() => handleSort('endDate')}
                                                    className="flex items-center hover:text-blue-600 transition-colors"
                                                >
                                                    End Date
                                                    {renderSortIcon('endDate')}
                                                </button>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                                Auto Renew
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700 text-right">
                                                Actions
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedSubscriptions.map((subscription) => (
                                            <TableRow
                                                key={subscription.id}
                                                className="hover:bg-slate-50 transition-colors"
                                            >
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium text-slate-900">
                                                            {subscription.user.name}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            {subscription.user.email}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getPlanBadgeColor(subscription.plan.name)} font-medium`}
                                                    >
                                                        {subscription.plan.displayName}
                                                    </Badge>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {subscription.billingCycle === 'monthly'
                                                            ? formatCurrency(subscription.plan.priceMonthly)
                                                            : formatCurrency(subscription.plan.priceYearly)}
                                                        /{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getStatusBadgeColor(subscription.status)} font-medium capitalize`}
                                                    >
                                                        {subscription.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-600 capitalize">
                                                    {subscription.billingCycle}
                                                </TableCell>
                                                <TableCell className="text-slate-600">
                                                    {formatDate(subscription.startDate)}
                                                </TableCell>
                                                <TableCell className="text-slate-600">
                                                    {formatDate(subscription.endDate)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            subscription.autoRenew
                                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                                        }
                                                    >
                                                        {subscription.autoRenew ? 'Yes' : 'No'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                                        title="View Details"
                                                        onClick={() => handleViewSubscription(subscription.id)}
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
                                    Showing page {page} of {totalPages} ({total} total subscriptions)
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

            {/* Subscription Details Modal */}
            <SubscriptionDetailsModal
                open={detailsModalOpen}
                onOpenChange={setDetailsModalOpen}
                subscriptionId={selectedSubscriptionId}
            />
        </AdminLayout>
    );
}
