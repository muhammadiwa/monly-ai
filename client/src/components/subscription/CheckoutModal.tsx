import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Calendar, Check, AlertCircle } from "lucide-react";
import { calculateYearlySavings } from "@/lib/pricingUtils";

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

interface CheckoutModalProps {
    plan: Plan;
    billingCycle?: 'monthly' | 'yearly';
    open: boolean;
    onClose: () => void;
    onSuccess: (subscriptionId: number) => void;
}

export default function CheckoutModal({
    plan,
    billingCycle: initialBillingCycle = 'monthly',
    open,
    onClose,
    onSuccess,
}: CheckoutModalProps) {
    const { toast } = useToast();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(initialBillingCycle);
    const [agreeToTerms, setAgreeToTerms] = useState(false);

    // Update billing cycle when prop changes (e.g., when user switches toggle on pricing page)
    useEffect(() => {
        setBillingCycle(initialBillingCycle);
    }, [initialBillingCycle]);

    const checkoutMutation = useMutation({
        mutationFn: async () => {
            const response = await apiRequest('POST', '/api/subscription/checkout', {
                planId: plan.id,
                billingCycle,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to create checkout');
            }

            return response.json();
        },
        onSuccess: (data) => {
            if (data.data?.subscriptionId) {
                onSuccess(data.data.subscriptionId);
            }

            // Store orderId in localStorage for verification when user returns
            if (data.data?.orderId) {
                localStorage.setItem('pending_order_id', data.data.orderId);
            }

            if (data.data?.paymentUrl) {
                window.location.href = data.data.paymentUrl;
            } else {
                throw new Error('Payment URL not received');
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Checkout Failed",
                description: error.message || "Failed to initiate checkout. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleConfirm = () => {
        if (!agreeToTerms) {
            toast({
                title: "Terms Required",
                description: "Please agree to the terms and conditions to continue",
                variant: "destructive",
            });
            return;
        }

        checkoutMutation.mutate();
    };

    const formatPrice = (price: number, currency: string) => {
        if (currency === 'IDR') {
            return `Rp ${price.toLocaleString('id-ID')}`;
        }
        return `${currency} ${price.toLocaleString()}`;
    };

    const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
    const savings = calculateYearlySavings(plan.price.monthly, plan.price.yearly);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-xl border-white/20 rounded-3xl shadow-2xl flex flex-col">
                <DialogHeader className="text-center pb-2 flex-shrink-0">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <CreditCard className="w-8 h-8 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                        Complete Your Subscription
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 text-base">
                        Review your plan details and proceed to payment
                    </DialogDescription>
                </DialogHeader>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto space-y-6 px-1 min-h-0">
                    {/* Plan Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{plan.displayName}</h3>
                                <p className="text-sm text-slate-600">{plan.description}</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                Selected Plan
                            </Badge>
                        </div>

                        <Separator className="my-4" />

                        {/* Key Features */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-slate-700 uppercase tracking-wide mb-3">
                                Key Features
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                                {plan.features.slice(0, 4).map((feature, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-slate-700">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Billing Cycle Selection */}
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Calendar className="w-5 h-5" />
                            Select Billing Cycle
                        </Label>
                        <RadioGroup value={billingCycle} onValueChange={(value) => setBillingCycle(value as 'monthly' | 'yearly')}>
                            <div className="space-y-3">
                                {/* Monthly Option */}
                                <div
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${billingCycle === 'monthly'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    onClick={() => setBillingCycle('monthly')}
                                >
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="monthly" id="monthly" />
                                        <div>
                                            <Label htmlFor="monthly" className="font-semibold text-slate-900 cursor-pointer">
                                                Monthly Billing
                                            </Label>
                                            <p className="text-sm text-slate-600">
                                                Billed every month
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-slate-900">
                                            {formatPrice(plan.price.monthly, plan.currency)}
                                        </div>
                                        <div className="text-xs text-slate-500">per month</div>
                                    </div>
                                </div>

                                {/* Yearly Option */}
                                <div
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${billingCycle === 'yearly'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    onClick={() => setBillingCycle('yearly')}
                                >
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="yearly" id="yearly" />
                                        <div>
                                            <Label htmlFor="yearly" className="font-semibold text-slate-900 cursor-pointer">
                                                Yearly Billing
                                            </Label>
                                            <p className="text-sm text-slate-600">
                                                Billed once per year
                                            </p>
                                            {savings > 0 && (
                                                <Badge className="mt-1 bg-green-100 text-green-700 border-green-200">
                                                    Save {savings}%
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-slate-900">
                                            {formatPrice(plan.price.yearly, plan.currency)}
                                        </div>
                                        <div className="text-xs text-slate-500">per year</div>
                                    </div>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Total Amount */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-base font-semibold text-slate-700">Total Amount</span>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-slate-900">
                                    {formatPrice(price, plan.currency)}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {billingCycle === 'monthly' ? 'per month' : 'per year'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms and Conditions */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <Checkbox
                            id="terms"
                            checked={agreeToTerms}
                            onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <Label
                                htmlFor="terms"
                                className="text-sm text-slate-700 cursor-pointer leading-relaxed"
                            >
                                I agree to the{' '}
                                <a href="/terms" target="_blank" className="text-blue-600 hover:underline font-medium">
                                    Terms and Conditions
                                </a>{' '}
                                and{' '}
                                <a href="/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">
                                    Privacy Policy
                                </a>
                                . I understand that I will be charged {formatPrice(price, plan.currency)} {billingCycle === 'monthly' ? 'monthly' : 'yearly'} and my subscription will auto-renew unless cancelled.
                            </Label>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-700">
                            <p className="font-medium mb-1">Secure Payment via Midtrans</p>
                            <p className="text-slate-600">
                                You'll be redirected to Midtrans payment gateway to complete your purchase securely.
                                Multiple payment methods available including credit card, bank transfer, and e-wallet.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons - Fixed at bottom */}
                <div className="flex gap-3 pt-4 border-t border-slate-200 flex-shrink-0 mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 rounded-xl py-3 font-medium"
                        disabled={checkoutMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-xl py-3 font-medium shadow-lg"
                        disabled={checkoutMutation.isPending || !agreeToTerms}
                    >
                        {checkoutMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Proceed to Payment
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
