import { prisma } from '../lib/prisma.js';
import { generatePeriodKey, getCurrentPeriodKey } from '../lib/utils.js';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import type { MonthPeriodDTO, CreateMonthPeriodDTO, MonthListItemDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class MonthPeriodService {
  /**
   * Get all month periods ordered by date descending
   */
  async getAll(): Promise<MonthListItemDTO[]> {
    const periods = await prisma.monthPeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        incomes: true,
        expenses: true,
      },
    });

    return periods.map((p: { periodKey: string; year: number; month: number; incomes: { amount: number }[]; expenses: { amount: number }[] }) => ({
      periodKey: p.periodKey,
      year: p.year,
      month: p.month,
      totalIncome: p.incomes.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0),
      totalSpent: p.expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0),
    }));
  }

  /**
   * Get a month period by period key (YYYY-MM)
   */
  async getByPeriodKey(periodKey: string): Promise<MonthPeriodDTO | null> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
    });

    if (!period) return null;

    return this.toDTO(period);
  }

  /**
   * Get or create the current month period
   */
  async getOrCreateCurrent(): Promise<MonthPeriodDTO> {
    const periodKey = getCurrentPeriodKey();
    const existing = await this.getByPeriodKey(periodKey);

    if (existing) return existing;

    const now = new Date();
    return this.create({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  }

  /**
   * Create a new month period with default budget rule
   */
  async create(data: CreateMonthPeriodDTO): Promise<MonthPeriodDTO> {
    const periodKey = generatePeriodKey(data.year, data.month);

    // Check if already exists
    const existing = await prisma.monthPeriod.findUnique({
      where: { periodKey },
    });

    if (existing) {
      throw new AppError(`Month period ${periodKey} already exists`, 409, 'DUPLICATE_PERIOD');
    }

    // Create period with default budget rule
    const period = await prisma.monthPeriod.create({
      data: {
        year: data.year,
        month: data.month,
        periodKey,
        budgetRule: {
          create: {
            needsPct: DEFAULT_BUDGET_RULE.needsPct,
            wantsPct: DEFAULT_BUDGET_RULE.wantsPct,
            savingsPct: DEFAULT_BUDGET_RULE.savingsPct,
            cutoffDay: DEFAULT_BUDGET_RULE.cutoffDay,
            autoReallocateNeedsRemainder: DEFAULT_BUDGET_RULE.autoReallocateNeedsRemainder,
          },
        },
      },
    });

    return this.toDTO(period);
  }

  /**
   * Delete a month period
   */
  async delete(periodKey: string): Promise<void> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    await prisma.monthPeriod.delete({
      where: { periodKey },
    });
  }

  private toDTO(period: { id: string; year: number; month: number; periodKey: string; createdAt: Date }): MonthPeriodDTO {
    return {
      id: period.id,
      year: period.year,
      month: period.month,
      periodKey: period.periodKey,
      createdAt: period.createdAt.toISOString(),
    };
  }
}

export const monthPeriodService = new MonthPeriodService();
