import type { FastifyPluginAsync } from 'fastify';
import { expenseService } from '../services/expense.service.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema,
  periodKeySchema,
} from '@budget/shared';
import type { CreateExpenseDTO, UpdateExpenseDTO, ExpenseFilters } from '@budget/shared';

export const expenseRoutes: FastifyPluginAsync = async (fastify) => {
  // Get expenses for a period with filters
  fastify.get<{ Params: { periodKey: string }; Querystring: ExpenseFilters }>(
    '/period/:periodKey',
    {
      schema: {
        tags: ['Expenses'],
        summary: 'Get expenses for a period with filters',
        params: {
          type: 'object',
          properties: {
            periodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
          },
          required: ['periodKey'],
        },
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['NEEDS', 'WANTS', 'SAVINGS'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            search: { type: 'string', maxLength: 100 },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      handler: async (request) => {
        const { periodKey } = request.params;
        periodKeySchema.parse(periodKey);

        const filters = expenseFiltersSchema.parse(request.query);
        const result = await expenseService.getByPeriodKey(periodKey, request.authUser!.id, filters);

        return { success: true, data: result };
      },
    }
  );

  // Get expense by ID
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Expenses'],
      summary: 'Get expense by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const expense = await expenseService.getById(id, request.authUser!.id);

      if (!expense) {
        reply.status(404);
        return { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } };
      }

      return { success: true, data: expense };
    },
  });

  // Create expense for a period
  fastify.post<{ Params: { periodKey: string }; Body: CreateExpenseDTO }>(
    '/period/:periodKey',
    {
      schema: {
        tags: ['Expenses'],
        summary: 'Create expense for a period',
        params: {
          type: 'object',
          properties: {
            periodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
          },
          required: ['periodKey'],
        },
        body: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            category: { type: 'string', enum: ['NEEDS', 'WANTS', 'SAVINGS'] },
            label: { type: 'string', minLength: 1, maxLength: 200 },
            amount: { type: 'number', minimum: 0.01 },
            notes: { type: 'string', maxLength: 500 },
            isFixed: { type: 'boolean' },
            tricountType: { type: 'string', enum: ['IO', 'FRA'], nullable: true },
          },
          required: ['date', 'category', 'label', 'amount'],
        },
      },
      handler: async (request, reply) => {
        const { periodKey } = request.params;
        periodKeySchema.parse(periodKey);

        const data = createExpenseSchema.parse(request.body);
        const expense = await expenseService.create(periodKey, request.authUser!.id, data);

        reply.status(201);
        return { success: true, data: expense };
      },
    }
  );

  // Update expense
  fastify.put<{ Params: { id: string }; Body: UpdateExpenseDTO }>('/:id', {
    schema: {
      tags: ['Expenses'],
      summary: 'Update expense',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          category: { type: 'string', enum: ['NEEDS', 'WANTS', 'SAVINGS'] },
          label: { type: 'string', minLength: 1, maxLength: 200 },
          amount: { type: 'number', minimum: 0.01 },
          notes: { type: 'string', maxLength: 500 },
          isFixed: { type: 'boolean' },
          tricountType: { type: 'string', enum: ['IO', 'FRA'], nullable: true },
        },
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const data = updateExpenseSchema.parse(request.body);
      const expense = await expenseService.update(id, request.authUser!.id, data);

      return { success: true, data: expense };
    },
  });

  // Delete expense
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Expenses'],
      summary: 'Delete expense',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      await expenseService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });
};
