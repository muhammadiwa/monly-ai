import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PlanFormModal } from "../components";
import {
    Package,
    AlertCircle,
    Loader2,
    Plus,
    Edit,
    Trash2,
    Check,
    X,
} from "lucide-react";

interface SubscriptionPlan {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    price: {
        monthly: number;
        yearly: number;
    };
    currency: string;
    features: string[]; // Already parsed JSON array
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
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

interface PlansResponse {
    success: boolean;
    data: SubscriptionPlan[];
}

export default function SubscriptionPlans() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [planFormOpen, setPlanFormOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    // Fetch subscription plans
    const { data, isLoading, error } = useQuery<PlansResponse>({
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
    });

    const plans = data?.data || [];

    // Delete plan mutation
    const deleteMutation = useMutation({
        mutationFn: async (planId: number) => {
            const adminToken = localStorage.getItem('admin-token');
            if (!adminToken) {
                throw new Error('No admin token');
            }

            const res = await fetch(`/api/admin/plans/${planId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error?.message || 'Failed to delete plan');
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Plan Deleted",
                description: "The subscription plan has been deleted successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
            setDeleteDialogOpen(false);
            setSelectedPlanId(null);
        },
        onError: (error: Error) => {
            toast({
                title: "Deletion Failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handle delete plan
    const handleDeletePlan = (planId: number) => {
        setSelectedPlanId(planId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (!selectedPlanId) return;
        deleteMutation.mutate(selectedPlanId);
    };

    // Handle create plan
    const handleCreatePlan = () => {
        setSelectedPlan(null);
        setFormMode("create");
        setPlanFormOpen(true);
    };

    // Handle edit plan
    const handleEditPlan = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan);
        setFormMode("edit");
        setPlanFormOpen(true);
    };

    // Format currency
    const formatCurrency = (amount: number, currency: string = 'IDR') => {
        if (currency === 'IDR') {
            return `Rp ${amount.toLocaleString('id-ID')}`;
        }
        return `$${amount.toLocaleString('en-US')}`;
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-600">Loading subscription plans...</p>
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
                        Failed to load subscription plans. Please try again.
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
                            Subscription Plans
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">
                            Manage subscription plans, pricing, and features
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                            <Package className="h-4 w-4" />
                            <span className="font-medium">{plans.length} plans</span>
                        </div>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                            onClick={handleCreatePlan}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Plan
                        </Button>
                    </div>
                </div>

                {/* Plans Grid */}
                {plans.length === 0 ? (
                    <Card className="border-slate-200 shadow-md">
                        <CardContent className="py-12">
                            <div className="text-center">
                                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No subscription plans found</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    Create your first plan to get started
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan) => {
                            const features = plan.features;
                            const limits = plan.limits;

                            return (
                                <Card
                                    key={plan.id}
                                    className={`border-2 hover:shadow-xl transition-all duration-300 ${plan.isActive
                                        ? 'border-blue-200 hover:border-blue-300'
                                        : 'border-slate-200 opacity-60'
                                        }`}
                                >
                                    <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CardTitle className="text-xl font-bold text-slate-900">
                                                        {plan.displayName}
                                                    </CardTitle>
                                                    {plan.isActive ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                                            <X className="h-3 w-3 mr-1" />
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </div>
                                                <CardDescription className="text-sm text-slate-600">
                                                    {plan.description || 'No description'}
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        {/* Pricing */}
                                        <div className="mb-6">
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="text-3xl font-bold text-slate-900">
                                                    {formatCurrency(plan.price.monthly, plan.currency)}
                                                </span>
                                                <span className="text-slate-500 text-sm">/month</span>
                                            </div>
                                            <div className="text-sm text-slate-600">
                                                or {formatCurrency(plan.price.yearly, plan.currency)}/year
                                            </div>
                                        </div>

                                        {/* Features */}
                                        <div className="mb-6">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Features</h4>
                                            <ul className="space-y-2">
                                                {features.slice(0, 5).map((feature, index) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                                                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                                {features.length > 5 && (
                                                    <li className="text-sm text-slate-500 italic">
                                                        +{features.length - 5} more features
                                                    </li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* Limits */}
                                        <div className="mb-6">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Limits</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {limits.transactionLimit !== undefined && (
                                                    <div className="bg-slate-50 rounded-lg p-3">
                                                        <div className="text-xs text-slate-500 mb-1">Transactions</div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {limits.transactionLimit === -1 ? 'Unlimited' : limits.transactionLimit}
                                                        </div>
                                                    </div>
                                                )}
                                                {limits.accountLimit !== undefined && (
                                                    <div className="bg-slate-50 rounded-lg p-3">
                                                        <div className="text-xs text-slate-500 mb-1">Accounts</div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {limits.accountLimit === -1 ? 'Unlimited' : limits.accountLimit}
                                                        </div>
                                                    </div>
                                                )}
                                                {limits.budgetLimit !== undefined && (
                                                    <div className="bg-slate-50 rounded-lg p-3">
                                                        <div className="text-xs text-slate-500 mb-1">Budgets</div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {limits.budgetLimit === -1 ? 'Unlimited' : limits.budgetLimit}
                                                        </div>
                                                    </div>
                                                )}
                                                {limits.goalLimit !== undefined && (
                                                    <div className="bg-slate-50 rounded-lg p-3">
                                                        <div className="text-xs text-slate-500 mb-1">Goals</div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            {limits.goalLimit === -1 ? 'Unlimited' : limits.goalLimit}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 pt-4 border-t border-slate-100">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleEditPlan(plan)}
                                            >
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeletePlan(plan.id)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Delete Plan Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                <Trash2 className="h-5 w-5" />
                                Delete Subscription Plan
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this subscription plan? This action cannot be undone.
                                Existing subscribers will not be affected, but new subscriptions to this plan will be disabled.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={() => {
                                    setDeleteDialogOpen(false);
                                    setSelectedPlanId(null);
                                }}
                                disabled={deleteMutation.isPending}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                disabled={deleteMutation.isPending}
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
                                        Delete Plan
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Plan Form Modal */}
                <PlanFormModal
                    open={planFormOpen}
                    onOpenChange={setPlanFormOpen}
                    plan={selectedPlan}
                    mode={formMode}
                />
            </div>
        </AdminLayout>
    );
}
