import { describe, expect, it, vi } from 'vitest';

const periods: unknown[] = [];
vi.mock('../lib/prisma.js', () => ({
  prisma: { monthPeriod: { findMany: vi.fn(async () => periods) } },
}));

const { dashboardService } = await import('./dashboard.service.js');

const rule = { cutoffDay: 27 };
const period = (year: number, month: number, expenses: unknown[]) => ({
  periodKey: `${year}-${String(month).padStart(2, '0')}`,
  year,
  month,
  budgetRule: rule,
  expenses,
});
const expense = (date: string, amount: number, extra: Record<string, unknown> = {}) => ({
  date: new Date(`${date}T12:00:00`),
  amount,
  category: 'NEEDS',
  isFixed: false,
  ...extra,
});

describe('getCumulativeSpend', () => {
  it('builds the cumulative curve and averages completed months of the same year', async () => {
    // 2025-04 cycle: Mar 28 → Apr 25 (Apr 27 2025 is a Sunday, moved to Friday 25)
    periods.splice(0, periods.length,
      period(2024, 12, [expense('2024-12-10', 999)]),
      period(2025, 1, [expense('2024-12-30', 100, { isFixed: true }), expense('2025-01-05', 50)]),
      period(2025, 2, [expense('2025-02-01', 300), expense('2025-02-02', 20, { category: 'SAVINGS' })]),
      period(2025, 3, []),
      period(2025, 4, [expense('2025-04-15', 40, { isFixed: true }), expense('2025-03-29', 10), expense('2025-04-02', 5, { category: 'EXTRA' })]),
    );

    const result = await dashboardService.getCumulativeSpend('2025-04', 'user');

    expect(result.cycleStart).toBe('2025-03-28');
    expect(result.cycleLengthDays).toBe(29);
    expect(result.daysElapsed).toBe(29);
    expect(result.current[0]).toBe(40);
    expect(result.current[1]).toBe(50);
    // EXTRA counts as an outflow (Apr 2 = day 6), SAVINGS does not
    expect(result.current[4]).toBe(50);
    expect(result.current[5]).toBe(55);
    expect(result.current[28]).toBe(55);
    expect(result.fixedSpend).toBe(40);
    // March has no spend and December 2024 is another year: only Jan and Feb are averaged
    expect(result.comparisonPeriodKeys).toEqual(['2025-01', '2025-02']);
    expect(result.average).toHaveLength(29);
    expect(result.average[0]).toBe(50);
    expect(result.average[28]).toBe(225);
  });
});
