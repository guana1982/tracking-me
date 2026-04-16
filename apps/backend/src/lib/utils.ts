import { DEFAULT_BUDGET_RULE, WARNING_THRESHOLDS } from '@budget/shared';
import type { CategorySummary, Category } from '@budget/shared';

/**
 * Generate period key from year and month (YYYY-MM format)
 */
export function generatePeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Parse period key to year and month
 */
export function parsePeriodKey(periodKey: string): { year: number; month: number } {
  const [year, month] = periodKey.split('-').map(Number);
  return { year, month };
}

/**
 * Get current period key
 */
export function getCurrentPeriodKey(): string {
  const now = new Date();
  return generatePeriodKey(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Calculate budget targets based on income and percentages
 */
export function calculateTargets(
  totalIncome: number,
  needsPct: number,
  wantsPct: number,
  savingsPct: number
): { needs: number; wants: number; savings: number } {
  return {
    needs: (totalIncome * needsPct) / 100,
    wants: (totalIncome * wantsPct) / 100,
    savings: (totalIncome * savingsPct) / 100,
  };
}

/**
 * Determine status based on spending percentage
 */
export function getSpendingStatus(percentage: number): 'ok' | 'warning' | 'danger' {
  if (percentage >= WARNING_THRESHOLDS.DANGER) return 'danger';
  if (percentage >= WARNING_THRESHOLDS.WARNING) return 'warning';
  return 'ok';
}

/**
 * Build category summary
 */
export function buildCategorySummary(
  category: Category,
  targetAmount: number,
  actualAmount: number
): CategorySummary {
  const remaining = targetAmount - actualAmount;
  const percentage = targetAmount > 0 ? (actualAmount / targetAmount) * 100 : 0;

  return {
    category,
    targetAmount: Math.round(targetAmount * 100) / 100,
    actualAmount: Math.round(actualAmount * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    status: getSpendingStatus(percentage),
  };
}

/**
 * Check if we're past the cutoff day for reallocation
 * - For current month: check if today >= cutoffDay
 * - For past months: always true (can reallocate)
 * - For future months: always false (can't reallocate yet)
 */
export function isPastCutoffDay(cutoffDay: number, periodKey: string): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const today = now.getDate();

  const { year: periodYear, month: periodMonth } = parsePeriodKey(periodKey);

  // Future month - can't reallocate yet
  if (periodYear > currentYear || (periodYear === currentYear && periodMonth > currentMonth)) {
    return false;
  }

  // Past month - can always reallocate
  if (periodYear < currentYear || (periodYear === currentYear && periodMonth < currentMonth)) {
    return true;
  }

  // Current month - check if past cutoff day
  return today >= cutoffDay;
}

/**
 * Round to 2 decimal places
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Adjust a nominal payday (e.g. cutoffDay from BudgetRule) for weekends.
 * Payday logic: if the nominal day falls on Saturday → previous Friday;
 * on Sunday → previous Friday. Otherwise keep the nominal day.
 * Always clamped to [1, daysInMonth].
 */
export function adjustCutoffDayForWeekend(year: number, month: number, nominalDay: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const clamped = Math.min(Math.max(1, nominalDay), daysInMonth);
  const dow = new Date(year, month - 1, clamped).getDay();
  if (dow === 0) return Math.max(1, clamped - 2); // Sunday → Friday
  if (dow === 6) return Math.max(1, clamped - 1); // Saturday → Friday
  return clamped;
}
