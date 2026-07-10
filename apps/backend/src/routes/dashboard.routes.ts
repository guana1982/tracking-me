import type { FastifyPluginAsync } from 'fastify';
import { dashboardService } from '../services/dashboard.service.js';
import { kpiService } from '../services/kpi.service.js';
import { periodKeySchema } from '@budget/shared';
import { getCurrentPeriodKey } from '../lib/utils.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Get dashboard summary for current month
  fastify.get('/current', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get dashboard summary for current month',
    },
    handler: async (request) => {
      const periodKey = getCurrentPeriodKey();
      const summary = await dashboardService.getSummary(periodKey, request.authUser!.id);
      return { success: true, data: summary };
    },
  });

  // Get savings history across all months
  fastify.get<{ Params: { periodKey: string } }>('/savings-history/:periodKey', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get savings history for all months',
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
      const history = await dashboardService.getSavingsHistory(periodKey, request.authUser!.id);
      return { success: true, data: history };
    },
  });

  // Get savings pace (current-vs-best-month comparison) for a period
  fastify.get<{ Params: { periodKey: string } }>('/savings-pace/:periodKey', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get savings pace for a period (compare vs best-savings month)',
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
      const pace = await dashboardService.getSavingsPace(periodKey, request.authUser!.id);
      return { success: true, data: pace };
    },
  });

  // Get CFO-style KPI panel for a period
  fastify.get<{ Params: { periodKey: string } }>('/kpis/:periodKey', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get KPI panel (savings rate, fixed cost ratio, runway, net worth)',
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
      const kpis = await kpiService.getKpis(periodKey, request.authUser!.id);
      return { success: true, data: kpis };
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

      const summary = await dashboardService.getSummary(periodKey, request.authUser!.id);
      return { success: true, data: summary };
    },
  });
};
