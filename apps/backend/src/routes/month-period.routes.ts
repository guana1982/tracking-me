import type { FastifyPluginAsync } from 'fastify';
import { monthPeriodService } from '../services/month-period.service.js';
import { createMonthPeriodSchema, periodKeySchema } from '@budget/shared';

export const monthPeriodRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all month periods
  fastify.get('/', {
    schema: {
      tags: ['Month Periods'],
      summary: 'Get all month periods',
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
      const periods = await monthPeriodService.getAll();
      return { success: true, data: periods };
    },
  });

  // Get current month period (creates if not exists)
  fastify.get('/current', {
    schema: {
      tags: ['Month Periods'],
      summary: 'Get or create current month period',
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
      const period = await monthPeriodService.getOrCreateCurrent();
      return { success: true, data: period };
    },
  });

  // Get month period by period key
  fastify.get<{ Params: { periodKey: string } }>('/:periodKey', {
    schema: {
      tags: ['Month Periods'],
      summary: 'Get month period by period key (YYYY-MM)',
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

      const period = await monthPeriodService.getByPeriodKey(periodKey);
      if (!period) {
        reply.status(404);
        return { success: false, error: { code: 'NOT_FOUND', message: 'Month period not found' } };
      }

      return { success: true, data: period };
    },
  });

  // Create a new month period
  fastify.post<{ Body: { year: number; month: number } }>('/', {
    schema: {
      tags: ['Month Periods'],
      summary: 'Create a new month period',
      body: {
        type: 'object',
        properties: {
          year: { type: 'integer', minimum: 2020, maximum: 2100 },
          month: { type: 'integer', minimum: 1, maximum: 12 },
        },
        required: ['year', 'month'],
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
      const data = createMonthPeriodSchema.parse(request.body);
      const period = await monthPeriodService.create(data);
      reply.status(201);
      return { success: true, data: period };
    },
  });

  // Delete a month period
  fastify.delete<{ Params: { periodKey: string } }>('/:periodKey', {
    schema: {
      tags: ['Month Periods'],
      summary: 'Delete a month period',
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
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      await monthPeriodService.delete(periodKey);
      return { success: true };
    },
  });
};
