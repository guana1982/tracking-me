import { prisma } from '../lib/prisma.js';
import type { ExpenseDTO, CreateExpenseDTO, UpdateExpenseDTO, ExpenseFilters, PaginatedResponse } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import type { Category } from '@budget/shared';

export class ExpenseService {
  /**
   * Get expenses for a period with filters and pagination (user-scoped)
   */
  async getByPeriodKey(
    periodKey: string,
    userId: string,
    filters: ExpenseFilters = {}
  ): Promise<PaginatedResponse<ExpenseDTO>> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    const { category, startDate, endDate, search, page = 1, pageSize = 20 } = filters;

    // Build where clause
    const where: any = {
      monthPeriodId: period.id,
    };

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.expense.count({ where });

    // Get paginated results
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: expenses.map(this.toDTO),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get all expenses for a period (no pagination, for calculations) (user-scoped)
   */
  async getAllByPeriodKey(periodKey: string, userId: string): Promise<ExpenseDTO[]> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: {
        expenses: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    return period.expenses.map(this.toDTO);
  }

  /**
   * Get recent expenses for a period (user-scoped)
   */
  async getRecent(periodKey: string, userId: string, limit: number = 5): Promise<ExpenseDTO[]> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    const expenses = await prisma.expense.findMany({
      where: { monthPeriodId: period.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return expenses.map(this.toDTO);
  }

  /**
   * Get expense by ID (user-scoped)
   */
  async getById(id: string, userId: string): Promise<ExpenseDTO | null> {
    const expense = await prisma.expense.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    return expense ? this.toDTO(expense) : null;
  }

  /**
   * Create a new expense (user-scoped)
   */
  async create(periodKey: string, userId: string, data: CreateExpenseDTO): Promise<ExpenseDTO> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    // Parse date properly to avoid timezone issues
    let parsedDate: Date;
    if (data.date.length === 10) {
      // If it's just a date (YYYY-MM-DD), parse it as local date at noon to avoid timezone shifts
      const [year, month, day] = data.date.split('-').map(Number);
      parsedDate = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      parsedDate = new Date(data.date);
    }

    const expense = await prisma.expense.create({
      data: {
        monthPeriodId: period.id,
        date: parsedDate,
        category: data.category,
        label: data.label,
        amount: data.amount,
        notes: data.notes || null,
      },
    });

    return this.toDTO(expense);
  }

  /**
   * Update an expense (user-scoped)
   */
  async update(id: string, userId: string, data: UpdateExpenseDTO): Promise<ExpenseDTO> {
    const existing = await prisma.expense.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    if (!existing) {
      throw new AppError('Expense not found', 404, 'NOT_FOUND');
    }

    // Parse date properly to avoid timezone issues
    let parsedDate: Date | undefined;
    if (data.date) {
      // If it's just a date (YYYY-MM-DD), parse it as local date at noon to avoid timezone shifts
      if (data.date.length === 10) {
        const [year, month, day] = data.date.split('-').map(Number);
        parsedDate = new Date(year, month - 1, day, 12, 0, 0);
      } else {
        parsedDate = new Date(data.date);
      }
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        date: parsedDate,
        category: data.category ?? undefined,
        label: data.label ?? undefined,
        amount: data.amount ?? undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
    });

    return this.toDTO(expense);
  }

  /**
   * Delete an expense (user-scoped)
   */
  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.expense.findFirst({
      where: {
        id,
        monthPeriod: { userId },
      },
    });

    if (!existing) {
      throw new AppError('Expense not found', 404, 'NOT_FOUND');
    }

    await prisma.expense.delete({
      where: { id },
    });
  }

  /**
   * Get totals by category for a period (user-scoped)
   */
  async getTotalsByCategory(periodKey: string, userId: string): Promise<Record<Category, number>> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    const totals = await prisma.expense.groupBy({
      by: ['category'],
      where: { monthPeriodId: period.id },
      _sum: { amount: true },
    });

    return {
      NEEDS: totals.find((t: { category: string }) => t.category === 'NEEDS')?._sum.amount ?? 0,
      WANTS: totals.find((t: { category: string }) => t.category === 'WANTS')?._sum.amount ?? 0,
      SAVINGS: totals.find((t: { category: string }) => t.category === 'SAVINGS')?._sum.amount ?? 0,
    };
  }

  private toDTO(expense: {
    id: string;
    monthPeriodId: string;
    date: Date;
    category: string;
    label: string;
    amount: number;
    notes: string | null;
    createdAt: Date;
  }): ExpenseDTO {
    return {
      id: expense.id,
      monthPeriodId: expense.monthPeriodId,
      date: expense.date.toISOString(),
      category: expense.category as Category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes,
      createdAt: expense.createdAt.toISOString(),
    };
  }
}

export const expenseService = new ExpenseService();
