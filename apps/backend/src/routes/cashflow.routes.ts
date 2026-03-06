import type { FastifyPluginAsync } from 'fastify';
import { cashFlowService } from '../services/cashflow.service.js';
import { createCashFlowCheckSchema, updateCashFlowCheckSchema, cashFlowSettingsSchema } from '@budget/shared';
import type { CreateCashFlowCheckDTO, UpdateCashFlowCheckDTO, CashFlowSettingsDTO } from '@budget/shared';

export const cashFlowRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all checks for current user
  fastify.get('/checks', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get all cashflow checks',
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
    handler: async (request) => {
      const checks = await cashFlowService.getAllByUser(request.authUser!.id);
      return { success: true, data: checks };
    },
  });

  // Get check by ID
  fastify.get<{ Params: { id: string } }>('/checks/:id', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get cashflow check by ID',
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
      const { id } = request.params;
      const check = await cashFlowService.getById(id, request.authUser!.id);

      if (!check) {
        reply.status(404);
        return { success: false, error: { code: 'NOT_FOUND', message: 'CashFlow check not found' } };
      }

      return { success: true, data: check };
    },
  });

  // Create check
  fastify.post<{ Body: CreateCashFlowCheckDTO }>('/checks', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Create cashflow check',
      body: {
        type: 'object',
        properties: {
          checkLabel: { type: 'string', minLength: 1, maxLength: 100 },
          date: { type: 'string', format: 'date' },
          bbva: { type: 'number' },
          tradeRepublic: { type: 'number' },
          webankCc: { type: 'number' },
          webankObbl: { type: 'number' },
          etfLordo: { type: 'number' },
          rendimentoLordo: { type: 'number' },
          bper: { type: 'number' },
          tricount: { type: 'number' },
          cartaWebank: { type: 'number' },
          edenred: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['checkLabel', 'date', 'bbva', 'tradeRepublic', 'webankCc', 'webankObbl', 'etfLordo', 'rendimentoLordo', 'bper', 'tricount', 'cartaWebank', 'edenred'],
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
      const data = createCashFlowCheckSchema.parse(request.body);
      const check = await cashFlowService.create(request.authUser!.id, data);

      reply.status(201);
      return { success: true, data: check };
    },
  });

  // Update check
  fastify.put<{ Params: { id: string }; Body: UpdateCashFlowCheckDTO }>('/checks/:id', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Update cashflow check',
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
          checkLabel: { type: 'string', minLength: 1, maxLength: 100 },
          date: { type: 'string', format: 'date' },
          bbva: { type: 'number' },
          tradeRepublic: { type: 'number' },
          webankCc: { type: 'number' },
          webankObbl: { type: 'number' },
          etfLordo: { type: 'number' },
          rendimentoLordo: { type: 'number' },
          bper: { type: 'number' },
          tricount: { type: 'number' },
          cartaWebank: { type: 'number' },
          edenred: { type: 'number' },
          notes: { type: 'string' },
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
      const { id } = request.params;
      const data = updateCashFlowCheckSchema.parse(request.body);
      const check = await cashFlowService.update(id, request.authUser!.id, data);

      return { success: true, data: check };
    },
  });

  // Delete check
  fastify.delete<{ Params: { id: string } }>('/checks/:id', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Delete cashflow check',
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
    handler: async (request) => {
      const { id } = request.params;
      await cashFlowService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });

  // Get settings
  fastify.get('/settings', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get cashflow settings',
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
    handler: async (request) => {
      const settings = await cashFlowService.getSettings(request.authUser!.id);
      return { success: true, data: settings };
    },
  });

  // Update settings (upsert)
  fastify.put<{ Body: CashFlowSettingsDTO }>('/settings', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Update cashflow settings',
      body: {
        type: 'object',
        properties: {
          commissionPerEtf: { type: 'number', minimum: 0 },
          etfCount: { type: 'number', minimum: 0 },
        },
        required: ['commissionPerEtf', 'etfCount'],
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
    handler: async (request) => {
      const data = cashFlowSettingsSchema.parse(request.body);
      const settings = await cashFlowService.updateSettings(request.authUser!.id, data);
      return { success: true, data: settings };
    },
  });
};
