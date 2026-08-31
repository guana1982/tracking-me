import type { FastifyPluginAsync } from 'fastify';
import { wealthGoalService } from '../services/wealth-goal.service.js';
import { createWealthGoalSchema, updateWealthGoalSchema } from '@budget/shared';
import type { CreateWealthGoalDTO, UpdateWealthGoalDTO } from '@budget/shared';

export const wealthGoalRoutes: FastifyPluginAsync = async (fastify) => {
  // List goals with computed progress and projections
  fastify.get('/', {
    schema: {
      tags: ['Wealth Goals'],
      summary: 'Get all wealth goals with computed stats',
    },
    handler: async (request) => {
      const goals = await wealthGoalService.getAll(request.authUser!.id);
      return { success: true, data: goals };
    },
  });

  // Create goal
  fastify.post<{ Body: CreateWealthGoalDTO }>('/', {
    schema: {
      tags: ['Wealth Goals'],
      summary: 'Create a wealth goal',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          targetAmount: { type: 'number', minimum: 0.01 },
          targetDate: { type: ['string', 'null'], format: 'date' },
        },
        required: ['name', 'targetAmount'],
      },
    },
    handler: async (request, reply) => {
      const data = createWealthGoalSchema.parse(request.body);
      await wealthGoalService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true };
    },
  });

  // Update goal
  fastify.put<{ Params: { id: string }; Body: UpdateWealthGoalDTO }>('/:id', {
    schema: {
      tags: ['Wealth Goals'],
      summary: 'Update a wealth goal',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          targetAmount: { type: 'number', minimum: 0.01 },
          targetDate: { type: ['string', 'null'], format: 'date' },
        },
      },
    },
    handler: async (request) => {
      const data = updateWealthGoalSchema.parse(request.body);
      await wealthGoalService.update(request.params.id, request.authUser!.id, data);
      return { success: true };
    },
  });

  // Delete goal
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Wealth Goals'],
      summary: 'Delete a wealth goal',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    handler: async (request) => {
      await wealthGoalService.delete(request.params.id, request.authUser!.id);
      return { success: true };
    },
  });
};
