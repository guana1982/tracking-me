import type { FastifyPluginAsync } from 'fastify';
import {
  applyFixedExpenseTemplatesSchema,
  createFixedExpenseTemplateSchema,
  fixedExpenseCategorySchema,
  periodKeySchema,
  updateFixedExpenseTemplateSchema,
} from '@budget/shared';
import type {
  ApplyFixedExpenseTemplatesDTO,
  CreateFixedExpenseTemplateDTO,
  FixedExpenseCategory,
  UpdateFixedExpenseTemplateDTO,
} from '@budget/shared';
import { fixedExpenseTemplateService } from '../services/fixed-expense-template.service.js';

export const fixedExpenseTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { category?: FixedExpenseCategory } }>('/', {
    schema: {
      tags: ['Fixed Expenses'],
      summary: 'Get fixed expense templates for the authenticated user',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['NEEDS', 'WANTS'] },
        },
      },
    },
    handler: async (request) => {
      const category = request.query.category
        ? fixedExpenseCategorySchema.parse(request.query.category)
        : undefined;
      const templates = await fixedExpenseTemplateService.getAll(request.authUser!.id, category);
      return { success: true, data: templates };
    },
  });

  fastify.post<{ Body: CreateFixedExpenseTemplateDTO }>('/', {
    schema: {
      tags: ['Fixed Expenses'],
      summary: 'Create a fixed expense template',
      body: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['NEEDS', 'WANTS'] },
          label: { type: 'string', minLength: 1, maxLength: 200 },
          amount: { type: 'number', minimum: 0.01 },
        },
        required: ['category', 'label', 'amount'],
      },
    },
    handler: async (request, reply) => {
      const data = createFixedExpenseTemplateSchema.parse(request.body);
      const template = await fixedExpenseTemplateService.create(request.authUser!.id, data);

      reply.status(201);
      return { success: true, data: template };
    },
  });

  fastify.put<{ Params: { id: string }; Body: UpdateFixedExpenseTemplateDTO }>('/:id', {
    schema: {
      tags: ['Fixed Expenses'],
      summary: 'Update a fixed expense template',
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
          category: { type: 'string', enum: ['NEEDS', 'WANTS'] },
          label: { type: 'string', minLength: 1, maxLength: 200 },
          amount: { type: 'number', minimum: 0.01 },
        },
      },
    },
    handler: async (request) => {
      const { id } = request.params;
      const data = updateFixedExpenseTemplateSchema.parse(request.body);
      const template = await fixedExpenseTemplateService.update(id, request.authUser!.id, data);
      return { success: true, data: template };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Fixed Expenses'],
      summary: 'Delete a fixed expense template',
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
      await fixedExpenseTemplateService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });

  fastify.post<{ Params: { periodKey: string }; Body: ApplyFixedExpenseTemplatesDTO }>(
    '/apply/:periodKey',
    {
      schema: {
        tags: ['Fixed Expenses'],
        summary: 'Apply fixed expense templates to a month period',
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
            category: { type: 'string', enum: ['NEEDS', 'WANTS'] },
            templateIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['category'],
        },
      },
      handler: async (request) => {
        const { periodKey } = request.params;
        periodKeySchema.parse(periodKey);

        const data = applyFixedExpenseTemplatesSchema.parse(request.body);
        const result = await fixedExpenseTemplateService.applyToPeriod(
          periodKey,
          request.authUser!.id,
          data
        );

        return { success: true, data: result };
      },
    }
  );
};
