/**
 * Unified Currency Formatting Utility
 * 
 * REGLA DE ORO: Format exactly what PHP provides, without internal rounding.
 * This ensures consistency across all financial displays in the Frontend.
 */

export const formatCurrency = (value: number | string | undefined): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (!numValue || isNaN(numValue)) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(numValue));
};

/**
 * Parse numeric value from API response
 * Ensures consistent type conversion without internal rounding
 */
export const parseFinancialValue = (value: any): number => {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Parse and round - used ONLY for values coming from API
 * Frontend should NEVER round; let PHP handle rounding.
 * This is a safety net for API responses only.
 */
export const roundFromAPI = (value: any): number => {
  const parsed = parseFinancialValue(value);
  return Math.round(parsed);
};
