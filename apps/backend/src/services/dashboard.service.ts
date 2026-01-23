import { prisma } from '../lib/prisma.js';
import type { DashboardSummaryDTO, ReallocationPreviewDTO, CategorySummary } from '@budget/shared';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { buildCategorySummary, calculateTargets, isPastCutoffDay, roundCurrency } from '../lib/utils.js';
import { monthPeriodService } from './month-period.service.js';
import { budgetRuleService } from './budget-rule.service.js';
import { expenseService } from './expense.service.js';

export class DashboardService {
  /**
   * Get dashboard summary for a period
   */
  async getSummary(periodKey: string): Promise<DashboardSummaryDTO> {
    // Get or create period
    let monthPeriod = await monthPeriodService.getByPeriodKey(periodKey);

    if (!monthPeriod) {
      // Auto-create if it's the current period
      const [year, month] = periodKey.split('-').map(Number);
      const now = new Date();
      const isCurrentPeriod = year === now.getFullYear() && month === now.getMonth() + 1;

      if (isCurrentPeriod) {
        monthPeriod = await monthPeriodService.getOrCreateCurrent();
      } else {
        throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
      }
    }

    // Get budget rule (with defaults)
    let budgetRule = await budgetRuleService.getByPeriodKey(periodKey);
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

    // Get incomes
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
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

    // Get expense totals by category
    const expenseTotals = await expenseService.getTotalsByCategory(periodKey);
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

    // Get all expenses for the period
    const recentExpenses = await expenseService.getAllByPeriodKey(periodKey);

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
