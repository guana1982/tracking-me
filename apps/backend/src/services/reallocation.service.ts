import { prisma } from '../lib/prisma.js';
import type { ReallocationDTO, CreateReallocationDTO, ReallocationPreviewDTO, CarryoverPreviewDTO, SurplusForwardPreviewDTO, ExpenseDTO, IncomeDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { expenseService } from './expense.service.js';
import { incomeService } from './income.service.js';
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
   * Compute raw NEEDS/WANTS remainders (can be negative when over budget),
   * net of reallocations already executed from each source category
   */
  private async computeRemainders(periodKey: string, userId: string) {
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

    return {
      budgetRule,
      needsRemainder: targets.needs - expenseTotals.NEEDS - sumReallocatedFrom('NEEDS'),
      wantsRemainder: targets.wants - expenseTotals.WANTS - sumReallocatedFrom('WANTS'),
    };
  }

  /**
   * Get reallocation preview (how much can be reallocated from NEEDS to SAVINGS)
   */
  async getPreview(periodKey: string, userId: string): Promise<ReallocationPreviewDTO> {
    const { budgetRule, needsRemainder, wantsRemainder } = await this.computeRemainders(periodKey, userId);

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

    // Mutual exclusion with the surplus-forward: the same leftover cannot be
    // both saved and moved to the next month, or the euros would be counted
    // twice. If it was already carried forward, the user must undo that first.
    if (await this.surplusForwardIncome(periodKey, userId)) {
      throw new AppError(
        'Surplus already moved to the next month; undo it before reallocating to savings',
        400,
        'CONFLICT_SURPLUS_FORWARD'
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
   * Get carry-over preview: NEEDS/WANTS deficits (over budget) that can be
   * carried to the next month as auto-generated expenses
   */
  async getCarryoverPreview(periodKey: string, userId: string): Promise<CarryoverPreviewDTO> {
    const { budgetRule, needsRemainder, wantsRemainder } = await this.computeRemainders(periodKey, userId);

    const nextPeriodKey = this.getNextPeriodKey(periodKey);
    const marker = this.carryoverMarker(periodKey);

    // A deficit is "already carried" when its marker expense exists in the next month
    const carried = await prisma.expense.findMany({
      where: {
        monthPeriod: { periodKey: nextPeriodKey, userId },
        notes: { startsWith: marker },
      },
      select: { category: true },
    });
    const needsCarried = carried.some((e: { category: string }) => e.category === 'NEEDS');
    const wantsCarried = carried.some((e: { category: string }) => e.category === 'WANTS');

    const needsDeficit = roundCurrency(Math.max(0, -needsRemainder));
    const wantsDeficit = roundCurrency(Math.max(0, -wantsRemainder));
    const pendingTotal = roundCurrency(
      (needsCarried ? 0 : needsDeficit) + (wantsCarried ? 0 : wantsDeficit)
    );

    return {
      nextPeriodKey,
      needsDeficit,
      wantsDeficit,
      needsCarried,
      wantsCarried,
      pendingTotal,
      isAfterCutoff: isPastCutoffDay(budgetRule.cutoffDay, periodKey),
      available: pendingTotal > 0,
    };
  }

  /**
   * Carry over-budget deficits to the next month as fixed expenses in the
   * same category. Pass a category to carry only that one; omit for all.
   */
  async createCarryover(
    periodKey: string,
    userId: string,
    category?: 'NEEDS' | 'WANTS'
  ): Promise<ExpenseDTO[]> {
    const preview = await this.getCarryoverPreview(periodKey, userId);
    const monthLabel = this.formatPeriodLabel(periodKey);
    const marker = this.carryoverMarker(periodKey);

    const jobs: { category: 'NEEDS' | 'WANTS'; deficit: number; label: string }[] = [];
    if ((!category || category === 'NEEDS') && !preview.needsCarried && preview.needsDeficit > 0) {
      jobs.push({ category: 'NEEDS', deficit: preview.needsDeficit, label: 'Necessità' });
    }
    if ((!category || category === 'WANTS') && !preview.wantsCarried && preview.wantsDeficit > 0) {
      jobs.push({ category: 'WANTS', deficit: preview.wantsDeficit, label: 'Svago' });
    }

    if (jobs.length === 0) {
      throw new AppError('No deficit to carry over', 400, 'NOTHING_TO_CARRY');
    }

    const created: ExpenseDTO[] = [];
    for (const job of jobs) {
      created.push(
        await expenseService.create(preview.nextPeriodKey, userId, {
          date: `${preview.nextPeriodKey}-01`,
          category: job.category,
          label: `Sforamento ${monthLabel} - ${job.label}`,
          amount: job.deficit,
          notes: `${marker} Budget ${job.label} superato di ${job.deficit.toFixed(2)}€ a ${monthLabel}`,
          isFixed: true,
        })
      );
    }

    return created;
  }

  /**
   * Surplus-forward preview: the positive mirror of the carry-over. A month's
   * leftover surplus (positive NEEDS + WANTS remainder, net of any SAVINGS
   * reallocation already executed) can be moved to the next month as a single
   * income line instead of being sent to SAVINGS. The two destinations are
   * mutually exclusive so the same euros are never counted twice.
   */
  async getSurplusForwardPreview(periodKey: string, userId: string): Promise<SurplusForwardPreviewDTO> {
    const { budgetRule, needsRemainder, wantsRemainder } = await this.computeRemainders(periodKey, userId);
    const nextPeriodKey = this.getNextPeriodKey(periodKey);
    const isAfterCutoff = isPastCutoffDay(budgetRule.cutoffDay, periodKey);
    const availableAmount = roundCurrency(Math.max(0, needsRemainder) + Math.max(0, wantsRemainder));

    const carriedIncome = await this.surplusForwardIncome(periodKey, userId);
    const carried = !!carriedIncome;
    const carriedAmount = carriedIncome ? roundCurrency(carriedIncome.amount) : 0;

    // A SAVINGS reallocation already earmarks this surplus → forward is blocked
    const savingsRealloc = await prisma.reallocation.findFirst({
      where: { monthPeriod: { periodKey, userId }, toCategory: 'SAVINGS' },
    });
    const hasSavingsReallocation = !!savingsRealloc;

    const available =
      !carried && !hasSavingsReallocation && availableAmount > 0 && isAfterCutoff;

    return {
      nextPeriodKey,
      availableAmount,
      carried,
      carriedAmount,
      hasSavingsReallocation,
      isAfterCutoff,
      available,
    };
  }

  /**
   * Move the whole current surplus to the next month as an income line
   * ("Riallocazione positiva da <mese>"). Idempotent: rejected when a
   * carry-forward already exists or a savings reallocation is in the way.
   */
  async createSurplusForward(periodKey: string, userId: string): Promise<IncomeDTO> {
    const preview = await this.getSurplusForwardPreview(periodKey, userId);

    if (preview.carried) {
      throw new AppError('Surplus already moved to the next month', 400, 'ALREADY_FORWARDED');
    }
    if (preview.hasSavingsReallocation) {
      throw new AppError(
        'A savings reallocation exists; undo it before moving the surplus forward',
        400,
        'CONFLICT_SAVINGS'
      );
    }
    if (!preview.isAfterCutoff) {
      throw new AppError('Surplus can be moved forward only after the cutoff day', 400, 'BEFORE_CUTOFF');
    }
    if (preview.availableAmount <= 0) {
      throw new AppError('No surplus to move forward', 400, 'NO_SURPLUS');
    }

    const monthLabel = this.formatPeriodLabel(periodKey);
    return incomeService.create(preview.nextPeriodKey, userId, {
      label: `Riallocazione positiva da ${monthLabel}`,
      amount: preview.availableAmount,
      sourcePeriodKey: periodKey,
    });
  }

  /**
   * Undo the surplus-forward: delete the next-month income generated from this
   * period's surplus.
   */
  async deleteSurplusForward(periodKey: string, userId: string): Promise<void> {
    const income = await this.surplusForwardIncome(periodKey, userId);
    if (!income) {
      throw new AppError('No carried-forward surplus found', 404, 'NOT_FOUND');
    }
    await prisma.income.delete({ where: { id: income.id } });
  }

  // The income row in the next month generated from this period's surplus, if any
  private async surplusForwardIncome(periodKey: string, userId: string) {
    const nextPeriodKey = this.getNextPeriodKey(periodKey);
    return prisma.income.findFirst({
      where: {
        monthPeriod: { periodKey: nextPeriodKey, userId },
        sourcePeriodKey: periodKey,
      },
    });
  }

  private getNextPeriodKey(periodKey: string): string {
    const [year, month] = periodKey.split('-').map(Number);
    return month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  // Machine-readable prefix in notes: makes the carry-over idempotent
  private carryoverMarker(periodKey: string): string {
    return `[Riporto ${periodKey}]`;
  }

  private formatPeriodLabel(periodKey: string): string {
    const MONTHS = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
    ];
    const [year, month] = periodKey.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
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
