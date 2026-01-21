import type { FastifyPluginAsync } from 'fastify';
import { dashboardService } from '../services/dashboard.service.js';
import { periodKeySchema } from '@budget/shared';
import { getCurrentPeriodKey } from '../lib/utils.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Get dashboard summary for current month
  fastify.get('/current', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get dashboard summary for current month',
    },
    handler: async () => {
      const periodKey = getCurrentPeriodKey();
      const summary = await dashboardService.getSummary(periodKey);
      return { success: true, data: summary };
    },
  });

  // Get dashboard summary for a specific period
  fastify.get<{ Params: { periodKey: string } }>('/:periodKey', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get dashboard summary for a specific period',
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

      const summary = await dashboardService.getSummary(periodKey);
      return { success: true, data: summary };
    },
  });
};
