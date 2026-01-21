import type { FastifyPluginAsync } from 'fastify';
import { budgetRuleService } from '../services/budget-rule.service.js';
import { updateBudgetRuleSchema, periodKeySchema } from '@budget/shared';
import type { UpdateBudgetRuleDTO } from '@budget/shared';

export const budgetRuleRoutes: FastifyPluginAsync = async (fastify) => {
  // Get budget rule by period key
  fastify.get<{ Params: { periodKey: string } }>('/:periodKey', {
    schema: {
      tags: ['Budget Rules'],
      summary: 'Get budget rule for a period',
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
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const rule = await budgetRuleService.getByPeriodKey(periodKey);
      if (!rule) {
        reply.status(404);
        return { success: false, error: { code: 'NOT_FOUND', message: 'Budget rule not found' } };
      }

      return { success: true, data: rule };
    },
  });

  // Update budget rule for a period
  fastify.put<{ Params: { periodKey: string }; Body: UpdateBudgetRuleDTO }>('/:periodKey', {
    schema: {
      tags: ['Budget Rules'],
      summary: 'Update budget rule for a period',
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
          needsPct: { type: 'number', minimum: 0, maximum: 100 },
          wantsPct: { type: 'number', minimum: 0, maximum: 100 },
          savingsPct: { type: 'number', minimum: 0, maximum: 100 },
          cutoffDay: { type: 'integer', minimum: 1, maximum: 31 },
          autoReallocateNeedsRemainder: { type: 'boolean' },
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
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const data = updateBudgetRuleSchema.parse(request.body);
      const rule = await budgetRuleService.update(periodKey, data);

      return { success: true, data: rule };
    },
  });
};
