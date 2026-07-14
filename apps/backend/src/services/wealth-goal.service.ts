import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { roundCurrency } from '../lib/utils.js';
import { cashFlowService } from './cashflow.service.js';
import { buildCheckValuation } from '../lib/check-valuation.js';
import type {
  WealthGoalDTO,
  WealthGoalStatsDTO,
  WealthGoalStatus,
  WealthGoalHistoryPointDTO,
  CreateWealthGoalDTO,
  UpdateWealthGoalDTO,
} from '@budget/shared';

// Cap on projected months so an almost-flat pace doesn't produce absurd ETAs
const MAX_PROJECTED_MONTHS = 600;

export class WealthGoalService {
  /**
   * All goals with computed stats. The wealth series is the net total of the
   * cash-flow checks (same valuation as the page/KPI); one point per calendar
   * month (the last check of the month wins). Projections use the MEDIAN
   * month-over-month delta — robust to one-off jumps like account splits —
   * plus a P25/P75 band instead of a single falsely-precise date.
   */
  async getAll(userId: string): Promise<WealthGoalDTO[]> {
    const goals = await prisma.wealthGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (goals.length === 0) return [];

    const [checks, columns, settings] = await Promise.all([
      cashFlowService.getAllByUser(userId), // ordered by date desc
      cashFlowService.getColumns(userId),
      cashFlowService.getSettings(userId),
    ]);
    const { checkTotal } = buildCheckValuation(columns, settings);

    // One point per calendar month: checks arrive date-desc, so the first one
    // seen for a month is the latest of that month
    const byMonth = new Map<string, { date: string; total: number }>();
    for (const check of checks) {
      const periodKey = check.date.slice(0, 7);
      if (!byMonth.has(periodKey)) {
        byMonth.set(periodKey, { date: check.date, total: checkTotal(check) });
      }
    }
    const history: WealthGoalHistoryPointDTO[] = [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([periodKey, point]) => ({ periodKey, value: roundCurrency(point.total) }));

    // Monthly paces, normalized when checks skip months (delta / month gap)
    const paces: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const gap = this.monthsBetween(history[i - 1].periodKey, history[i].periodKey);
      if (gap > 0) paces.push((history[i].value - history[i - 1].value) / gap);
    }

    const latest = checks[0] ?? null;
    const currentValue = latest ? roundCurrency(checkTotal(latest)) : null;
    const currentDate = latest?.date ?? null;
    const currentPeriodKey = currentDate ? currentDate.slice(0, 7) : null;

    return goals.map((goal: (typeof goals)[number]) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
      createdAt: goal.createdAt.toISOString(),
      stats: this.buildStats(goal.targetAmount, goal.targetDate, {
        currentValue,
        currentDate,
        currentPeriodKey,
        history,
        paces,
      }),
    }));
  }

  async create(userId: string, data: CreateWealthGoalDTO): Promise<void> {
    const existing = await prisma.wealthGoal.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new AppError(`Goal "${data.name}" already exists`, 409, 'DUPLICATE_GOAL');
    }

    await prisma.wealthGoal.create({
      data: {
        userId,
        name: data.name,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      },
    });
  }

  async update(id: string, userId: string, data: UpdateWealthGoalDTO): Promise<void> {
    const goal = await prisma.wealthGoal.findFirst({ where: { id, userId } });
    if (!goal) {
      throw new AppError('Goal not found', 404, 'NOT_FOUND');
    }

    await prisma.wealthGoal.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        targetAmount: data.targetAmount ?? undefined,
        // undefined = untouched, null = clear the deadline
        targetDate:
          data.targetDate === undefined
            ? undefined
            : data.targetDate === null
              ? null
              : new Date(data.targetDate),
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const goal = await prisma.wealthGoal.findFirst({ where: { id, userId } });
    if (!goal) {
      throw new AppError('Goal not found', 404, 'NOT_FOUND');
    }
    await prisma.wealthGoal.delete({ where: { id } });
  }

  private buildStats(
    targetAmount: number,
    targetDate: Date | null,
    series: {
      currentValue: number | null;
      currentDate: string | null;
      currentPeriodKey: string | null;
      history: WealthGoalHistoryPointDTO[];
      paces: number[];
    }
  ): WealthGoalStatsDTO {
    const { currentValue, currentDate, currentPeriodKey, history, paces } = series;

    const progressPct =
      currentValue !== null && targetAmount > 0
        ? roundCurrency((currentValue / targetAmount) * 100)
        : null;
    const remaining = currentValue !== null ? roundCurrency(targetAmount - currentValue) : null;

    const paceP25 = this.percentile(paces, 25);
    const paceP50 = this.percentile(paces, 50);
    const paceP75 = this.percentile(paces, 75);

    const monthsToTarget = (pace: number | null): number | null => {
      if (remaining === null || pace === null) return null;
      if (remaining <= 0) return 0;
      if (pace <= 0) return null; // never, at this pace
      const months = Math.ceil(remaining / pace);
      return months > MAX_PROJECTED_MONTHS ? null : months;
    };
    // P25 is the SLOWER pace, so it gives the LATER arrival (and vice versa)
    const monthsToTargetP25 = monthsToTarget(paceP25);
    const monthsToTargetP50 = monthsToTarget(paceP50);
    const monthsToTargetP75 = monthsToTarget(paceP75);

    const etaPeriodP50 =
      monthsToTargetP50 !== null && currentPeriodKey !== null
        ? this.addMonths(currentPeriodKey, monthsToTargetP50)
        : null;

    // Deadline block: whole months from today to targetDate
    let monthsRemaining: number | null = null;
    let requiredMonthlyPace: number | null = null;
    if (targetDate) {
      const now = new Date();
      monthsRemaining = Math.max(
        0,
        (targetDate.getFullYear() - now.getFullYear()) * 12 +
          (targetDate.getMonth() - now.getMonth())
      );
      if (remaining !== null && remaining > 0 && monthsRemaining > 0) {
        requiredMonthlyPace = roundCurrency(remaining / monthsRemaining);
      }
    }

    let status: WealthGoalStatus;
    if (currentValue === null) {
      status = 'no_data';
    } else if (remaining !== null && remaining <= 0) {
      status = 'achieved';
    } else if (paceP50 === null) {
      status = 'no_data'; // fewer than two monthly points: no pace yet
    } else if (requiredMonthlyPace !== null) {
      // Deadline set: compare required vs actual pace percentiles
      if (paceP50 >= requiredMonthlyPace) status = 'on_track';
      else if (paceP75 !== null && paceP75 >= requiredMonthlyPace) status = 'at_risk';
      else status = 'off_track';
    } else if (targetDate && monthsRemaining === 0) {
      status = 'off_track'; // deadline passed without reaching the target
    } else {
      // No deadline: on track as long as the median pace moves toward the goal
      status = paceP50 > 0 ? 'on_track' : 'off_track';
    }

    return {
      currentValue,
      currentDate,
      progressPct,
      remaining,
      monthsOfHistory: history.length,
      paceP25: paceP25 !== null ? roundCurrency(paceP25) : null,
      paceP50: paceP50 !== null ? roundCurrency(paceP50) : null,
      paceP75: paceP75 !== null ? roundCurrency(paceP75) : null,
      monthsToTargetP25,
      monthsToTargetP50,
      monthsToTargetP75,
      etaPeriodP50,
      monthsRemaining,
      requiredMonthlyPace,
      status,
      history,
    };
  }

  /** Linear-interpolated percentile; null with no samples */
  private percentile(values: number[], pct: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = ((sorted.length - 1) * pct) / 100;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
  }

  /** Whole months between two YYYY-MM keys (b − a) */
  private monthsBetween(a: string, b: string): number {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return (by - ay) * 12 + (bm - am);
  }

  /** YYYY-MM plus n months */
  private addMonths(periodKey: string, n: number): string {
    const [year, month] = periodKey.split('-').map(Number);
    const total = year * 12 + (month - 1) + n;
    const newYear = Math.floor(total / 12);
    const newMonth = (total % 12) + 1;
    return `${newYear}-${String(newMonth).padStart(2, '0')}`;
  }
}

export const wealthGoalService = new WealthGoalService();
