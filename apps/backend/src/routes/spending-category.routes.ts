import type { FastifyPluginAsync } from 'fastify';
import { spendingCategoryService } from '../services/spending-category.service.js';
import {
  createSpendingCategorySchema,
  updateSpendingCategorySchema,
  createCategoryRuleSchema,
  periodKeySchema,
} from '@budget/shared';
import type {
  CreateSpendingCategoryDTO,
  UpdateSpendingCategoryDTO,
  CreateCategoryRuleDTO,
} from '@budget/shared';

export const spendingCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  // List categories with their keyword rules
  fastify.get('/', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Get all spending categories with rules',
    },
    handler: async (request) => {
      const categories = await spendingCategoryService.getAll(request.authUser!.id);
      return { success: true, data: categories };
    },
  });

  // Global spending breakdown across the whole history
  fastify.get('/breakdown', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Get global spending breakdown by category (whole history)',
    },
    handler: async (request) => {
      const breakdown = await spendingCategoryService.getGlobalBreakdown(request.authUser!.id);
      return { success: true, data: breakdown };
    },
  });

  // Spending breakdown by category for a period
  fastify.get<{ Params: { periodKey: string } }>('/breakdown/:periodKey', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Get spending breakdown by category for a period',
      params: {
        type: 'object',
        properties: {
          periodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        },
        required: ['periodKey'],
      },
    },
    handler: async (request) => {
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const breakdown = await spendingCategoryService.getBreakdown(
        periodKey,
        request.authUser!.id
      );
      return { success: true, data: breakdown };
    },
  });

  // Create category (optionally with initial keywords)
  fastify.post<{ Body: CreateSpendingCategoryDTO }>('/', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Create a spending category',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          keywords: {
            type: 'array',
            items: { type: 'string', minLength: 2, maxLength: 80 },
            maxItems: 50,
          },
        },
        required: ['name'],
      },
    },
    handler: async (request, reply) => {
      const data = createSpendingCategorySchema.parse(request.body);
      const category = await spendingCategoryService.create(request.authUser!.id, data);

      reply.status(201);
      return { success: true, data: category };
    },
  });

  // Update category name/color
  fastify.put<{ Params: { id: string }; Body: UpdateSpendingCategoryDTO }>('/:id', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Update a spending category',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        },
      },
    },
    handler: async (request) => {
      const data = updateSpendingCategorySchema.parse(request.body);
      await spendingCategoryService.update(request.params.id, request.authUser!.id, data);
      return { success: true };
    },
  });

  // Delete category (its expenses go back to unclassified)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Delete a spending category',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    handler: async (request) => {
      await spendingCategoryService.delete(request.params.id, request.authUser!.id);
      return { success: true };
    },
  });

  // Add a keyword rule to a category
  fastify.post<{ Params: { id: string }; Body: CreateCategoryRuleDTO }>('/:id/rules', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Add a keyword rule to a spending category',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          keyword: { type: 'string', minLength: 2, maxLength: 80 },
        },
        required: ['keyword'],
      },
    },
    handler: async (request, reply) => {
      const data = createCategoryRuleSchema.parse(request.body);
      await spendingCategoryService.addRule(
        request.params.id,
        request.authUser!.id,
        data.keyword
      );

      reply.status(201);
      return { success: true };
    },
  });

  // Delete a keyword rule
  fastify.delete<{ Params: { ruleId: string } }>('/rules/:ruleId', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Delete a keyword rule',
      params: {
        type: 'object',
        properties: { ruleId: { type: 'string' } },
        required: ['ruleId'],
      },
    },
    handler: async (request) => {
      await spendingCategoryService.deleteRule(request.params.ruleId, request.authUser!.id);
      return { success: true };
    },
  });

  // Re-run the classifier over the whole expense history
  fastify.post('/reclassify', {
    schema: {
      tags: ['Spending Categories'],
      summary: 'Reclassify all expenses (manual overrides preserved)',
    },
    handler: async (request) => {
      const result = await spendingCategoryService.reclassifyAll(request.authUser!.id);
      return { success: true, data: result };
    },
  });
};
