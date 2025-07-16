import { useQuery } from '@tanstack/react-query';
import { getUserCurrency } from '@/lib/currencyUtils';

/**
 * Custom hook to get user currency preferences
 * Returns the user's preferred currency with a consistent fallback
 */
export function useUserCurrency() {
  const { data: userPreferences, isLoading } = useQuery({
    queryKey: ["/api/user/preferences"],
    enabled: true,
  });

  const currency = getUserCurrency(userPreferences);

  return {
    currency,
    userPreferences,
    isLoading
  };
}
