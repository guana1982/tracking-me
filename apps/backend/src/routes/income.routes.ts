import type { FastifyPluginAsync } from 'fastify';
import { incomeService } from '../services/income.service.js';
import { createIncomeSchema, updateIncomeSchema, periodKeySchema } from '@budget/shared';
import type { CreateIncomeDTO, UpdateIncomeDTO } from '@budget/shared';

export const incomeRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all incomes for a period
  fastify.get<{ Params: { periodKey: string } }>('/period/:periodKey', {
    schema: {
      tags: ['Incomes'],
      summary: 'Get all incomes for a period',
      params: {
        type: 'object',
        properties: {
          periodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        },
        required: ['periodKey'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const incomes = await incomeService.getByPeriodKey(periodKey, request.authUser!.id);
      return { success: true, data: incomes };
    },
  });

  // Get income by ID
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Incomes'],
      summary: 'Get income by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const income = await incomeService.getById(id, request.authUser!.id);

      if (!income) {
        reply.status(404);
        return { success: false, error: { code: 'NOT_FOUND', message: 'Income not found' } };
      }

      return { success: true, data: income };
    },
  });

  // Create income for a period
  fastify.post<{ Params: { periodKey: string }; Body: CreateIncomeDTO }>('/period/:periodKey', {
    schema: {
      tags: ['Incomes'],
      summary: 'Create income for a period',
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
          label: { type: 'string', minLength: 1, maxLength: 100 },
          amount: { type: 'number', minimum: 0.01 },
        },
        required: ['label', 'amount'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const data = createIncomeSchema.parse(request.body);
      const income = await incomeService.create(periodKey, request.authUser!.id, data);

      reply.status(201);
      return { success: true, data: income };
    },
  });

  // Update income
  fastify.put<{ Params: { id: string }; Body: UpdateIncomeDTO }>('/:id', {
    schema: {
      tags: ['Incomes'],
      summary: 'Update income',
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
          label: { type: 'string', minLength: 1, maxLength: 100 },
          amount: { type: 'number', minimum: 0.01 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const data = updateIncomeSchema.parse(request.body);
      const income = await incomeService.update(id, request.authUser!.id, data);

      return { success: true, data: income };
    },
  });

  // Delete income
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Incomes'],
      summary: 'Delete income',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      await incomeService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });
};
