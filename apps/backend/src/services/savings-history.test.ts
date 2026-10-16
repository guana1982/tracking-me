import { afterEach, describe, expect, it, vi } from 'vitest';

const periods: unknown[] = [];
vi.mock('../lib/prisma.js', () => ({
  prisma: { monthPeriod: { findMany: vi.fn(async () => periods) } },
}));

const { dashboardService } = await import('./dashboard.service.js');

const period = (year: number, month: number, saved: number, cutoffDay = 27) => ({
  periodKey: `${year}-${String(month).padStart(2, '0')}`,
  year,
  month,
  budgetRule: { cutoffDay },
  expenses: [{ category: 'SAVINGS', amount: saved }],
  reallocations: [],
  incomes: [] as unknown[],
});

describe('getSavingsHistory', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('averages completed cycles using the default payday', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    periods.splice(0, periods.length, period(2026, 8, 100), period(2026, 9, 200), period(2026, 10, 0));

    const result = await dashboardService.getSavingsHistory('2026-10', 'user');

    expect(result.livePeriodKey).toBe('2026-10');
    expect(result.averageMonthlySavings).toBe(150);
  });

  it("uses the user's payday from the current month's rule", async () => {
    vi.useFakeTimers();
    // Oct 16 is past a payday on the 10th, so October's cycle is completed
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    periods.splice(0, periods.length, period(2026, 8, 100), period(2026, 9, 200), period(2026, 10, 0, 10), period(2026, 11, 0, 10));

    const result = await dashboardService.getSavingsHistory('2026-10', 'user');

    expect(result.livePeriodKey).toBe('2026-11');
    expect(result.averageMonthlySavings).toBe(100);
  });
});

describe('getSavingsHistory real balance', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('subtracts real outflows from real income, ignoring savings transfers and bookkeeping lines', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    periods.splice(0, periods.length,
      {
        ...period(2026, 7, 300),
        incomes: [
          { amount: 2000, sourcePeriodKey: null },
          { amount: 150, sourcePeriodKey: '2026-06' },
        ],
        expenses: [
          { category: 'SAVINGS', amount: 300 },
          { category: 'NEEDS', amount: 1500 },
          { category: 'NEEDS', amount: 406, notes: '[Riporto 2026-06] Budget Necessità superato' },
          { category: 'WANTS', amount: 400 },
          { category: 'EXTRA', amount: 200 },
        ],
      },
      { ...period(2026, 8, 0), incomes: [{ amount: 2000, sourcePeriodKey: null }], expenses: [{ category: 'NEEDS', amount: 1900 }] },
      { ...period(2026, 10, 0), incomes: [], expenses: [] },
    );

    const result = await dashboardService.getSavingsHistory('2026-10', 'user');

    expect(result.months[0].income).toBe(2000);
    // 2000 - (1500 + 400 + 200): SAVINGS, carry-over and surplus forward stay out
    expect(result.months[0].realBalance).toBe(-100);
    expect(result.months[1].realBalance).toBe(100);
    expect(result.averageRealBalance).toBe(0);
  });
});
