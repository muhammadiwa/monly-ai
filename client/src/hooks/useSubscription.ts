import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type FeatureName =
    | 'ai_categorization'
    | 'receipt_ocr'
    | 'ai_chat'
    | 'whatsapp_notifications'
    | 'export_data'
    | 'advanced_reports';

export type ResourceLimitType = 'budgets' | 'goals' | 'transactions';

interface UsageStats {
    receiptOCR: { used: number; limit: number };
    aiChat: { used: number; limit: number };
    aiAnalysis: { used: number; limit: number };
}

interface ResourceLimit {
    allowed: boolean;
    limit: number;
    current: number;
}

interface ResourceLimits {
    budgets: ResourceLimit;
    goals: ResourceLimit;
    transactions: ResourceLimit;
}

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
}

interface UserSubscription {
    id: number | null;
    planName: string;
    planDisplayName: string;
    status: 'active' | 'expired' | 'cancelled' | 'pending' | 'free';
    billingCycle: 'monthly' | 'yearly' | null;
    startDate: number | null;
    endDate: number | null;
    autoRenew: boolean;
    features: string[];
    limits: PlanLimits;
    usage?: UsageStats;
}

export type UsageLimitType = keyof UsageStats;

interface UseSubscriptionReturn {
    subscription: UserSubscription | null;
    usage: UsageStats | null;
    resourceLimits: ResourceLimits | null;
    canUseFeature: (feature: FeatureName) => boolean;
    hasReachedLimit: (limitType: UsageLimitType) => boolean;
    hasReachedResourceLimit: (resourceType: ResourceLimitType) => boolean;
    getRemainingQuota: (limitType: UsageLimitType) => number;
    getResourceLimit: (resourceType: ResourceLimitType) => ResourceLimit | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook for managing subscription and usage data
 */
export function useSubscription(): UseSubscriptionReturn {
    // Fetch current subscription
    const {
        data: subscriptionResponse,
        isLoading: subscriptionLoading,
        error: subscriptionError,
        refetch: refetchSubscription,
    } = useQuery({
        queryKey: ['/api/subscription/current'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/current');
            if (!response.ok) throw new Error('Failed to fetch subscription');
            return response.json();
        },
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    // Fetch usage stats
    const {
        data: usageResponse,
        isLoading: usageLoading,
        error: usageError,
        refetch: refetchUsage,
    } = useQuery({
        queryKey: ['/api/subscription/usage'],
        queryFn: async () => {
            const response = await apiRequest('GET', '/api/subscription/usage');
            if (!response.ok) throw new Error('Failed to fetch usage');
            return response.json();
        },
        staleTime: 1 * 60 * 1000,
        retry: 1,
    });

    const subscription: UserSubscription | null = subscriptionResponse?.data || null;
    const usage: UsageStats | null = usageResponse?.data || subscription?.usage || null;
    const resourceLimits: ResourceLimits | null = usageResponse?.data?.resourceLimits || null;

    const isLoading = subscriptionLoading || usageLoading;
    const error = subscriptionError || usageError;

    /**
     * Check if user can use a specific feature based on their plan limits
     * Only active subscriptions can use premium features
     */
    const canUseFeature = (feature: FeatureName): boolean => {
        if (!subscription) return false;

        // Only active or free status can use features
        // pending, expired, cancelled subscriptions cannot use premium features
        if (subscription.status !== 'active' && subscription.status !== 'free') {
            // For pending/expired/cancelled, check if it's a free-tier feature
            // Free plan has aiChat: 0, receiptOCR: 0, etc.
            return false;
        }

        const limits = subscription.limits;

        switch (feature) {
            case 'ai_categorization':
                return limits.aiAnalysis > 0 || limits.aiAnalysis === -1;

            case 'receipt_ocr':
                return limits.receiptOCR > 0 || limits.receiptOCR === -1;

            case 'ai_chat':
                return limits.aiChat > 0 || limits.aiChat === -1;

            case 'whatsapp_notifications':
                return Boolean(limits.whatsappNotifications);

            case 'export_data':
                return Boolean(limits.exportData);

            case 'advanced_reports':
                return Boolean(limits.advancedReports);

            default:
                return false;
        }
    };

    /**
     * Check if user has reached the limit for a specific usage type (AI features)
     */
    const hasReachedLimit = (limitType: UsageLimitType): boolean => {
        if (!usage) return false;

        const usageData = usage[limitType];
        if (!usageData) return false;

        if (usageData.limit === -1) return false;

        return usageData.used >= usageData.limit;
    };

    /**
     * Check if user has reached resource limit (budgets/goals/transactions)
     */
    const hasReachedResourceLimit = (resourceType: ResourceLimitType): boolean => {
        if (!resourceLimits) return false;

        const limit = resourceLimits[resourceType];
        if (!limit) return false;

        return !limit.allowed;
    };

    /**
     * Get remaining quota for a specific usage type
     */
    const getRemainingQuota = (limitType: UsageLimitType): number => {
        if (!usage) return 0;

        const usageData = usage[limitType];
        if (!usageData) return 0;

        if (usageData.limit === -1) return Infinity;

        const remaining = usageData.limit - usageData.used;
        return Math.max(0, remaining);
    };

    /**
     * Get resource limit info
     */
    const getResourceLimit = (resourceType: ResourceLimitType): ResourceLimit | null => {
        if (!resourceLimits) return null;
        return resourceLimits[resourceType] || null;
    };

    const refetch = () => {
        refetchSubscription();
        refetchUsage();
    };

    return {
        subscription,
        usage,
        resourceLimits,
        canUseFeature,
        hasReachedLimit,
        hasReachedResourceLimit,
        getRemainingQuota,
        getResourceLimit,
        isLoading,
        error: error as Error | null,
        refetch,
    };
}
