import type { FastifyPluginAsync } from 'fastify';
import { reallocationService } from '../services/reallocation.service.js';
import { createReallocationSchema, periodKeySchema } from '@budget/shared';
import type { CreateReallocationDTO } from '@budget/shared';

export const reallocationRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all reallocations for a period
  fastify.get<{ Params: { periodKey: string } }>('/period/:periodKey', {
    schema: {
      tags: ['Reallocations'],
      summary: 'Get all reallocations for a period',
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

      const reallocations = await reallocationService.getByPeriodKey(periodKey, request.authUser!.id);
      return { success: true, data: reallocations };
    },
  });

  // Get reallocation preview for a period
  fastify.get<{ Params: { periodKey: string } }>('/period/:periodKey/preview', {
    schema: {
      tags: ['Reallocations'],
      summary: 'Get reallocation preview (how much can be reallocated)',
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
            data: {
              type: 'object',
              properties: {
                available: { type: 'boolean' },
                needsRemainder: { type: 'number' },
                suggestedAmount: { type: 'number' },
                cutoffDay: { type: 'number' },
                isAfterCutoff: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { periodKey } = request.params;
      periodKeySchema.parse(periodKey);

      const preview = await reallocationService.getPreview(periodKey, request.authUser!.id);
      return { success: true, data: preview };
    },
  });

  // Execute reallocation for a period
  fastify.post<{ Params: { periodKey: string }; Body: CreateReallocationDTO }>(
    '/period/:periodKey',
    {
      schema: {
        tags: ['Reallocations'],
        summary: 'Execute a reallocation (transfer NEEDS remainder to SAVINGS)',
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
            fromCategory: { type: 'string', enum: ['NEEDS', 'WANTS', 'SAVINGS'] },
            toCategory: { type: 'string', enum: ['NEEDS', 'WANTS', 'SAVINGS'] },
            amount: { type: 'number', minimum: 0.01 },
            reason: { type: 'string', maxLength: 200 },
          },
          required: ['fromCategory', 'toCategory', 'amount'],
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

        const data = createReallocationSchema.parse(request.body);
        const reallocation = await reallocationService.create(periodKey, request.authUser!.id, data);

        reply.status(201);
        return { success: true, data: reallocation };
      },
    }
  );

  // Delete reallocation (undo)
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Reallocations'],
      summary: 'Delete/undo a reallocation',
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
      await reallocationService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });
};
