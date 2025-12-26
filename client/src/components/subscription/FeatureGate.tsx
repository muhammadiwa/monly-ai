import { ReactNode } from "react";
import { useSubscription, FeatureName, UsageLimitType } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Lock, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface FeatureGateProps {
    feature: FeatureName;
    children: ReactNode;
    fallback?: ReactNode;
    showUpgradePrompt?: boolean;
}

/**
 * FeatureGate Component
 * Controls access to features based on user's subscription plan
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export default function FeatureGate({
    feature,
    children,
    fallback,
    showUpgradePrompt = true,
}: FeatureGateProps) {
    const {
        subscription,
        usage,
        canUseFeature,
        hasReachedLimit,
        getRemainingQuota,
        isLoading,
    } = useSubscription();

    // Map features to their corresponding usage limit types
    const featureToUsageMap: Partial<Record<FeatureName, UsageLimitType>> = {
        receipt_ocr: 'receiptOCR',
        ai_chat: 'aiChat',
        ai_categorization: 'aiAnalysis',
    };

    const usageLimitType = featureToUsageMap[feature];

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Check if user can use the feature
    const hasAccess = canUseFeature(feature);

    // Check usage limits if applicable
    const isAtLimit = usageLimitType ? hasReachedLimit(usageLimitType) : false;
    const remainingQuota = usageLimitType ? getRemainingQuota(usageLimitType) : Infinity;
    const usageData = usageLimitType && usage ? usage[usageLimitType] : null;

    // Calculate usage percentage for warning
    const usagePercentage = usageData && usageData.limit > 0
        ? (usageData.used / usageData.limit) * 100
        : 0;
    const isNearLimit = usagePercentage >= 80 && usagePercentage < 100;

    // Feature display names
    const featureDisplayNames: Record<FeatureName, string> = {
        ai_categorization: 'AI Categorization',
        receipt_ocr: 'Receipt OCR',
        ai_chat: 'AI Chat',
        whatsapp_notifications: 'WhatsApp Notifications',
        export_data: 'Data Export',
        advanced_reports: 'Advanced Reports',
    };

    const featureName = featureDisplayNames[feature] || feature;

    // If user has reached usage limit
    if (hasAccess && isAtLimit) {
        if (fallback) {
            return <>{fallback}</>;
        }

        if (!showUpgradePrompt) {
            return null;
        }

        return (
            <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Usage Limit Reached</CardTitle>
                            <CardDescription>
                                You've used all {usageData?.limit} {featureName} credits this month
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Monthly Usage</span>
                            <span className="font-semibold text-slate-900">
                                {usageData?.used} / {usageData?.limit}
                            </span>
                        </div>
                        <Progress value={100} className="h-2" />
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-slate-700">
                            Upgrade your plan to get more {featureName} credits and unlock unlimited features
                        </AlertDescription>
                    </Alert>

                    <div className="flex gap-2">
                        <Button asChild className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                            <Link href="/pricing">
                                <TrendingUp className="h-4 w-4 mr-2" />
                                Upgrade Plan
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // If user doesn't have access to the feature
    if (!hasAccess) {
        if (fallback) {
            return <>{fallback}</>;
        }

        if (!showUpgradePrompt) {
            return null;
        }

        return (
            <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Lock className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Premium Feature</CardTitle>
                            <CardDescription>
                                {featureName} is not available in your current plan
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                                Current: {subscription?.planDisplayName || 'Free'}
                            </Badge>
                        </div>
                    </div>

                    <Alert className="bg-gradient-to-r from-blue-50 to-purple-50 border-purple-200">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <AlertDescription className="text-sm text-slate-700">
                            Upgrade to Premium or Business plan to unlock {featureName} and many more powerful features
                        </AlertDescription>
                    </Alert>

                    <div className="flex gap-2">
                        <Button asChild className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                            <Link href="/pricing">
                                <Sparkles className="h-4 w-4 mr-2" />
                                View Plans
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show warning if near limit (80% or more)
    if (hasAccess && isNearLimit && usageData) {
        return (
            <div className="space-y-3">
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Usage Warning</span>
                            <span className="text-xs font-semibold">
                                {remainingQuota} credits remaining
                            </span>
                        </div>
                        <Progress value={usagePercentage} className="h-1.5 mb-2" />
                        <p className="text-xs text-slate-600">
                            You've used {usageData.used} of {usageData.limit} {featureName} credits this month.
                            {' '}
                            <Link href="/pricing" className="text-blue-600 hover:underline font-medium">
                                Upgrade now
                            </Link>
                            {' '}to get more credits.
                        </p>
                    </AlertDescription>
                </Alert>
                {children}
            </div>
        );
    }

    // User has access and is not near limit - render children
    return <>{children}</>;
}
