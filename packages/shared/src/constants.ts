// Budget categories
export const CATEGORIES = ['NEEDS', 'WANTS', 'SAVINGS'] as const;
export type Category = (typeof CATEGORIES)[number];

// Default budget rule percentages
export const DEFAULT_BUDGET_RULE = {
  needsPct: 65,
  wantsPct: 25,
  savingsPct: 10,
  cutoffDay: 26,
  autoReallocateNeedsRemainder: true,
} as const;

// Warning thresholds (percentage of budget used)
export const WARNING_THRESHOLDS = {
  WARNING: 80, // Yellow warning at 80%
  DANGER: 100, // Red at 100%
} as const;

// Currency
export const CURRENCY = 'EUR';
export const CURRENCY_SYMBOL = '€';
export const LOCALE = 'it-IT';

// Date format
export const MONTH_FORMAT = 'yyyy-MM';
