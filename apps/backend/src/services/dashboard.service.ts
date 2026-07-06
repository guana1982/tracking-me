import { prisma } from '../lib/prisma.js';
import type { DashboardSummaryDTO, ReallocationPreviewDTO, CategorySummary, SavingsHistoryDTO, SavingsPaceDTO } from '@budget/shared';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { adjustCutoffDayForWeekend, buildCategorySummary, calculateTargets, isPastCutoffDay, roundCurrency } from '../lib/utils.js';
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
    // EXTRA is tracked separately and never enters totalSpent or the category summaries
    const expenseTotals = await expenseService.getTotalsByCategory(periodKey, userId);
    const totalSpent = expenseTotals.NEEDS + expenseTotals.WANTS + expenseTotals.SAVINGS;
    const extraSpent = expenseTotals.EXTRA;

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

    // Calculate reallocation preview, net of reallocations already executed
    // from each source category so the same remainder can't be transferred twice
    const needsCategory = categories.find((c) => c.category === 'NEEDS')!;
    const wantsCategory = categories.find((c) => c.category === 'WANTS')!;
    const sumReallocatedFrom = (category: string) =>
      reallocations
        .filter((r: { fromCategory: string }) => r.fromCategory === category)
        .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);
    const reallocationPreview = this.buildReallocationPreview(
      needsCategory.remaining - sumReallocatedFrom('NEEDS'),
      wantsCategory.remaining - sumReallocatedFrom('WANTS'),
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
      extraSpent: roundCurrency(extraSpent),
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

      // SAVINGS transfers stay liquid on the savings account: money spent from
      // there (EXTRA) is no longer saved, so net it out to get real savings
      const extraSpent = period.expenses
        .filter((e) => e.category === 'EXTRA')
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        periodKey: period.periodKey,
        month: period.month,
        year: period.year,
        savings: roundCurrency(savingsExpenses + reallocatedToSavings - extraSpent),
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
   * Get savings pace for a period.
   * Works on the pay-cycle, not the calendar month: the "April" cycle runs from the
   * day after March's payday up to April's payday (both weekend-adjusted). Expenses
   * made after April's payday belong to May's cycle.
   * Primary metric: linear run-rate projection of NEEDS+WANTS spending to end of
   * cycle, compared against the budget target (income × (needsPct+wantsPct)).
   * Secondary metric: comparison against the historical month with the best
   * savings-rate at the equivalent cycle-progress.
   * NOTE: DTO fields keep legacy names — `daysElapsed` = days elapsed in cycle,
   * `effectiveCutoffDay` = total cycle length in days (frontend shows "Giorno X/Y").
   * SAVINGS category is excluded from spending — it's already set aside.
   */
  async getSavingsPace(currentPeriodKey: string, userId: string): Promise<SavingsPaceDTO> {
    const periods = await prisma.monthPeriod.findMany({
      where: { userId },
      include: {
        expenses: true,
        reallocations: true,
        incomes: true,
        budgetRule: true,
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const months = periods.map((p) => {
      const income = p.incomes.reduce((sum, i) => sum + i.amount, 0);
      const savingsExpenses = p.expenses
        .filter((e) => e.category === 'SAVINGS')
        .reduce((sum, e) => sum + e.amount, 0);
      const reallocatedToSavings = p.reallocations
        .filter((r) => r.toCategory === 'SAVINGS')
        .reduce((sum, r) => sum + r.amount, 0);
      // Net of EXTRA: money spent from the savings account is not saved
      const extraSpent = p.expenses
        .filter((e: { category: string }) => e.category === 'EXTRA')
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);
      const savings = savingsExpenses + reallocatedToSavings - extraSpent;
      const savingsRate = income > 0 ? savings / income : 0;
      return { period: p, income, savings, savingsRate };
    });

    const [currYear, currMonth] = currentPeriodKey.split('-').map(Number);
    const now = new Date();

    const currentData = months.find((m) => m.period.periodKey === currentPeriodKey);
    const currentPeriod = currentData?.period;
    const currentIncome = currentData?.income ?? 0;

    const needsPct = currentPeriod?.budgetRule?.needsPct ?? DEFAULT_BUDGET_RULE.needsPct;
    const wantsPct = currentPeriod?.budgetRule?.wantsPct ?? DEFAULT_BUDGET_RULE.wantsPct;
    const nominalCutoffDay = currentPeriod?.budgetRule?.cutoffDay ?? DEFAULT_BUDGET_RULE.cutoffDay;
    const livePeriodKey = this.getPeriodKeyForDate(now, nominalCutoffDay);
    const isLiveCurrent = currentPeriodKey === livePeriodKey;

    const prevCutoff = this.findPrevPeriodCutoff(months, currYear, currMonth);
    const cycleStart = this.computeCycleStart(currYear, currMonth, prevCutoff);
    const cycleEnd = this.computeCycleEnd(currYear, currMonth, nominalCutoffDay);
    const cycleLengthDays = this.daysBetween(cycleStart, cycleEnd) + 1;

    const elapsedSoFar = isLiveCurrent ? this.daysBetween(cycleStart, now) + 1 : cycleLengthDays;
    const daysInCycleElapsed = Math.min(Math.max(1, elapsedSoFar), cycleLengthDays);
    const progressRatio = daysInCycleElapsed / cycleLengthDays;

    const sumPeriodSpend = (
      expenses: { category: string; amount: number; isFixed?: boolean }[],
      fixedOnly?: boolean
    ) =>
      expenses
        .filter((e) => e.category !== 'SAVINGS' && e.category !== 'EXTRA')
        .filter((e) => fixedOnly === undefined || Boolean(e.isFixed) === fixedOnly)
        .reduce((sum, e) => sum + e.amount, 0);

    const fixedSpend = currentPeriod ? sumPeriodSpend(currentPeriod.expenses, true) : 0;
    const variableSpendToDate = currentPeriod ? sumPeriodSpend(currentPeriod.expenses, false) : 0;
    const currentSpendToDate = roundCurrency(fixedSpend + variableSpendToDate);

    const projectedMonthlySpend =
      daysInCycleElapsed > 0
        ? roundCurrency(fixedSpend + (variableSpendToDate / daysInCycleElapsed) * cycleLengthDays)
        : 0;

    const budgetTarget = roundCurrency((currentIncome * (needsPct + wantsPct)) / 100);

    // performancePct: 50 = projected exactly at target; 100 = zero projected spend; 0 = 2× target or worse
    let performancePct = 50;
    if (budgetTarget > 0) {
      const deviation = (budgetTarget - projectedMonthlySpend) / budgetTarget;
      const capped = Math.max(-1, Math.min(1, deviation));
      performancePct = 50 + capped * 50;
    } else {
      performancePct = projectedMonthlySpend === 0 ? 50 : 0;
    }

    const candidates = months.filter(
      (m) =>
        m.period.periodKey !== currentPeriodKey &&
        m.income > 0 &&
        m.savingsRate > 0
    );
    candidates.sort((a, b) => b.savingsRate - a.savingsRate);
    const best = candidates[0] ?? null;

    let bestSpendAtSameProgress = 0;
    if (best) {
      const bestTotalSpend = sumPeriodSpend(best.period.expenses);
      bestSpendAtSameProgress = roundCurrency(
        bestTotalSpend * progressRatio
      );
    }

    return {
      daysElapsed: daysInCycleElapsed,
      effectiveCutoffDay: cycleLengthDays,
      nominalCutoffDay,
      currentSpendToDate,
      projectedMonthlySpend,
      budgetTarget,
      performancePct: Math.round(performancePct * 10) / 10,
      bestMonth: best
        ? {
            periodKey: best.period.periodKey,
            month: best.period.month,
            year: best.period.year,
            income: roundCurrency(best.income),
            savings: roundCurrency(best.savings),
            savingsRate: Math.round(best.savingsRate * 1000) / 1000,
          }
        : null,
      bestSpendAtSameProgress,
      hasComparison: best !== null,
    };
  }

  private findPrevPeriodCutoff(
    months: { period: { year: number; month: number; budgetRule: { cutoffDay: number } | null } }[],
    year: number,
    month: number
  ): number {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prev = months.find(
      (m) => m.period.year === prevYear && m.period.month === prevMonth
    );
    return prev?.period.budgetRule?.cutoffDay ?? DEFAULT_BUDGET_RULE.cutoffDay;
  }

  private computeCycleStart(year: number, month: number, prevNominalCutoff: number): Date {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevAdjusted = adjustCutoffDayForWeekend(prevYear, prevMonth, prevNominalCutoff);
    // Day after previous payday; Date constructor handles end-of-month overflow.
    return new Date(prevYear, prevMonth - 1, prevAdjusted + 1);
  }

  private computeCycleEnd(year: number, month: number, nominalCutoff: number): Date {
    const adjusted = adjustCutoffDayForWeekend(year, month, nominalCutoff);
    return new Date(year, month - 1, adjusted, 23, 59, 59, 999);
  }

  private daysBetween(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / 86400000);
  }

  private getPeriodKeyForDate(date: Date, nominalCutoff: number): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const adjusted = adjustCutoffDayForWeekend(year, month, nominalCutoff);

    if (date.getDate() > adjusted) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
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
