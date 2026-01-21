import { prisma } from '../lib/prisma.js';
import type { IncomeDTO, CreateIncomeDTO, UpdateIncomeDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class IncomeService {
  /**
   * Get all incomes for a period
   */
  async getByPeriodKey(periodKey: string): Promise<IncomeDTO[]> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
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
   * Get income by ID
   */
  async getById(id: string): Promise<IncomeDTO | null> {
    const income = await prisma.income.findUnique({
      where: { id },
    });

    return income ? this.toDTO(income) : null;
  }

  /**
   * Create a new income entry
   */
  async create(periodKey: string, data: CreateIncomeDTO): Promise<IncomeDTO> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
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
   * Update an income entry
   */
  async update(id: string, data: UpdateIncomeDTO): Promise<IncomeDTO> {
    const existing = await prisma.income.findUnique({
      where: { id },
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
   * Delete an income entry
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.income.findUnique({
      where: { id },
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
