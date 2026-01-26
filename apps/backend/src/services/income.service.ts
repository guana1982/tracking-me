import { prisma } from '../lib/prisma.js';
import type { IncomeDTO, CreateIncomeDTO, UpdateIncomeDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class IncomeService {
  /**
   * Get all incomes for a period (user-scoped)
   */
  async getByPeriodKey(periodKey: string, userId: string): Promise<IncomeDTO[]> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: {
        incomes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    return period.incomes.map(this.toDTO);
  }

  /**
   * Get income by ID (user-scoped)
   */
  async getById(id: string, userId: string): Promise<IncomeDTO | null> {
    const income = await prisma.income.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    return income ? this.toDTO(income) : null;
  }

  /**
   * Create a new income entry (user-scoped)
   * Auto-creates the month period if it doesn't exist
   */
  async create(periodKey: string, userId: string, data: CreateIncomeDTO): Promise<IncomeDTO> {
    let period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    // Auto-create period if it doesn't exist
    if (!period) {
      const [yearStr, monthStr] = periodKey.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        throw new AppError(`Invalid period key format: ${periodKey}`, 400, 'INVALID_PERIOD_KEY');
      }

      // Import default budget rule
      const { DEFAULT_BUDGET_RULE } = await import('@budget/shared');

      period = await prisma.monthPeriod.create({
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
    }

    const income = await prisma.income.create({
      data: {
        monthPeriodId: period.id,
        label: data.label,
        amount: data.amount,
      },
    });

    return this.toDTO(income);
  }

  /**
   * Update an income entry (user-scoped)
   */
  async update(id: string, userId: string, data: UpdateIncomeDTO): Promise<IncomeDTO> {
    const existing = await prisma.income.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    if (!existing) {
      throw new AppError('Income not found', 404, 'NOT_FOUND');
    }

    const income = await prisma.income.update({
      where: { id },
      data: {
        label: data.label ?? undefined,
        amount: data.amount ?? undefined,
      },
    });

    return this.toDTO(income);
  }

  /**
   * Delete an income entry (user-scoped)
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.income.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    if (!existing) {
      throw new AppError('Income not found', 404, 'NOT_FOUND');
    }

    await prisma.income.delete({
      where: { id },
    });
  }

  private toDTO(income: {
    id: string;
    monthPeriodId: string;
    label: string;
    amount: number;
    createdAt: Date;
  }): IncomeDTO {
    return {
      id: income.id,
      monthPeriodId: income.monthPeriodId,
      label: income.label,
      amount: income.amount,
      createdAt: income.createdAt.toISOString(),
    };
  }
}

export const incomeService = new IncomeService();
