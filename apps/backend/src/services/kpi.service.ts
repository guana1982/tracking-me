import { prisma } from '../lib/prisma.js';
import type { KpiPanelDTO, CashFlowCheckDTO, CashFlowColumnDTO } from '@budget/shared';
import { getCurrentPeriodKey, roundCurrency } from '../lib/utils.js';
import { cashFlowService } from './cashflow.service.js';

// How many completed periods feed the trailing averages (savings rate, fixed
// cost ratio, average monthly spend)
const TRAILING_PERIODS = 6;
// Minimum distance between two checks to annualize net worth growth
const MIN_GROWTH_DAYS = 60;

type PeriodTotals = {
  periodKey: string;
  income: number;
  realSavings: number; // SAVINGS + reallocations to SAVINGS − EXTRA
  fixedSpend: number; // isFixed NEEDS+WANTS
  totalSpend: number; // NEEDS+WANTS+EXTRA (SAVINGS excluded: it's set aside, not spent)
};

export class KpiService {
  /**
   * CFO-style KPI panel for a period. Budget KPIs come from the month periods;
   * wealth KPIs come from the cash-flow checks. Liquidity and invested share
   * use the cash-flow classifications named "Liquid…" / "Invest…" when present.
   */
  async getKpis(periodKey: string, userId: string): Promise<KpiPanelDTO> {
    const [totals, checks, columns, classifications] = await Promise.all([
      this.loadPeriodTotals(userId),
      cashFlowService.getAllByUser(userId), // ordered by date desc
      cashFlowService.getColumns(userId),
      cashFlowService.getClassifications(userId),
    ]);

    // ── Budget KPIs ──────────────────────────────────────────────
    const current = totals.find((t) => t.periodKey === periodKey) ?? null;
    const livePeriodKey = getCurrentPeriodKey();
    const completed = totals
      .filter((t) => t.periodKey < livePeriodKey)
      .sort((a, b) => (a.periodKey < b.periodKey ? -1 : 1))
      .slice(-TRAILING_PERIODS);
    const completedWithIncome = completed.filter((t) => t.income > 0);

    const ratio = (num: number, den: number): number | null =>
      den > 0 ? roundCurrency((num / den) * 100) : null;
    const average = (values: number[]): number | null =>
      values.length > 0
        ? roundCurrency(values.reduce((sum, v) => sum + v, 0) / values.length)
        : null;

    const savingsRatePct = current ? ratio(current.realSavings, current.income) : null;
    const savingsRateAvgPct = average(
      completedWithIncome.map((t) => (t.realSavings / t.income) * 100)
    );
    const fixedCostRatioPct = current ? ratio(current.fixedSpend, current.income) : null;
    const fixedCostRatioAvgPct = average(
      completedWithIncome.map((t) => (t.fixedSpend / t.income) * 100)
    );
    const avgMonthlySpend = average(completed.map((t) => t.totalSpend));

    // ── Wealth KPIs (cash-flow checks) ───────────────────────────
    const activeKeys = new Set(
      columns.filter((c: CashFlowColumnDTO) => c.isActive).map((c: CashFlowColumnDTO) => c.key)
    );
    const sumKeys = (check: CashFlowCheckDTO, keys: Set<string>): number =>
      Object.entries(check.values)
        .filter(([key]) => keys.has(key))
        .reduce((sum, [, value]) => sum + value, 0);
    const checkTotal = (check: CashFlowCheckDTO): number => sumKeys(check, activeKeys);

    const latest = checks[0] ?? null;
    const netWorth = latest ? roundCurrency(checkTotal(latest)) : null;

    // Classifications: match by label so the user controls the mapping from the app
    const findClassificationKeys = (pattern: RegExp): Set<string> | null => {
      const match = classifications.find((c) => pattern.test(c.label));
      return match && match.columnKeys.length > 0 ? new Set(match.columnKeys) : null;
    };
    const liquidKeys = findClassificationKeys(/liquid/i);
    const investedKeys = findClassificationKeys(/invest/i);

    let liquidity: number | null = null;
    let liquiditySource: 'classification' | 'total' | null = null;
    if (latest) {
      if (liquidKeys) {
        liquidity = roundCurrency(sumKeys(latest, liquidKeys));
        liquiditySource = 'classification';
      } else {
        liquidity = netWorth;
        liquiditySource = 'total';
      }
    }

    const investedSharePct =
      latest && investedKeys && netWorth && netWorth > 0
        ? roundCurrency((sumKeys(latest, investedKeys) / netWorth) * 100)
        : null;

    const runwayMonths =
      liquidity !== null && avgMonthlySpend !== null && avgMonthlySpend > 0
        ? Math.round((liquidity / avgMonthlySpend) * 10) / 10
        : null;

    // Annualized growth: latest vs the oldest check at least MIN_GROWTH_DAYS back
    let netWorthGrowthAnnualPct: number | null = null;
    if (latest && netWorth !== null && netWorth > 0) {
      const oldest = [...checks].reverse().find((check) => {
        const days = this.daysBetween(new Date(check.date), new Date(latest.date));
        return days >= MIN_GROWTH_DAYS;
      });
      if (oldest) {
        const oldTotal = checkTotal(oldest);
        const days = this.daysBetween(new Date(oldest.date), new Date(latest.date));
        if (oldTotal > 0 && days > 0) {
          netWorthGrowthAnnualPct = roundCurrency(
            (Math.pow(netWorth / oldTotal, 365 / days) - 1) * 100
          );
        }
      }
    }

    return {
      periodKey,
      savingsRatePct,
      savingsRateAvgPct,
      fixedCostRatioPct,
      fixedCostRatioAvgPct,
      runwayMonths,
      liquidity,
      liquiditySource,
      avgMonthlySpend,
      netWorth,
      netWorthDate: latest?.date ?? null,
      netWorthGrowthAnnualPct,
      investedSharePct,
      hasChecks: checks.length > 0,
    };
  }

  private async loadPeriodTotals(userId: string): Promise<PeriodTotals[]> {
    const periods = await prisma.monthPeriod.findMany({
      where: { userId },
      include: { incomes: true, expenses: true, reallocations: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    return periods.map((period: (typeof periods)[number]) => {
      const income = period.incomes.reduce(
        (sum: number, i: { amount: number }) => sum + i.amount,
        0
      );
      const sumBy = (predicate: (e: { category: string; amount: number; isFixed: boolean }) => boolean) =>
        period.expenses
          .filter(predicate)
          .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

      const savingsExpenses = sumBy((e) => e.category === 'SAVINGS');
      const extraSpent = sumBy((e) => e.category === 'EXTRA');
      const reallocatedToSavings = period.reallocations
        .filter((r: { toCategory: string }) => r.toCategory === 'SAVINGS')
        .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

      return {
        periodKey: period.periodKey,
        income,
        realSavings: savingsExpenses + reallocatedToSavings - extraSpent,
        fixedSpend: sumBy(
          (e) => e.isFixed && (e.category === 'NEEDS' || e.category === 'WANTS')
        ),
        totalSpend: sumBy((e) => e.category !== 'SAVINGS'),
      };
    });
  }

  private daysBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }
}

export const kpiService = new KpiService();
