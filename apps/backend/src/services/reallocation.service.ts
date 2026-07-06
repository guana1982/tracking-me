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
  async getByPeriodKey(periodKey: string, userId: string): Promise<ReallocationDTO[]> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
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
  async getPreview(periodKey: string, userId: string): Promise<ReallocationPreviewDTO> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: {
        incomes: true,
        budgetRule: true,
        reallocations: true,
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
    const expenseTotals = await expenseService.getTotalsByCategory(periodKey, userId);

    // Subtract reallocations already executed from each source category,
    // otherwise the same remainder could be transferred multiple times
    const sumReallocatedFrom = (category: string) =>
      period.reallocations
        .filter((r: { fromCategory: string }) => r.fromCategory === category)
        .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

    const needsRemainder = targets.needs - expenseTotals.NEEDS - sumReallocatedFrom('NEEDS');
    const wantsRemainder = targets.wants - expenseTotals.WANTS - sumReallocatedFrom('WANTS');

    // Check if reallocation is available (either NEEDS or WANTS has remainder)
    const isAfterCutoff = isPastCutoffDay(budgetRule.cutoffDay, periodKey);
    const totalRemainder = Math.max(0, needsRemainder) + Math.max(0, wantsRemainder);
    const available = totalRemainder > 0 && (budgetRule.autoReallocateNeedsRemainder || isAfterCutoff);

    return {
      available,
      needsRemainder: roundCurrency(Math.max(0, needsRemainder)),
      wantsRemainder: roundCurrency(Math.max(0, wantsRemainder)),
      suggestedAmount: available ? roundCurrency(totalRemainder) : 0,
      cutoffDay: budgetRule.cutoffDay,
      isAfterCutoff,
    };
  }

  /**
   * Execute a reallocation
   */
  async create(periodKey: string, userId: string, data: CreateReallocationDTO): Promise<ReallocationDTO> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    // Validate: can only reallocate from NEEDS or WANTS to SAVINGS
    if (data.toCategory !== 'SAVINGS' || (data.fromCategory !== 'NEEDS' && data.fromCategory !== 'WANTS')) {
      throw new AppError(
        'Only reallocation from NEEDS or WANTS to SAVINGS is supported',
        400,
        'INVALID_REALLOCATION'
      );
    }

    // Get preview to validate amount
    const preview = await this.getPreview(periodKey, userId);

    // Check against the appropriate remainder
    const availableAmount = data.fromCategory === 'NEEDS' ? preview.needsRemainder : preview.wantsRemainder;
    if (data.amount > availableAmount) {
      throw new AppError(
        `Cannot reallocate more than available (${availableAmount})`,
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
  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.reallocation.findUnique({
      where: { id },
      include: {
        monthPeriod: true,
      },
    });

    if (!existing) {
      throw new AppError('Reallocation not found', 404, 'NOT_FOUND');
    }

    // Verify ownership
    if (existing.monthPeriod.userId !== userId) {
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
