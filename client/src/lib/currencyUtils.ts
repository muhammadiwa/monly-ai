// Currency utility functions

// Default currency fallback
export const DEFAULT_CURRENCY = 'IDR';

// Get user currency from preferences with consistent fallback
export function getUserCurrency(userPreferences: any): string {
  return userPreferences?.defaultCurrency || DEFAULT_CURRENCY;
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'IDR': 'Rp',
    'CNY': '¥',
    'KRW': '₩',
    'SGD': 'S$',
    'MYR': 'RM',
    'THB': '฿',
    'VND': '₫'
  };
  return symbols[currency] || currency;
}

export function formatCurrency(amount: number | null | undefined, currency: string): string {
  // Handle null, undefined, or invalid numbers
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    amount = 0;
  }
  
  // Ensure amount is a number
  const numAmount = Number(amount);
  
  const symbol = getCurrencySymbol(currency);
  
  // Special formatting for IDR (no decimals, add thousands separator)
  if (currency === 'IDR') {
    return `${symbol} ${numAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
  }
  
  // Default formatting for other currencies
  return `${symbol}${numAmount.toLocaleString('en-US', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  })}`;
}
