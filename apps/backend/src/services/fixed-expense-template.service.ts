import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { expenseService } from './expense.service.js';
import { monthPeriodService } from './month-period.service.js';
import type {
  ApplyFixedExpenseTemplatesDTO,
  ApplyFixedExpenseTemplatesResultDTO,
  CreateFixedExpenseTemplateDTO,
  FixedExpenseCategory,
  FixedExpenseTemplateDTO,
  UpdateFixedExpenseTemplateDTO,
} from '@budget/shared';

export class FixedExpenseTemplateService {
  async getAll(userId: string, category?: FixedExpenseCategory): Promise<FixedExpenseTemplateDTO[]> {
    const templates = await prisma.fixedExpenseTemplate.findMany({
      where: {
        userId,
        category: category ?? undefined,
      },
      orderBy: [{ category: 'asc' }, { label: 'asc' }, { createdAt: 'asc' }],
    });

    return templates.map(this.toDTO);
  }

  async create(userId: string, data: CreateFixedExpenseTemplateDTO): Promise<FixedExpenseTemplateDTO> {
    const template = await prisma.fixedExpenseTemplate.create({
      data: {
        userId,
        category: data.category,
        label: data.label,
        amount: data.amount,
      },
    });

    return this.toDTO(template);
  }

  async update(
    id: string,
    userId: string,
    data: UpdateFixedExpenseTemplateDTO
  ): Promise<FixedExpenseTemplateDTO> {
    const existing = await prisma.fixedExpenseTemplate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('Fixed expense template not found', 404, 'NOT_FOUND');
    }

    const template = await prisma.fixedExpenseTemplate.update({
      where: { id },
      data: {
        category: data.category ?? undefined,
        label: data.label ?? undefined,
        amount: data.amount ?? undefined,
      },
    });

    return this.toDTO(template);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.fixedExpenseTemplate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('Fixed expense template not found', 404, 'NOT_FOUND');
    }

    await prisma.fixedExpenseTemplate.delete({
      where: { id },
    });
  }

  async applyToPeriod(
    periodKey: string,
    userId: string,
    data: ApplyFixedExpenseTemplatesDTO
  ): Promise<ApplyFixedExpenseTemplatesResultDTO> {
    const [yearStr, monthStr] = periodKey.split('-');
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      throw new AppError(`Invalid period key format: ${periodKey}`, 400, 'INVALID_PERIOD_KEY');
    }

    const monthPeriod = await monthPeriodService.getOrCreate(userId, year, month);

    const templates = await prisma.fixedExpenseTemplate.findMany({
      where: {
        userId,
        category: data.category,
        id: data.templateIds && data.templateIds.length > 0 ? { in: data.templateIds } : undefined,
      },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
    });

    if (templates.length === 0) {
      return {
        createdCount: 0,
        skippedCount: 0,
        created: [],
      };
    }

    const existingFixedExpenses = await prisma.expense.findMany({
      where: {
        monthPeriodId: monthPeriod.id,
        category: data.category,
        isFixed: true,
        label: { in: templates.map((template) => template.label) },
      },
      select: {
        label: true,
        amount: true,
      },
    });

    const existingKeys = new Set(
      existingFixedExpenses.map((expense) => this.buildDedupKey(expense.label, expense.amount))
    );

    const created: ApplyFixedExpenseTemplatesResultDTO['created'] = [];
    let skippedCount = 0;

    for (const template of templates) {
      const dedupKey = this.buildDedupKey(template.label, template.amount);
      if (existingKeys.has(dedupKey)) {
        skippedCount += 1;
        continue;
      }

      const createdExpense = await expenseService.create(periodKey, userId, {
        date: `${periodKey}-01`,
        category: template.category,
        label: template.label,
        amount: template.amount,
        isFixed: true,
        tricountType: null,
      });

      existingKeys.add(dedupKey);
      created.push(createdExpense);
    }

    return {
      createdCount: created.length,
      skippedCount,
      created,
    };
  }

  private buildDedupKey(label: string, amount: number): string {
    return `${label.trim().toLowerCase()}::${amount.toFixed(2)}`;
  }

  private toDTO(template: {
    id: string;
    category: string;
    label: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
  }): FixedExpenseTemplateDTO {
    return {
      id: template.id,
      category: template.category as FixedExpenseCategory,
      label: template.label,
      amount: template.amount,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }
}

export const fixedExpenseTemplateService = new FixedExpenseTemplateService();
