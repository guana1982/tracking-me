import { prisma } from '../lib/prisma.js';

/** Totals of actual spending per budget period. SAVINGS rows are transfers. */
export async function getMonthlyExpenseTotalsWithoutSavings(
  userId: string
): Promise<Map<string, number>> {
  const periods = await prisma.monthPeriod.findMany({
    where: { userId },
    select: {
      periodKey: true,
      expenses: {
        where: { category: { not: 'SAVINGS' } },
        select: { amount: true },
      },
    },
  });

  return new Map(
    periods.map((period) => [
      period.periodKey,
      Math.round(period.expenses.reduce((sum, expense) => sum + expense.amount, 0) * 100) / 100,
    ])
  );
}
