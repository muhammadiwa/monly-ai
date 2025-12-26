import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Loader2, Sparkles, Zap, X, Rocket, Gift } from "lucide-react";
import { calculateYearlySavings } from "@/lib/pricingUtils";
import { CheckoutModal } from "@/components/subscription";

interface PlanLimits {
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
    apiAccess?: boolean;
    customReports?: boolean;
    dedicatedSupport?: boolean;
}

interface Plan {
    id: number;
    name: string;
    displayName: string;
    description: string;
    price: {
        monthly: number;
        yearly: number;
    };
    currency: string;
    features: string[];
    limits?: PlanLimits;
    isActive: boolean;
}

interface UserSubscription {
    id: number | null;
    planName: string;
    planDisplayName: string;
    status: string;
    billingCycle: 'monthly' | 'yearly' | null;
}

export default function Pricing() {
    const { toast } = useToast();
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Check for payment callback and verify payment
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const orderId = urlParams.get('order_id');
        const transactionStatus = urlParams.get('transaction_status');

        if (paymentStatus === 'success' || transactionStatus === 'settlement' || transactionStatus === 'capture') {
            // Payment completed, verify and activate subscription
            const verifyPayment = async () => {
                setIsVerifying(true);
                try {
                    // Get the latest pending payment order ID from localStorage or URL
                    const storedOrderId = localStorage.getItem('pending_order_id') || orderId;

                    if (storedOrderId) {
                        const response = await fetch(`/api/payment/verify/${storedOrderId}`);
                        const data = await response.json();

                        if (data.success && data.status === 'paid') {
                            toast({
                                title: "Payment Successful!",
                                description: "Your subscription has been activated.",
                            });
                            // Refresh subscription data
                            queryClient.invalidateQueries({ queryKey: ['/api/subscription/current'] });
                            localStorage.removeItem('pending_order_id');
                        } else if (data.status === 'pending') {
                            toast({
                                title: "Payment Pending",
                                description: "Your payment is being processed.",
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error verifying payment:', error);
                } finally {
                    setIsVerifying(false);
                    // Clean URL
                    window.history.replaceState({}, '', '/pricing');
                }
            };
            verifyPayment();
        } else if (paymentStatus === 'pending') {
            toast({
                title: "Payment Pending",
                description: "Please complete your payment.",
            });
            window.history.replaceState({}, '', '/pricing');
        } else if (paymentStatus === 'error') {
            toast({
                title: "Payment Failed",
                description: "An error occurred while processing your payment.",
                variant: "destructive",
            });
            window.history.replaceState({}, '', '/pricing');
        }
    }, [toast, queryClient]);

    // Fetch subscription plans
    const { data: plansResponse, isLoading: plansLoading } = useQuery({
        queryKey: ['/api/subscription/plans'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/plans');
            if (!response.ok) throw new Error('Failed to fetch plans');
            return response.json();
        },
    });

    // Fetch current user subscription
    const { data: currentSubscriptionResponse } = useQuery({
        queryKey: ['/api/subscription/current'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/current');
            if (!response.ok) throw new Error('Failed to fetch current subscription');
            return response.json();
        },
        enabled: isAuthenticated,
    });

    const plans: Plan[] = plansResponse?.data || [];
    const currentSubscription: UserSubscription | null = currentSubscriptionResponse?.data || null;

    const handleCheckout = (plan: Plan) => {
        if (!isAuthenticated) {
            toast({
                title: "Authentication Required",
                description: "Please log in to subscribe to a plan",
                variant: "destructive",
            });
            window.location.href = "/auth";
            return;
        }

        setSelectedPlan(plan);
        setCheckoutModalOpen(true);
    };

    const handleCheckoutSuccess = (subscriptionId: number) => {
        console.log('Subscription created:', subscriptionId);
        toast({
            title: "Redirecting to Payment",
            description: "Please complete your payment to activate your subscription",
        });
    };

    const formatPrice = (price: number, currency: string) => {
        if (currency === 'IDR') {
            return `Rp ${price.toLocaleString('id-ID')}`;
        }
        return `${currency} ${price.toLocaleString()}`;
    };

    const getPlanIcon = (planName: string) => {
        switch (planName.toLowerCase()) {
            case 'free':
                return <Gift className="h-6 w-6" />;
            case 'starter':
                return <Zap className="h-6 w-6" />;
            case 'plus':
                return <Sparkles className="h-6 w-6" />;
            case 'pro':
                return <Rocket className="h-6 w-6" />;
            default:
                return <Sparkles className="h-6 w-6" />;
        }
    };

    const getPlanColor = (planName: string) => {
        switch (planName.toLowerCase()) {
            case 'free':
                return 'from-slate-500 to-slate-600';
            case 'starter':
                return 'from-emerald-500 to-teal-600';
            case 'plus':
                return 'from-blue-500 to-indigo-600';
            case 'pro':
                return 'from-purple-500 to-pink-600';
            default:
                return 'from-gray-500 to-gray-600';
        }
    };

    const getPlanBgColor = (planName: string) => {
        switch (planName.toLowerCase()) {
            case 'free':
                return 'bg-white';
            case 'starter':
                return 'bg-gradient-to-br from-emerald-50 to-teal-50';
            case 'plus':
                return 'bg-gradient-to-br from-blue-50 to-indigo-50';
            case 'pro':
                return 'bg-gradient-to-br from-purple-50 to-pink-50';
            default:
                return 'bg-white';
        }
    };

    const isCurrentPlan = (planName: string) => {
        // Check if plan name matches AND billing cycle matches
        const isSamePlan = currentSubscription?.planName?.toLowerCase() === planName.toLowerCase();
        const isSameBillingCycle = currentSubscription?.billingCycle === billingCycle;

        // For free plan, billing cycle doesn't matter
        if (planName.toLowerCase() === 'free') {
            return isSamePlan;
        }

        // For paid plans, both plan name AND billing cycle must match
        return isSamePlan && isSameBillingCycle;
    };

    const canUpgrade = (planName: string) => {
        // If no subscription or user is on free plan, they can upgrade to any paid plan
        if (!currentSubscription) return true;

        const currentPlanName = currentSubscription.planName?.toLowerCase() || 'free';
        const targetPlanName = planName.toLowerCase();
        const currentBillingCycle = currentSubscription.billingCycle;

        // Plan hierarchy from lowest to highest
        const planHierarchy = ['free', 'starter', 'plus', 'pro'];
        const currentIndex = planHierarchy.indexOf(currentPlanName);
        const targetIndex = planHierarchy.indexOf(targetPlanName);

        // Can upgrade if target plan is higher than current plan
        if (targetIndex > currentIndex) return true;

        // Same plan but different billing cycle - allow switching
        if (currentPlanName === targetPlanName && currentBillingCycle !== billingCycle) {
            return true;
        }

        return false;
    };

    const formatLimit = (limit: number | undefined) => {
        if (limit === undefined || limit === null) return 'N/A';
        if (limit === -1) return 'Unlimited';
        return limit.toLocaleString();
    };

    if (plansLoading || isVerifying) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        {isVerifying ? 'Verifying Payment' : 'Loading Plans'}
                    </h2>
                    <p className="text-gray-600">
                        {isVerifying ? 'Please wait while we verify your payment...' : 'Please wait while we load subscription plans...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                        Select the perfect plan for your financial management needs. Upgrade or downgrade anytime.
                    </p>

                    {/* Billing Cycle Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                        <Label htmlFor="billing-toggle" className={`text-base font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                            Monthly
                        </Label>
                        <Switch
                            id="billing-toggle"
                            checked={billingCycle === 'yearly'}
                            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
                        />
                        <Label htmlFor="billing-toggle" className={`text-base font-medium ${billingCycle === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                            Yearly
                        </Label>
                        {billingCycle === 'yearly' && (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                                Save up to 20%
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    {plans.map((plan) => {
                        const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
                        const savings = calculateYearlySavings(plan.price.monthly, plan.price.yearly);
                        const isCurrent = isCurrentPlan(plan.name);
                        const canUpgradeToPlan = canUpgrade(plan.name);
                        const isPopular = plan.name.toLowerCase() === 'plus';

                        return (
                            <Card
                                key={plan.id}
                                className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${getPlanBgColor(plan.name)} ${isCurrent ? 'ring-2 ring-primary shadow-xl' : ''
                                    } ${isPopular ? 'border-2 border-blue-400' : ''}`}
                            >
                                {isPopular && (
                                    <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                                        Most Popular
                                    </div>
                                )}

                                {isCurrent && (
                                    <div className="absolute top-0 left-0 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1 text-sm font-semibold rounded-br-lg">
                                        Current Plan
                                    </div>
                                )}

                                <CardHeader className="text-center pb-8 pt-8">
                                    <div className={`mx-auto mb-4 p-3 rounded-full bg-gradient-to-r ${getPlanColor(plan.name)} text-white w-fit`}>
                                        {getPlanIcon(plan.name)}
                                    </div>
                                    <CardTitle className="text-2xl font-bold mb-2">{plan.displayName}</CardTitle>
                                    <CardDescription className="text-gray-600">{plan.description}</CardDescription>

                                    <div className="mt-6">
                                        <div className="text-4xl font-bold text-gray-900">
                                            {formatPrice(price, plan.currency)}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            per {billingCycle === 'monthly' ? 'month' : 'year'}
                                        </div>
                                        {billingCycle === 'yearly' && savings > 0 && (
                                            <Badge className="mt-2 bg-green-100 text-green-700 border-green-200">
                                                Save {savings}%
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <Separator />

                                    {/* Features List */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Features</h4>
                                        {plan.features.map((feature, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-gray-700">{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <Separator />

                                    {/* Limits */}
                                    {plan.limits && (
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Limits</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Transactions</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.transactions)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Budgets</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.budgets)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Goals</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.goals)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">AI Analysis</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.aiAnalysis)}/month</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Receipt OCR</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.receiptOCR)}/month</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">AI Chat</span>
                                                    <span className="font-medium">{formatLimit(plan.limits.aiChat)}/month</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Separator />

                                    {/* Premium Features */}
                                    {plan.limits && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                {plan.limits.whatsappNotifications ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <X className="h-4 w-4 text-gray-300" />
                                                )}
                                                <span className={`text-sm ${plan.limits.whatsappNotifications ? 'text-gray-700' : 'text-gray-400'}`}>
                                                    WhatsApp Notifications
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {plan.limits.exportData ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <X className="h-4 w-4 text-gray-300" />
                                                )}
                                                <span className={`text-sm ${plan.limits.exportData ? 'text-gray-700' : 'text-gray-400'}`}>
                                                    Export Data
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {plan.limits.advancedReports ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <X className="h-4 w-4 text-gray-300" />
                                                )}
                                                <span className={`text-sm ${plan.limits.advancedReports ? 'text-gray-700' : 'text-gray-400'}`}>
                                                    Advanced Reports
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {plan.limits.prioritySupport ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <X className="h-4 w-4 text-gray-300" />
                                                )}
                                                <span className={`text-sm ${plan.limits.prioritySupport ? 'text-gray-700' : 'text-gray-400'}`}>
                                                    Priority Support
                                                </span>
                                            </div>
                                            {plan.limits.apiAccess && (
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm text-gray-700">API Access</span>
                                                </div>
                                            )}
                                            {plan.limits.customReports && (
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm text-gray-700">Custom Reports</span>
                                                </div>
                                            )}
                                            {plan.limits.dedicatedSupport && (
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    <span className="text-sm text-gray-700">Dedicated Support</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter className="pt-6">
                                    {isCurrent ? (
                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            disabled
                                        >
                                            Current Plan
                                        </Button>
                                    ) : plan.name.toLowerCase() === 'free' ? (
                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            onClick={() => {
                                                if (!isAuthenticated) {
                                                    window.location.href = "/auth";
                                                }
                                            }}
                                        >
                                            {isAuthenticated ? 'Free Plan' : 'Sign Up Free'}
                                        </Button>
                                    ) : canUpgradeToPlan ? (
                                        <Button
                                            className={`w-full bg-gradient-to-r ${getPlanColor(plan.name)} hover:opacity-90 text-white`}
                                            onClick={() => handleCheckout(plan)}
                                        >
                                            {/* Check if same plan but different billing cycle */}
                                            {currentSubscription?.planName?.toLowerCase() === plan.name.toLowerCase()
                                                ? `Switch to ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`
                                                : isAuthenticated ? 'Upgrade Now' : 'Subscribe'}
                                        </Button>
                                    ) : (
                                        <Button
                                            className={`w-full bg-gradient-to-r ${getPlanColor(plan.name)} hover:opacity-90 text-white`}
                                            onClick={() => handleCheckout(plan)}
                                        >
                                            Downgrade
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>

                {/* FAQ or Additional Info */}
                <div className="mt-16 text-center max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Help Choosing?</h2>
                    <p className="text-gray-600 mb-6">
                        All plans include our core financial management features. Upgrade anytime to unlock advanced AI capabilities,
                        higher limits, and premium support. Cancel or downgrade at any time.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
                            Back to Dashboard
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = "/settings"}>
                            View Current Subscription
                        </Button>
                    </div>
                </div>

                {/* Checkout Modal */}
                {selectedPlan && (
                    <CheckoutModal
                        plan={selectedPlan}
                        billingCycle={billingCycle}
                        open={checkoutModalOpen}
                        onClose={() => {
                            setCheckoutModalOpen(false);
                            setSelectedPlan(null);
                        }}
                        onSuccess={handleCheckoutSuccess}
                    />
                )}
            </div>
        </div>
    );
}
