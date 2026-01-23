import { prisma } from '../lib/prisma.js';
import type { ReallocationDTO, CreateReallocationDTO, ReallocationPreviewDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { expenseService } from './expense.service.js';
import { budgetRuleService } from './budget-rule.service.js';
import { DEFAULT_BUDGET_RULE } from '@budget/shared';
import { isPastCutoffDay, roundCurrency, calculateTargets } from '../lib/utils.js';

export class ReallocationService {
  /**
   * Get all reallocations for a period
   */
  async getByPeriodKey(periodKey: string): Promise<ReallocationDTO[]> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
      include: {
        reallocations: {
          orderBy: { executedAt: 'desc' },
        },
      },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    return period.reallocations.map(this.toDTO);
  }

  /**
   * Get reallocation preview (how much can be reallocated from NEEDS to SAVINGS)
   */
  async getPreview(periodKey: string): Promise<ReallocationPreviewDTO> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
      include: {
        incomes: true,
        budgetRule: true,
      },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    // Get budget rule
    const budgetRule = period.budgetRule || {
      needsPct: DEFAULT_BUDGET_RULE.needsPct,
      wantsPct: DEFAULT_BUDGET_RULE.wantsPct,
      savingsPct: DEFAULT_BUDGET_RULE.savingsPct,
      cutoffDay: DEFAULT_BUDGET_RULE.cutoffDay,
      autoReallocateNeedsRemainder: DEFAULT_BUDGET_RULE.autoReallocateNeedsRemainder,
    };

    // Calculate totals
    const totalIncome = period.incomes.reduce((sum: number, i: { amount: number }) => sum + i.amount, 0);
    const targets = calculateTargets(
      totalIncome,
      budgetRule.needsPct,
      budgetRule.wantsPct,
      budgetRule.savingsPct
    );

    // Get expense totals
    const expenseTotals = await expenseService.getTotalsByCategory(periodKey);
    const needsRemainder = targets.needs - expenseTotals.NEEDS;

    // Check if reallocation is available
    const isAfterCutoff = isPastCutoffDay(budgetRule.cutoffDay);
    const available = needsRemainder > 0 && (budgetRule.autoReallocateNeedsRemainder || isAfterCutoff);

    return {
      available,
      needsRemainder: roundCurrency(Math.max(0, needsRemainder)),
      suggestedAmount: available ? roundCurrency(needsRemainder) : 0,
      cutoffDay: budgetRule.cutoffDay,
      isAfterCutoff,
    };
  }

  /**
   * Execute a reallocation
   */
  async create(periodKey: string, data: CreateReallocationDTO): Promise<ReallocationDTO> {
    const period = await prisma.monthPeriod.findUnique({
      where: { periodKey },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    // Validate: can only reallocate from NEEDS to SAVINGS
    if (data.fromCategory !== 'NEEDS' || data.toCategory !== 'SAVINGS') {
      throw new AppError(
        'Only reallocation from NEEDS to SAVINGS is supported',
        400,
        'INVALID_REALLOCATION'
      );
    }

    // Get preview to validate amount
    const preview = await this.getPreview(periodKey);

    if (data.amount > preview.needsRemainder) {
      throw new AppError(
        `Cannot reallocate more than available (${preview.needsRemainder})`,
        400,
        'INSUFFICIENT_FUNDS'
      );
    }

    // Create reallocation record
    const reallocation = await prisma.reallocation.create({
      data: {
        monthPeriodId: period.id,
        fromCategory: data.fromCategory,
        toCategory: data.toCategory,
        amount: data.amount,
        reason: data.reason || 'End of month NEEDS remainder transfer',
        executedAt: new Date(),
      },
    });

    return this.toDTO(reallocation);
  }

  /**
   * Delete a reallocation (undo)
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.reallocation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('Reallocation not found', 404, 'NOT_FOUND');
    }

    await prisma.reallocation.delete({
      where: { id },
    });
  }

  private toDTO(reallocation: {
    id: string;
    monthPeriodId: string;
    fromCategory: string;
    toCategory: string;
    amount: number;
    executedAt: Date;
    reason: string | null;
  }): ReallocationDTO {
    return {
      id: reallocation.id,
      monthPeriodId: reallocation.monthPeriodId,
      fromCategory: reallocation.fromCategory as 'NEEDS' | 'WANTS' | 'SAVINGS',
      toCategory: reallocation.toCategory as 'NEEDS' | 'WANTS' | 'SAVINGS',
      amount: reallocation.amount,
      executedAt: reallocation.executedAt.toISOString(),
      reason: reallocation.reason,
    };
  }
}

export const reallocationService = new ReallocationService();
