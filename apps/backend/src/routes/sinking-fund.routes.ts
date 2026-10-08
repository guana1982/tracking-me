import type { FastifyPluginAsync } from 'fastify';
import { sinkingFundService } from '../services/sinking-fund.service.js';
import { createSinkingFundSchema, updateSinkingFundSchema } from '@budget/shared';
import type { CreateSinkingFundDTO, UpdateSinkingFundDTO } from '@budget/shared';

export const sinkingFundRoutes: FastifyPluginAsync = async (fastify) => {
  // List funds with computed balances
  fastify.get('/', {
    schema: {
      tags: ['Sinking Funds'],
      summary: 'Get all sinking funds with computed balances',
    },
    handler: async (request) => {
      const funds = await sinkingFundService.getAll(request.authUser!.id);
      return { success: true, data: funds };
    },
  });

  // Create fund
  fastify.post<{ Body: CreateSinkingFundDTO }>('/', {
    schema: {
      tags: ['Sinking Funds'],
      summary: 'Create a sinking fund',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          monthlyAmount: { type: 'number', minimum: 0.01 },
          spendingCategoryId: { type: 'string' },
          startPeriodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        },
        required: ['name', 'monthlyAmount', 'spendingCategoryId'],
      },
    },
    handler: async (request, reply) => {
      const data = createSinkingFundSchema.parse(request.body);
      await sinkingFundService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true };
    },
  });

  // Update fund
  fastify.put<{ Params: { id: string }; Body: UpdateSinkingFundDTO }>('/:id', {
    schema: {
      tags: ['Sinking Funds'],
      summary: 'Update a sinking fund',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          monthlyAmount: { type: 'number', minimum: 0.01 },
          spendingCategoryId: { type: 'string' },
          startPeriodKey: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        },
      },
    },
    handler: async (request) => {
      const data = updateSinkingFundSchema.parse(request.body);
      await sinkingFundService.update(request.params.id, request.authUser!.id, data);
      return { success: true };
    },
  });

  // Delete fund
  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Sinking Funds'],
      summary: 'Delete a sinking fund',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    handler: async (request) => {
      await sinkingFundService.delete(request.params.id, request.authUser!.id);
      return { success: true };
    },
  });
};
