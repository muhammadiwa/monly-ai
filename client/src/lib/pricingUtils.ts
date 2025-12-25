/**
 * Calculate yearly savings percentage
 * Formula: ((monthlyPrice * 12) - yearlyPrice) / (monthlyPrice * 12) * 100
 * 
 * This function implements Property 3: Savings Calculation Accuracy
 * Validates: Requirements 1.4
 */
export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
    if (monthlyPrice <= 0) return 0;

    const yearlyFromMonthly = monthlyPrice * 12;
    if (yearlyPrice >= yearlyFromMonthly) return 0;

    const savings = ((yearlyFromMonthly - yearlyPrice) / yearlyFromMonthly) * 100;
    return Math.round(savings);
}
