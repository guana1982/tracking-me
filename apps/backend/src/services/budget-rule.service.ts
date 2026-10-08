import { prisma } from '../lib/prisma.js';
import type { BudgetRuleDTO, UpdateBudgetRuleDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class BudgetRuleService {
  /**
   * Get budget rule by period key (user-scoped)
   */
  async getByPeriodKey(periodKey: string, userId: string): Promise<BudgetRuleDTO | null> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: { budgetRule: true },
    });

    if (!period || !period.budgetRule) return null;

    return this.toDTO(period.budgetRule);
  }

  /**
   * Update budget rule for a period (user-scoped)
   */
  async update(periodKey: string, userId: string, data: UpdateBudgetRuleDTO): Promise<BudgetRuleDTO> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: { budgetRule: true },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    // Validate percentages sum to 100 if all are provided
    const needsPct = data.needsPct ?? period.budgetRule?.needsPct ?? 65;
    const wantsPct = data.wantsPct ?? period.budgetRule?.wantsPct ?? 25;
    const savingsPct = data.savingsPct ?? period.budgetRule?.savingsPct ?? 10;

    const total = needsPct + wantsPct + savingsPct;
    if (Math.abs(total - 100) > 0.01) {
      throw new AppError(
        `Budget percentages must sum to 100 (got ${total})`,
        400,
        'INVALID_PERCENTAGES'
      );
    }

    // Update or create budget rule
    const budgetRule = await prisma.budgetRule.upsert({
      where: { monthPeriodId: period.id },
      update: {
        needsPct,
        wantsPct,
        savingsPct,
        cutoffDay: data.cutoffDay ?? undefined,
        autoReallocateNeedsRemainder: data.autoReallocateNeedsRemainder ?? undefined,
      },
      create: {
        monthPeriodId: period.id,
        needsPct,
        wantsPct,
        savingsPct,
        cutoffDay: data.cutoffDay ?? 26,
        autoReallocateNeedsRemainder: data.autoReallocateNeedsRemainder ?? true,
      },
    });

    return this.toDTO(budgetRule);
  }

  private toDTO(rule: {
    id: string;
    monthPeriodId: string;
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
    cutoffDay: number;
    autoReallocateNeedsRemainder: boolean;
  }): BudgetRuleDTO {
    return {
      id: rule.id,
      monthPeriodId: rule.monthPeriodId,
      needsPct: rule.needsPct,
      wantsPct: rule.wantsPct,
      savingsPct: rule.savingsPct,
      cutoffDay: rule.cutoffDay,
      autoReallocateNeedsRemainder: rule.autoReallocateNeedsRemainder,
    };
  }
}

export const budgetRuleService = new BudgetRuleService();
