import { prisma } from '../lib/prisma.js';
import type { DashboardSummaryDTO, ReallocationPreviewDTO, CategorySummary, SavingsHistoryDTO, SavingsPaceDTO } from '@budget/shared';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { buildCategorySummary, calculateTargets, isPastCutoffDay, roundCurrency } from '../lib/utils.js';
import { monthPeriodService } from './month-period.service.js';
import { budgetRuleService } from './budget-rule.service.js';
import { expenseService } from './expense.service.js';

export class DashboardService {
  /**
   * Get dashboard summary for a period (user-scoped)
   */
  async getSummary(periodKey: string, userId: string): Promise<DashboardSummaryDTO> {
    // Get or create period
    let monthPeriod = await monthPeriodService.getByPeriodKey(periodKey, userId);

    if (!monthPeriod) {
      // Auto-create if it's the current period
      const [year, month] = periodKey.split('-').map(Number);
      const now = new Date();
      const isCurrentPeriod = year === now.getFullYear() && month === now.getMonth() + 1;

      if (isCurrentPeriod) {
        monthPeriod = await monthPeriodService.getOrCreateCurrent(userId);
      } else {
        throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
      }
    }

    // Get budget rule (with defaults)
    let budgetRule = await budgetRuleService.getByPeriodKey(periodKey, userId);
    if (!budgetRule) {
      budgetRule = {
        id: '',
        monthPeriodId: monthPeriod.id,
        needsPct: DEFAULT_BUDGET_RULE.needsPct,
        wantsPct: DEFAULT_BUDGET_RULE.wantsPct,
        savingsPct: DEFAULT_BUDGET_RULE.savingsPct,
        cutoffDay: DEFAULT_BUDGET_RULE.cutoffDay,
        autoReallocateNeedsRemainder: DEFAULT_BUDGET_RULE.autoReallocateNeedsRemainder,
      };
    }

    // Get incomes (user-scoped)
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: {
        incomes: true,
        reallocations: true,
      },
    });

    const incomes = period?.incomes || [];
    const totalIncome = incomes.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0);

    // Calculate targets
    const targets = calculateTargets(
      totalIncome,
      budgetRule.needsPct,
      budgetRule.wantsPct,
      budgetRule.savingsPct
    );

    // Get expense totals by category (user-scoped)
    const expenseTotals = await expenseService.getTotalsByCategory(periodKey, userId);
    const totalSpent = expenseTotals.NEEDS + expenseTotals.WANTS + expenseTotals.SAVINGS;

    // Calculate reallocations impact (add to SAVINGS, subtract from NEEDS)
    const reallocations = period?.reallocations || [];
    const totalReallocatedToSavings = reallocations
      .filter((r: { toCategory: string }) => r.toCategory === 'SAVINGS')
      .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

    // Build category summaries
    const categories: CategorySummary[] = [
      buildCategorySummary('NEEDS', targets.needs, expenseTotals.NEEDS),
      buildCategorySummary('WANTS', targets.wants, expenseTotals.WANTS),
      // For savings, include reallocations in the "actual" amount as effective savings
      buildCategorySummary('SAVINGS', targets.savings, expenseTotals.SAVINGS + totalReallocatedToSavings),
    ];

    // Calculate reallocation preview
    const needsCategory = categories.find((c) => c.category === 'NEEDS')!;
    const wantsCategory = categories.find((c) => c.category === 'WANTS')!;
    const reallocationPreview = this.buildReallocationPreview(
      needsCategory.remaining,
      wantsCategory.remaining,
      budgetRule.cutoffDay,
      budgetRule.autoReallocateNeedsRemainder,
      periodKey
    );

    // Get all expenses for the period (user-scoped)
    const recentExpenses = await expenseService.getAllByPeriodKey(periodKey, userId);

    // Calculate unallocated income (income not assigned to any budget yet)
    // This is conceptual - in our model, all income is allocated by the percentages
    const unallocatedIncome = roundCurrency(totalIncome - (targets.needs + targets.wants + targets.savings));

    return {
      monthPeriod,
      budgetRule,
      totalIncome: roundCurrency(totalIncome),
      totalSpent: roundCurrency(totalSpent),
      unallocatedIncome: roundCurrency(unallocatedIncome),
      categories,
      reallocationPreview,
      recentExpenses,
    };
  }

  /**
   * Get savings history across all months for a user
   */
  async getSavingsHistory(currentPeriodKey: string, userId: string): Promise<SavingsHistoryDTO> {
    // Get all periods for this user, ordered chronologically
    const periods = await prisma.monthPeriod.findMany({
      where: { userId },
      include: {
        expenses: true,
        reallocations: true,
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const months = periods.map((period) => {
      const savingsExpenses = period.expenses
        .filter((e) => e.category === 'SAVINGS')
        .reduce((sum, e) => sum + e.amount, 0);

      const reallocatedToSavings = period.reallocations
        .filter((r) => r.toCategory === 'SAVINGS')
        .reduce((sum, r) => sum + r.amount, 0);

      return {
        periodKey: period.periodKey,
        month: period.month,
        year: period.year,
        savings: roundCurrency(savingsExpenses + reallocatedToSavings),
      };
    });

    const currentMonthData = months.find((m) => m.periodKey === currentPeriodKey);
    const currentMonthSavings = currentMonthData?.savings ?? 0;

    const previousMonthsTotal = roundCurrency(
      months
        .filter((m) => m.periodKey < currentPeriodKey)
        .reduce((sum, m) => sum + m.savings, 0)
    );

    const cumulativeTotal = roundCurrency(
      months.reduce((sum, m) => sum + m.savings, 0)
    );

    return {
      months,
      currentMonthSavings,
      previousMonthsTotal,
      cumulativeTotal,
    };
  }

  /**
   * Get savings pace for a period: compares outflows (NEEDS+WANTS) month-to-date
   * against the historical best-savings month's outflows up to the same day-of-month.
   * SAVINGS category is excluded — it represents money already set aside, not spending.
   */
  async getSavingsPace(currentPeriodKey: string, userId: string): Promise<SavingsPaceDTO> {
    const periods = await prisma.monthPeriod.findMany({
      where: { userId },
      include: {
        expenses: true,
        reallocations: true,
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const monthsSavings = periods.map((p) => {
      const savingsExpenses = p.expenses
        .filter((e) => e.category === 'SAVINGS')
        .reduce((sum, e) => sum + e.amount, 0);
      const reallocatedToSavings = p.reallocations
        .filter((r) => r.toCategory === 'SAVINGS')
        .reduce((sum, r) => sum + r.amount, 0);
      return {
        period: p,
        savings: roundCurrency(savingsExpenses + reallocatedToSavings),
      };
    });

    // asOfDay: today for the live calendar month, last day of that month for any other period
    const [currYear, currMonth] = currentPeriodKey.split('-').map(Number);
    const now = new Date();
    const isLiveCurrent = currYear === now.getFullYear() && currMonth === now.getMonth() + 1;
    const lastDayOfCurr = new Date(currYear, currMonth, 0).getDate();
    const asOfDay = isLiveCurrent ? now.getDate() : lastDayOfCurr;

    const candidates = monthsSavings.filter(
      (m) => m.period.periodKey !== currentPeriodKey && m.savings > 0
    );
    candidates.sort((a, b) => b.savings - a.savings);
    const best = candidates[0] ?? null;

    const currentPeriod = monthsSavings.find(
      (m) => m.period.periodKey === currentPeriodKey
    )?.period;

    const sumSpendUpToDay = (expenses: { category: string; amount: number; date: Date }[], day: number) =>
      expenses
        .filter((e) => e.category !== 'SAVINGS' && e.date.getDate() <= day)
        .reduce((sum, e) => sum + e.amount, 0);

    const currentSpendToDate = currentPeriod
      ? roundCurrency(sumSpendUpToDay(currentPeriod.expenses, asOfDay))
      : 0;

    const bestSpendToDate = best
      ? roundCurrency(sumSpendUpToDay(best.period.expenses, asOfDay))
      : 0;

    // 50 = tied with best month, 100 = spending 0, 0 = spending 2x or more.
    let performancePct = 50;
    if (best) {
      if (bestSpendToDate === 0) {
        performancePct = currentSpendToDate === 0 ? 50 : 0;
      } else {
        const deviation = (bestSpendToDate - currentSpendToDate) / bestSpendToDate;
        const capped = Math.max(-1, Math.min(1, deviation));
        performancePct = 50 + capped * 50;
      }
    }

    return {
      bestMonth: best
        ? {
            periodKey: best.period.periodKey,
            month: best.period.month,
            year: best.period.year,
            savings: best.savings,
          }
        : null,
      asOfDay,
      currentSpendToDate,
      bestSpendToDate,
      performancePct: Math.round(performancePct * 10) / 10,
      hasComparison: best !== null,
    };
  }

  private buildReallocationPreview(
    needsRemainder: number,
    wantsRemainder: number,
    cutoffDay: number,
    autoReallocate: boolean,
    periodKey: string
  ): ReallocationPreviewDTO {
    const isAfterCutoff = isPastCutoffDay(cutoffDay, periodKey);
    const totalRemainder = Math.max(0, needsRemainder) + Math.max(0, wantsRemainder);
    const available = totalRemainder > 0 && (autoReallocate || isAfterCutoff);

    return {
      available,
      needsRemainder: roundCurrency(Math.max(0, needsRemainder)),
      wantsRemainder: roundCurrency(Math.max(0, wantsRemainder)),
      suggestedAmount: available ? roundCurrency(totalRemainder) : 0,
      cutoffDay,
      isAfterCutoff,
    };
  }
}

export const dashboardService = new DashboardService();
