import { prisma } from '../lib/prisma.js';
import type { DashboardSummaryDTO, ReallocationPreviewDTO, CategorySummary, SavingsHistoryDTO } from '@budget/shared';
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
    const reallocationPreview = this.buildReallocationPreview(
      needsCategory.remaining,
      budgetRule.cutoffDay,
      budgetRule.autoReallocateNeedsRemainder
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

  private buildReallocationPreview(
    needsRemainder: number,
    cutoffDay: number,
    autoReallocate: boolean
  ): ReallocationPreviewDTO {
    const isAfterCutoff = isPastCutoffDay(cutoffDay);
    const available = needsRemainder > 0 && (autoReallocate || isAfterCutoff);

    return {
      available,
      needsRemainder: roundCurrency(Math.max(0, needsRemainder)),
      suggestedAmount: available ? roundCurrency(needsRemainder) : 0,
      cutoffDay,
      isAfterCutoff,
    };
  }
}

export const dashboardService = new DashboardService();
