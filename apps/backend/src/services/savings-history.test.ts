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

describe('getSavingsHistory structural balance and projection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('separates extraordinary income and projects the in-progress cycle to payday', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    periods.splice(0, periods.length,
      {
        ...period(2026, 9, 0),
        incomes: [
          { amount: 2000, sourcePeriodKey: null, isExtraordinary: false },
          { amount: 1000, sourcePeriodKey: null, isExtraordinary: true },
        ],
        expenses: [{ category: 'NEEDS', amount: 2400 }],
      },
      {
        ...period(2026, 10, 0),
        incomes: [{ amount: 2000, sourcePeriodKey: null, isExtraordinary: false }],
        expenses: [
          { category: 'NEEDS', amount: 800, isFixed: true },
          { category: 'WANTS', amount: 420, isFixed: false },
        ],
      },
    );

    const result = await dashboardService.getSavingsHistory('2026-10', 'user');

    expect(result.months[0].realBalance).toBe(600);
    expect(result.months[0].extraordinaryIncome).toBe(1000);
    expect(result.months[0].projectedRealBalance).toBeNull();
    expect(result.averageRealBalance).toBe(600);
    expect(result.averageStructuralBalance).toBe(-400);
    // Cycle Sep 26 → Oct 27 (32 days), 21 days elapsed: 2000 - 800 - 420 / 21 * 32
    expect(result.months[1].realBalance).toBe(780);
    expect(result.months[1].projectedRealBalance).toBe(560);
  });
});

describe('getSavingsHistory reallocation cap', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('caps reallocations at the real leftover (January 2026 data)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00'));
    periods.splice(0, periods.length,
      {
        ...period(2026, 1, 0),
        incomes: [{ amount: 2090, sourcePeriodKey: null, isExtraordinary: false }],
        expenses: [
          { category: 'NEEDS', amount: 1200 },
          { category: 'WANTS', amount: 391.51 },
          { category: 'SAVINGS', amount: 295 },
        ],
        reallocations: [{ toCategory: 'SAVINGS', amount: 289.49 }],
      },
      {
        ...period(2026, 2, 0),
        incomes: [{ amount: 2500, sourcePeriodKey: null, isExtraordinary: false }],
        expenses: [
          { category: 'NEEDS', amount: 1800 },
          { category: 'SAVINGS', amount: 300 },
          { category: 'EXTRA', amount: 50 },
        ],
        reallocations: [{ toCategory: 'SAVINGS', amount: 150 }],
      },
    );

    const result = await dashboardService.getSavingsHistory('2026-10', 'user');
    const [jan, feb] = result.months;

    // 2090 - 1591.51 - 295 = 203.49 really left, below the 289.49 budget remainder
    expect(jan.reallocatedRecorded).toBe(289.49);
    expect(jan.reallocatedToSavings).toBe(203.49);
    expect(jan.savings).toBe(498.49);
    expect(jan.savings).toBe(jan.realBalance);
    // 400 really left: the 150 remainder fits and is unchanged
    expect(feb.reallocatedToSavings).toBe(150);
    expect(feb.savings).toBe(400);
  });
});
