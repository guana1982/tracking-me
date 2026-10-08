import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { getCurrentPeriodKey, parsePeriodKey, roundCurrency } from '../lib/utils.js';
import type { SinkingFundDTO, CreateSinkingFundDTO, UpdateSinkingFundDTO } from '@budget/shared';

export class SinkingFundService {
  /**
   * Get all funds with computed balances. Accrual runs from startPeriodKey to the
   * current pay-cycle (inclusive); withdrawals are the expenses classified under
   * the linked spending category from startPeriodKey onwards.
   */
  async getAll(userId: string): Promise<SinkingFundDTO[]> {
    const funds = await prisma.sinkingFund.findMany({
      where: { userId },
      include: { spendingCategory: { select: { name: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (funds.length === 0) return [];

    // One query for all funds' withdrawals, grouped in memory
    const categoryIds = funds.map((f: (typeof funds)[number]) => f.spendingCategoryId);
    const expenses = await prisma.expense.findMany({
      where: {
        monthPeriod: { userId },
        spendingCategoryId: { in: categoryIds },
        category: { not: 'SAVINGS' },
      },
      select: {
        amount: true,
        spendingCategoryId: true,
        monthPeriod: { select: { periodKey: true } },
      },
    });

    const currentPeriodKey = getCurrentPeriodKey();

    return funds.map((fund: (typeof funds)[number]) => {
      const monthsAccrued = this.monthsBetween(fund.startPeriodKey, currentPeriodKey);
      const totalAccrued = roundCurrency(monthsAccrued * fund.monthlyAmount);
      const totalSpent = roundCurrency(
        expenses
          .filter(
            (e: { spendingCategoryId: string | null; monthPeriod: { periodKey: string } }) =>
              e.spendingCategoryId === fund.spendingCategoryId &&
              e.monthPeriod.periodKey >= fund.startPeriodKey
          )
          .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
      );

      return {
        id: fund.id,
        name: fund.name,
        monthlyAmount: fund.monthlyAmount,
        startPeriodKey: fund.startPeriodKey,
        spendingCategoryId: fund.spendingCategoryId,
        spendingCategoryName: fund.spendingCategory.name,
        spendingCategoryColor: fund.spendingCategory.color,
        monthsAccrued,
        totalAccrued,
        totalSpent,
        balance: roundCurrency(totalAccrued - totalSpent),
      };
    });
  }

  async create(userId: string, data: CreateSinkingFundDTO): Promise<void> {
    const category = await prisma.spendingCategory.findFirst({
      where: { id: data.spendingCategoryId, userId },
    });
    if (!category) {
      throw new AppError('Spending category not found', 404, 'NOT_FOUND');
    }

    const existing = await prisma.sinkingFund.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new AppError(`Fund "${data.name}" already exists`, 409, 'DUPLICATE_FUND');
    }

    await prisma.sinkingFund.create({
      data: {
        userId,
        name: data.name,
        monthlyAmount: data.monthlyAmount,
        spendingCategoryId: data.spendingCategoryId,
        startPeriodKey: data.startPeriodKey ?? getCurrentPeriodKey(),
      },
    });
  }

  async update(id: string, userId: string, data: UpdateSinkingFundDTO): Promise<void> {
    const fund = await prisma.sinkingFund.findFirst({ where: { id, userId } });
    if (!fund) {
      throw new AppError('Fund not found', 404, 'NOT_FOUND');
    }

    if (data.spendingCategoryId) {
      const category = await prisma.spendingCategory.findFirst({
        where: { id: data.spendingCategoryId, userId },
      });
      if (!category) {
        throw new AppError('Spending category not found', 404, 'NOT_FOUND');
      }
    }

    await prisma.sinkingFund.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        monthlyAmount: data.monthlyAmount ?? undefined,
        spendingCategoryId: data.spendingCategoryId ?? undefined,
        startPeriodKey: data.startPeriodKey ?? undefined,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const fund = await prisma.sinkingFund.findFirst({ where: { id, userId } });
    if (!fund) {
      throw new AppError('Fund not found', 404, 'NOT_FOUND');
    }
    await prisma.sinkingFund.delete({ where: { id } });
  }

  /**
   * Whole periods from `from` to `to` inclusive (both YYYY-MM); 0 when `from`
   * is in the future
   */
  private monthsBetween(from: string, to: string): number {
    const a = parsePeriodKey(from);
    const b = parsePeriodKey(to);
    const diff = (b.year - a.year) * 12 + (b.month - a.month) + 1;
    return Math.max(0, diff);
  }
}

export const sinkingFundService = new SinkingFundService();
