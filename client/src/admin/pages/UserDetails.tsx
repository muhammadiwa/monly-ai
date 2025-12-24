import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    ArrowLeft,
    User,
    Mail,
    Calendar,
    Clock,
    CreditCard,
    Activity,
    TrendingUp,
    Target,
    Wallet,
    AlertCircle,
    Loader2,
    CheckCircle,
    XCircle,
    Ban,
    UserCheck,
    Trash2,
    Users,
    BarChart3,
    History,
} from "lucide-react";

interface UserProfile {
    firstName: string;
    lastName: string;
    phone?: string;
    profileImageUrl?: string;
}

interface UserSubscription {
    plan: string;
    planDisplay: string;
    startDate: number;
    endDate: number;
    status: string;
    autoRenew: boolean;
    billingCycle: string;
    price: number;
}

interface UserUsage {
    transactionCount: number;
    budgetCount: number;
    goalCount: number;
    accountCount: number;
}

interface LoginRecord {
    timestamp: number;
    ipAddress: string;
    device: string;
}

interface UserActivity {
    loginHistory: LoginRecord[];
    lastActive: number;
}

interface UserActivityAnalytics {
    loginHistory: Array<{
        timestamp: number;
        ipAddress: string;
        device: string;
    }>;
    engagementMetrics: {
        dau: boolean;
        wau: boolean;
        mau: boolean;
        lastActiveDate: number;
        totalDaysActive: number;
    };
    retentionMetrics: {
        daysSinceRegistration: number;
        daysSinceLastActive: number;
        isRetained: boolean;
        activityRate: number;
    };
}

interface UserDetails {
    id: string;
    name: string;
    email: string;
    subscriptionPlan: string;
    subscriptionPlanDisplay: string;
    status: string;
    registrationDate: number;
    lastLogin: number;
    profile: UserProfile;
    subscription: UserSubscription | null;
    usage: UserUsage;
    activity: UserActivity;
}

interface UserDetailsResponse {
    success: boolean;
    data: UserDetails;
}

export default function UserDetails() {
    const [, params] = useRoute("/admin/users/:id");
    const [, setLocation] = useLocation();
    const userId = params?.id;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Dialog states
    const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
    const [activateDialogOpen, setActivateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [actionReason, setActionReason] = useState("");

    // Redirect if no user ID
    useEffect(() => {
        if (!userId) {
            setLocation("/admin/users");
        }
    }, [userId, setLocation]);

    // Fetch user details
    const { data, isLoading, error } = useQuery<UserDetailsResponse>({
        queryKey: ["/api/admin/users", userId],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        enabled: !!userId,
    });

    const userDetails = data?.data;

    // Fetch user activity analytics
    const { data: activityData, isLoading: activityLoading } = useQuery<{
        success: boolean;
        data: UserActivityAnalytics;
    }>({
        queryKey: ["/api/admin/users", userId, "activity"],
        queryFn: async () => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/users/${userId}/activity`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            return res.json();
        },
        enabled: !!userId,
    });

    const activityAnalytics = activityData?.data;

    // Suspend user mutation
    const suspendMutation = useMutation({
        mutationFn: async (reason: string) => {
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
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setSuspendDialogOpen(false);
            setActionReason("");
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
        mutationFn: async () => {
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
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setActivateDialogOpen(false);
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
        mutationFn: async (reason: string) => {
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
            setDeleteDialogOpen(false);
            setActionReason("");
            // Redirect to user list after deletion
            setTimeout(() => {
                setLocation("/admin/users");
            }, 1500);
        },
        onError: (error: Error) => {
            toast({
                title: "Deletion Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle action confirmations
    const handleSuspendConfirm = () => {
        if (!actionReason.trim()) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for suspending this user.",
                variant: "destructive",
            });
            return;
        }
        suspendMutation.mutate(actionReason);
    };

    const handleActivateConfirm = () => {
        activateMutation.mutate();
    };

    const handleDeleteConfirm = () => {
        if (!actionReason.trim()) {
            toast({
                title: "Reason Required",
                description: "Please provide a reason for deleting this user.",
                variant: "destructive",
            });
            return;
        }
        deleteMutation.mutate(actionReason);
    };

    // Format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return 'Never';
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Format date with time
    const formatDateTime = (timestamp: number) => {
        if (!timestamp) return 'Never';
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'suspended':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'deleted':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'free':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // Get plan badge color
    const getPlanBadgeColor = (plan: string) => {
        switch (plan) {
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

    // Handle back navigation
    const handleBack = () => {
        setLocation("/admin/users");
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading user details...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (error || !userDetails) {
        return (
            <AdminLayout>
                <div className="space-y-6">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        className="mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Users
                    </Button>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Failed to load user details. User may not exist or you don't have permission.
                        </AlertDescription>
                    </Alert>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="hover:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Users
                </Button>

                {/* Page Header */}
                <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {userDetails.profile.firstName?.[0]?.toUpperCase() || userDetails.name[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">
                                {userDetails.name}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <Badge
                                    variant="outline"
                                    className={`${getStatusBadgeColor(userDetails.status)} font-medium capitalize`}
                                >
                                    {userDetails.status}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={`${getPlanBadgeColor(userDetails.subscriptionPlan)} font-medium capitalize`}
                                >
                                    {userDetails.subscriptionPlanDisplay}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {userDetails.status === 'active' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSuspendDialogOpen(true)}
                                className="border-orange-200 text-orange-700 hover:bg-orange-50"
                            >
                                <Ban className="h-4 w-4 mr-2" />
                                Suspend
                            </Button>
                        )}
                        {userDetails.status === 'suspended' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActivateDialogOpen(true)}
                                className="border-green-200 text-green-700 hover:bg-green-50"
                            >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Activate
                            </Button>
                        )}
                        {userDetails.status !== 'deleted' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteDialogOpen(true)}
                                className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabbed Content */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-white border border-slate-200 p-1">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Activity
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        {/* User Profile Card */}
                        <Card className="border-slate-200 shadow-md">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    User Profile
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">User ID</label>
                                            <p className="text-slate-900 font-mono text-sm mt-1">{userDetails.id}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                Email
                                            </label>
                                            <p className="text-slate-900 mt-1">{userDetails.email}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500">Full Name</label>
                                            <p className="text-slate-900 mt-1">
                                                {userDetails.profile.firstName} {userDetails.profile.lastName}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                                <Calendar className="h-4 w-4" />
                                                Registration Date
                                            </label>
                                            <p className="text-slate-900 mt-1">{formatDate(userDetails.registrationDate)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                Last Login
                                            </label>
                                            <p className="text-slate-900 mt-1">{formatDateTime(userDetails.lastLogin)}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Subscription Details Card */}
                        <Card className="border-slate-200 shadow-md">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Subscription Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {userDetails.subscription ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">Plan</label>
                                                <p className="text-slate-900 font-semibold mt-1">
                                                    {userDetails.subscription.planDisplay}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">Status</label>
                                                <div className="mt-1">
                                                    <Badge
                                                        variant="outline"
                                                        className={`${getStatusBadgeColor(userDetails.subscription.status)} font-medium capitalize`}
                                                    >
                                                        {userDetails.subscription.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">Billing Cycle</label>
                                                <p className="text-slate-900 capitalize mt-1">
                                                    {userDetails.subscription.billingCycle}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">Start Date</label>
                                                <p className="text-slate-900 mt-1">
                                                    {formatDate(userDetails.subscription.startDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">End Date</label>
                                                <p className="text-slate-900 mt-1">
                                                    {formatDate(userDetails.subscription.endDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-slate-500">Auto Renew</label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {userDetails.subscription.autoRenew ? (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                            <span className="text-green-600 font-medium">Enabled</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="h-4 w-4 text-red-600" />
                                                            <span className="text-red-600 font-medium">Disabled</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium">No active subscription</p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            User is on the free plan
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Usage Statistics Card */}
                        <Card className="border-slate-200 shadow-md">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    Usage Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                                        <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-blue-900">
                                            {userDetails.usage.transactionCount}
                                        </p>
                                        <p className="text-sm text-blue-600 font-medium mt-1">Transactions</p>
                                    </div>
                                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                                        <Wallet className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-purple-900">
                                            {userDetails.usage.budgetCount}
                                        </p>
                                        <p className="text-sm text-purple-600 font-medium mt-1">Budgets</p>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                                        <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-green-900">
                                            {userDetails.usage.goalCount}
                                        </p>
                                        <p className="text-sm text-green-600 font-medium mt-1">Goals</p>
                                    </div>
                                    <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
                                        <CreditCard className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-orange-900">
                                            {userDetails.usage.accountCount}
                                        </p>
                                        <p className="text-sm text-orange-600 font-medium mt-1">Accounts</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Activity Tab */}
                    <TabsContent value="activity" className="space-y-6">
                        {activityLoading ? (
                            <Card className="border-slate-200 shadow-md">
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                                            <p className="text-slate-600">Loading activity data...</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : activityAnalytics ? (
                            <>
                                {/* Engagement Metrics Card */}
                                <Card className="border-slate-200 shadow-md">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            Engagement Metrics
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                                <div className="flex items-center justify-center mb-2">
                                                    {activityAnalytics.engagementMetrics.dau ? (
                                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                                    ) : (
                                                        <XCircle className="h-8 w-8 text-slate-400" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">Daily Active User</p>
                                                <p className={`text-lg font-bold ${activityAnalytics.engagementMetrics.dau ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {activityAnalytics.engagementMetrics.dau ? 'Active' : 'Inactive'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">Last 24 hours</p>
                                            </div>
                                            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                                <div className="flex items-center justify-center mb-2">
                                                    {activityAnalytics.engagementMetrics.wau ? (
                                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                                    ) : (
                                                        <XCircle className="h-8 w-8 text-slate-400" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">Weekly Active User</p>
                                                <p className={`text-lg font-bold ${activityAnalytics.engagementMetrics.wau ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {activityAnalytics.engagementMetrics.wau ? 'Active' : 'Inactive'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">Last 7 days</p>
                                            </div>
                                            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                                                <div className="flex items-center justify-center mb-2">
                                                    {activityAnalytics.engagementMetrics.mau ? (
                                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                                    ) : (
                                                        <XCircle className="h-8 w-8 text-slate-400" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">Monthly Active User</p>
                                                <p className={`text-lg font-bold ${activityAnalytics.engagementMetrics.mau ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {activityAnalytics.engagementMetrics.mau ? 'Active' : 'Inactive'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
                                            </div>
                                            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                                                <div className="flex items-center justify-center mb-2">
                                                    <Activity className="h-8 w-8 text-orange-600" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-600 mb-1">Total Days Active</p>
                                                <p className="text-2xl font-bold text-orange-900">
                                                    {activityAnalytics.engagementMetrics.totalDaysActive}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">Since registration</p>
                                            </div>
                                        </div>
                                        <Separator className="my-6" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    Last Active Date
                                                </label>
                                                <p className="text-slate-900 font-medium mt-1">
                                                    {formatDateTime(activityAnalytics.engagementMetrics.lastActiveDate)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Retention Metrics Card */}
                                <Card className="border-slate-200 shadow-md">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5" />
                                            Retention Metrics
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                                                <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-blue-900">
                                                    {activityAnalytics.retentionMetrics.daysSinceRegistration}
                                                </p>
                                                <p className="text-sm text-blue-600 font-medium mt-1">Days Since Registration</p>
                                            </div>
                                            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                                                <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-purple-900">
                                                    {activityAnalytics.retentionMetrics.daysSinceLastActive}
                                                </p>
                                                <p className="text-sm text-purple-600 font-medium mt-1">Days Since Last Active</p>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                                                <div className="flex items-center justify-center mb-2">
                                                    {activityAnalytics.retentionMetrics.isRetained ? (
                                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                                    ) : (
                                                        <XCircle className="h-8 w-8 text-red-600" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-600 font-medium mb-1">Retention Status</p>
                                                <p className={`text-lg font-bold ${activityAnalytics.retentionMetrics.isRetained ? 'text-green-700' : 'text-red-700'}`}>
                                                    {activityAnalytics.retentionMetrics.isRetained ? 'Retained' : 'At Risk'}
                                                </p>
                                            </div>
                                            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
                                                <TrendingUp className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-orange-900">
                                                    {activityAnalytics.retentionMetrics.activityRate.toFixed(1)}%
                                                </p>
                                                <p className="text-sm text-orange-600 font-medium mt-1">Activity Rate</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Login History Card */}
                                <Card className="border-slate-200 shadow-md">
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <CardTitle className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <History className="h-5 w-5" />
                                            Login History
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        {activityAnalytics.loginHistory.length > 0 ? (
                                            <div className="space-y-2">
                                                {activityAnalytics.loginHistory.map((login, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <Clock className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900">
                                                                    {formatDateTime(login.timestamp)}
                                                                </p>
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    IP: {login.ipAddress} • Device: {login.device}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                                <p className="text-slate-500 font-medium">No login history available</p>
                                                <p className="text-slate-400 text-sm mt-1">
                                                    Login history will appear here once the user logs in
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <Card className="border-slate-200 shadow-md">
                                <CardContent className="pt-6">
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Failed to load activity data. Please try again.
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>

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
                                onClick={() => setActivateDialogOpen(false)}
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
