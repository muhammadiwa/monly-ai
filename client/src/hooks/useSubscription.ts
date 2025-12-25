import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type FeatureName =
    | 'ai_categorization'
    | 'receipt_ocr'
    | 'ai_chat'
    | 'whatsapp_notifications'
    | 'export_data'
    | 'advanced_reports'
    | 'api_access'
    | 'custom_reports';

interface UsageStats {
    receiptOCR: { used: number; limit: number };
    aiChat: { used: number; limit: number };
    aiAnalysis: { used: number; limit: number };
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
    apiAccess?: boolean;
    customReports?: boolean;
    dedicatedSupport?: boolean;
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
    canUseFeature: (feature: FeatureName) => boolean;
    hasReachedLimit: (limitType: UsageLimitType) => boolean;
    getRemainingQuota: (limitType: UsageLimitType) => number;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook for managing subscription and usage data
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
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
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
        staleTime: 1 * 60 * 1000, // Cache for 1 minute (usage changes more frequently)
        retry: 1,
    });

    const subscription: UserSubscription | null = subscriptionResponse?.data || null;
    const usage: UsageStats | null = usageResponse?.data || subscription?.usage || null;

    const isLoading = subscriptionLoading || usageLoading;
    const error = subscriptionError || usageError;

    /**
     * Check if user can use a specific feature based on their plan
     * Requirements: 5.2, 5.3, 5.7
     */
    const canUseFeature = (feature: FeatureName): boolean => {
        if (!subscription) return false;

        const limits = subscription.limits;

        switch (feature) {
            case 'ai_categorization':
                // AI categorization requires Premium or Business plan
                return subscription.planName !== 'free';

            case 'receipt_ocr':
                // Check if OCR is available and not at limit
                return limits.receiptOCR > 0 || limits.receiptOCR === -1;

            case 'ai_chat':
                // Check if AI chat is available and not at limit
                return limits.aiChat > 0 || limits.aiChat === -1;

            case 'whatsapp_notifications':
                return Boolean(limits.whatsappNotifications);

            case 'export_data':
                return Boolean(limits.exportData);

            case 'advanced_reports':
                return Boolean(limits.advancedReports);

            case 'api_access':
                return Boolean(limits.apiAccess);

            case 'custom_reports':
                return Boolean(limits.customReports);

            default:
                return false;
        }
    };

    /**
     * Check if user has reached the limit for a specific usage type
     * Requirements: 5.1, 5.4
     */
    const hasReachedLimit = (limitType: UsageLimitType): boolean => {
        if (!subscription || !usage) return false;

        const usageData = usage[limitType];
        if (!usageData) return false;

        // -1 means unlimited
        if (usageData.limit === -1) return false;

        // Check if used >= limit
        return usageData.used >= usageData.limit;
    };

    /**
     * Get remaining quota for a specific usage type
     * Requirements: 5.5, 5.6
     */
    const getRemainingQuota = (limitType: UsageLimitType): number => {
        if (!subscription || !usage) return 0;

        const usageData = usage[limitType];
        if (!usageData) return 0;

        // -1 means unlimited
        if (usageData.limit === -1) return Infinity;

        // Calculate remaining
        const remaining = usageData.limit - usageData.used;
        return Math.max(0, remaining);
    };

    /**
     * Refetch both subscription and usage data
     */
    const refetch = () => {
        refetchSubscription();
        refetchUsage();
    };

    return {
        subscription,
        usage,
        canUseFeature,
        hasReachedLimit,
        getRemainingQuota,
        isLoading,
        error: error as Error | null,
        refetch,
    };
}
