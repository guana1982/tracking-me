import type { FastifyPluginAsync } from 'fastify';
import { quickLogService } from '../services/quick-log.service.js';
import {
  createQuickLogSchema,
  updateQuickLogSchema,
  foodRangeQuerySchema,
} from '@budget/shared';

export const quickLogRoutes: FastifyPluginAsync = async (fastify) => {
  // List quick logs in a date range (interleaved in the diary view)
  fastify.get('/', {
    schema: {
      tags: ['Quick Logs'],
      summary: 'Get quick logs in a date range',
    },
    handler: async (request) => {
      const { from, to } = foodRangeQuerySchema.parse(request.query);
      const logs = await quickLogService.getByRange(request.authUser!.id, from, to);
      return { success: true, data: logs };
    },
  });

  // Create: raw text only; classification and meal-linking are automatic
  fastify.post('/', {
    schema: {
      tags: ['Quick Logs'],
      summary: 'Create a quick log (auto-classified, auto-linked)',
    },
    handler: async (request, reply) => {
      const data = createQuickLogSchema.parse(request.body);
      const log = await quickLogService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: log };
    },
  });

  // Update text (re-classifies) or manually correct category/valence
  fastify.put<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Quick Logs'],
      summary: 'Update a quick log',
    },
    handler: async (request) => {
      const data = updateQuickLogSchema.parse(request.body);
      const log = await quickLogService.update(request.params.id, request.authUser!.id, data);
      return { success: true, data: log };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Quick Logs'],
      summary: 'Delete a quick log',
    },
    handler: async (request) => {
      await quickLogService.delete(request.params.id, request.authUser!.id);
      return { success: true };
    },
  });

  // Re-run the keyword dictionaries over the history (manual edits preserved)
  fastify.post('/recalculate', {
    schema: {
      tags: ['Quick Logs'],
      summary: 'Recalculate derived fields for all quick logs',
    },
    handler: async (request) => {
      const result = await quickLogService.recalculate(request.authUser!.id);
      return { success: true, data: result };
    },
  });
};
