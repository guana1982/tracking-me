import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { generatePeriodKey, getCurrentPeriodKey } from '../lib/utils.js';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import type { MonthPeriodDTO, CreateMonthPeriodDTO, MonthListItemDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class MonthPeriodService {
  /**
   * Get all month periods for a user ordered by date descending
   */
  async getAll(userId: string): Promise<MonthListItemDTO[]> {
    const periods = await prisma.monthPeriod.findMany({
      where: { userId },
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
   * Get a month period by period key (YYYY-MM) for a user
   */
  async getByPeriodKey(periodKey: string, userId: string): Promise<MonthPeriodDTO | null> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) return null;

    return this.toDTO(period);
  }

  /**
   * Get or create the current month period for a user
   */
  async getOrCreateCurrent(userId: string): Promise<MonthPeriodDTO> {
    const now = new Date();
    return this.getOrCreate(userId, now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Get or create a month period for a user (handles race conditions)
   */
  async getOrCreate(userId: string, year: number, month: number): Promise<MonthPeriodDTO> {
    const periodKey = generatePeriodKey(year, month);

    // First, try to find existing
    const existing = await this.getByPeriodKey(periodKey, userId);
    if (existing) return existing;

    // Try to create, handling potential race conditions
    try {
      const period = await prisma.monthPeriod.create({
        data: {
          userId,
          year,
          month,
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
    } catch (error) {
      // If unique constraint violation, another request created it - fetch and return
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const created = await this.getByPeriodKey(periodKey, userId);
        if (created) return created;
      }
      throw error;
    }
  }

  /**
   * Create a new month period with default budget rule for a user
   */
  async create(userId: string, data: CreateMonthPeriodDTO): Promise<MonthPeriodDTO> {
    const periodKey = generatePeriodKey(data.year, data.month);

    // Check if already exists for this user
    const existing = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (existing) {
      throw new AppError(`Month period ${periodKey} already exists`, 409, 'DUPLICATE_PERIOD');
    }

    // Create period with default budget rule
    const period = await prisma.monthPeriod.create({
      data: {
        userId,
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
   * Delete a month period for a user
   */
  async delete(periodKey: string, userId: string): Promise<void> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    await prisma.monthPeriod.delete({
      where: { id: period.id },
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
