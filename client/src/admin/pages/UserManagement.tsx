import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../layout/AdminLayout";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Search,
    Users,
    AlertCircle,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Ban,
    UserCheck,
    Trash2,
} from "lucide-react";
import { UserTable } from "../components";
import type { UserListItem } from "../components";

interface UserListResponse {
    success: boolean;
    data: {
        users: UserListItem[];
        total: number;
        page: number;
        totalPages: number;
    };
}

export default function UserManagement() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [planFilter, setPlanFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [searchInput, setSearchInput] = useState("");
    const limit = 10;

    // Dialog states
    const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
    const [activateDialogOpen, setActivateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [actionReason, setActionReason] = useState("");

    // Fetch users with pagination and filters
    const { data, isLoading, error, refetch } = useQuery<UserListResponse>({
        queryKey: ["/api/admin/users", page, search, planFilter, statusFilter],
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

            const res = await fetch(`/api/admin/users?${params.toString()}`, {
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

    const users = data?.data?.users || [];
    const total = data?.data?.total || 0;
    const totalPages = data?.data?.totalPages || 1;

    // Suspend user mutation
    const suspendMutation = useMutation({
        mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to suspend user');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "User Suspended",
                description: "The user account has been suspended successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setSuspendDialogOpen(false);
            setActionReason("");
            setSelectedUserId(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Suspension Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Activate user mutation
    const activateMutation = useMutation({
        mutationFn: async (userId: string) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/users/${userId}/activate`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to activate user');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "User Activated",
                description: "The user account has been activated successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setActivateDialogOpen(false);
            setSelectedUserId(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Activation Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Delete user mutation
    const deleteMutation = useMutation({
        mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to delete user');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "User Deleted",
                description: "The user account has been deleted successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setDeleteDialogOpen(false);
            setActionReason("");
            setSelectedUserId(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Deletion Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

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

    // Handle user actions
    const handleViewUser = (userId: string) => {
        setLocation(`/admin/users/${userId}`);
    };

    const handleSuspendUser = (userId: string) => {
        setSelectedUserId(userId);
        setSuspendDialogOpen(true);
    };

    const handleActivateUser = (userId: string) => {
        setSelectedUserId(userId);
        setActivateDialogOpen(true);
    };

    const handleDeleteUser = (userId: string) => {
        setSelectedUserId(userId);
        setDeleteDialogOpen(true);
    };

    // Handle action confirmations
    const handleSuspendConfirm = () => {
        if (!selectedUserId) return;
        if (!actionReason.trim()) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for suspending this user.",
                variant: "destructive",
            });
            return;
        }
        suspendMutation.mutate({ userId: selectedUserId, reason: actionReason });
    };

    const handleActivateConfirm = () => {
        if (!selectedUserId) return;
        activateMutation.mutate(selectedUserId);
    };

    const handleDeleteConfirm = () => {
        if (!selectedUserId) return;
        if (!actionReason.trim()) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for deleting this user.",
                variant: "destructive",
            });
            return;
        }
        deleteMutation.mutate({ userId: selectedUserId, reason: actionReason });
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading users...</p>
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
                        Failed to load users. Please try again.
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
                            User Management
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Manage and monitor all user accounts
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{total} total users</span>
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
                                        placeholder="Search by name, email, or user ID..."
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
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                        <SelectItem value="deleted">Deleted</SelectItem>
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

                {/* Users Table */}
                <Card className="border-slate-200 shadow-md">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <CardTitle className="text-lg font-semibold text-slate-700">
                            Users List
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {users.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No users found</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    Try adjusting your search or filters
                                </p>
                            </div>
                        ) : (
                            <UserTable
                                users={users}
                                onView={handleViewUser}
                                onSuspend={handleSuspendUser}
                                onActivate={handleActivateUser}
                                onDelete={handleDeleteUser}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Card className="border-slate-200 shadow-md">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing page {page} of {totalPages} ({total} total users)
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

                {/* Suspend User Dialog */}
                <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Ban className="h-5 w-5 text-orange-600" />
                                Suspend User Account
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will suspend the user account and block their access to the application.
                                The user will be notified via email.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="suspend-reason">Reason for Suspension *</Label>
                                <Textarea
                                    id="suspend-reason"
                                    placeholder="Enter the reason for suspending this user account..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    setSuspendDialogOpen(false);
                                    setActionReason("");
                                    setSelectedUserId(null);
                                }}
                                disabled={suspendMutation.isPending}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleSuspendConfirm}
                                disabled={suspendMutation.isPending || !actionReason.trim()}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                {suspendMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Suspending...
                                    </>
                                ) : (
                                    <>
                                        <Ban className="h-4 w-4 mr-2" />
                                        Suspend User
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Activate User Dialog */}
                <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-green-600" />
                                Activate User Account
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will activate the user account and restore their access to the application.
                                The user will be notified via email.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    setActivateDialogOpen(false);
                                    setSelectedUserId(null);
                                }}
                                disabled={activateMutation.isPending}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleActivateConfirm}
                                disabled={activateMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {activateMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Activating...
                                    </>
                                ) : (
                                    <>
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Activate User
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete User Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <Trash2 className="h-5 w-5" />
                                Delete User Account
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This action will permanently delete the user account. Personal data will be anonymized
                                but transaction data will be preserved for compliance. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="delete-reason">Reason for Deletion *</Label>
                                <Textarea
                                    id="delete-reason"
                                    placeholder="Enter the reason for deleting this user account..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    setDeleteDialogOpen(false);
                                    setActionReason("");
                                    setSelectedUserId(null);
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                disabled={deleteMutation.isPending || !actionReason.trim()}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {deleteMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete User
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AdminLayout>
    );
}
