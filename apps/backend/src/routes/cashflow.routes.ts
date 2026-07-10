import type { FastifyPluginAsync } from 'fastify';
import { cashFlowService } from '../services/cashflow.service.js';
import {
  createCashFlowCheckSchema,
  updateCashFlowCheckSchema,
  cashFlowSettingsSchema,
  createCashFlowColumnSchema,
  updateCashFlowColumnSchema,
  createCashFlowClassificationSchema,
  updateCashFlowClassificationSchema,
} from '@budget/shared';
import type {
  CreateCashFlowCheckDTO,
  UpdateCashFlowCheckDTO,
  CashFlowSettingsDTO,
  CreateCashFlowColumnDTO,
  UpdateCashFlowColumnDTO,
  CreateCashFlowClassificationDTO,
  UpdateCashFlowClassificationDTO,
} from '@budget/shared';

export const cashFlowRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all checks for current user
  fastify.get('/checks', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get all cashflow checks',
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
          values: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
          notes: { type: 'string' },
        },
        required: ['checkLabel', 'date', 'values'],
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
          values: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
          notes: { type: 'string' },
        },
      },
    },
    handler: async (request) => {
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
    },
    handler: async (request) => {
      const { id } = request.params;
      await cashFlowService.delete(id, request.authUser!.id);
      return { success: true };
    },
  });

  // Get columns
  fastify.get('/columns', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get cashflow dynamic columns',
    },
    handler: async (request) => {
      const columns = await cashFlowService.getColumns(request.authUser!.id);
      return { success: true, data: columns };
    },
  });

  // Create column
  fastify.post<{ Body: CreateCashFlowColumnDTO }>('/columns', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Create cashflow dynamic column',
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
        },
        required: ['label'],
      },
    },
    handler: async (request, reply) => {
      const data = createCashFlowColumnSchema.parse(request.body);
      const column = await cashFlowService.createColumn(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: column };
    },
  });

  // Swap two columns
  fastify.put<{ Body: { keyA: string; keyB: string } }>('/columns/swap', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Swap two cashflow columns positions',
      body: {
        type: 'object',
        properties: {
          keyA: { type: 'string' },
          keyB: { type: 'string' },
        },
        required: ['keyA', 'keyB'],
      },
    },
    handler: async (request) => {
      const { keyA, keyB } = request.body;
      const columns = await cashFlowService.swapColumns(request.authUser!.id, keyA, keyB);
      return { success: true, data: columns };
    },
  });

  // Update column
  fastify.put<{ Params: { key: string }; Body: UpdateCashFlowColumnDTO }>('/columns/:key', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Update cashflow dynamic column',
      params: {
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
        required: ['key'],
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
          position: { type: 'number', minimum: 0 },
          isActive: { type: 'boolean' },
          showInPie: { type: 'boolean' },
          taxRatePct: { type: ['number', 'null'], minimum: 0, maximum: 100 },
          gainColumnKey: { type: ['string', 'null'] },
        },
      },
    },
    handler: async (request) => {
      const { key } = request.params;
      const data = updateCashFlowColumnSchema.parse(request.body);
      const column = await cashFlowService.updateColumn(request.authUser!.id, key, data);
      return { success: true, data: column };
    },
  });

  // Delete column
  fastify.delete<{ Params: { key: string } }>('/columns/:key', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Delete cashflow dynamic column',
      params: {
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
        required: ['key'],
      },
    },
    handler: async (request) => {
      const { key } = request.params;
      await cashFlowService.deleteColumn(request.authUser!.id, key);
      return { success: true };
    },
  });

  // ── Classifications ──────────────────────────────────────────

  // Get classifications
  fastify.get('/classifications', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get cashflow column classifications',
    },
    handler: async (request) => {
      const classifications = await cashFlowService.getClassifications(request.authUser!.id);
      return { success: true, data: classifications };
    },
  });

  // Create classification
  fastify.post<{ Body: CreateCashFlowClassificationDTO }>('/classifications', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Create cashflow column classification',
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
        },
        required: ['label'],
      },
    },
    handler: async (request, reply) => {
      const data = createCashFlowClassificationSchema.parse(request.body);
      const classification = await cashFlowService.createClassification(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: classification };
    },
  });

  // Update classification
  fastify.put<{ Params: { key: string }; Body: UpdateCashFlowClassificationDTO }>('/classifications/:key', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Update cashflow column classification',
      params: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
          columnKeys: { type: 'array', items: { type: 'string' } },
          position: { type: 'number', minimum: 0 },
        },
      },
    },
    handler: async (request) => {
      const { key } = request.params;
      const data = updateCashFlowClassificationSchema.parse(request.body);
      const classification = await cashFlowService.updateClassification(request.authUser!.id, key, data);
      return { success: true, data: classification };
    },
  });

  // Delete classification
  fastify.delete<{ Params: { key: string } }>('/classifications/:key', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Delete cashflow column classification',
      params: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
    },
    handler: async (request) => {
      const { key } = request.params;
      await cashFlowService.deleteClassification(request.authUser!.id, key);
      return { success: true };
    },
  });

  // Get settings
  fastify.get('/settings', {
    schema: {
      tags: ['CashFlow'],
      summary: 'Get cashflow settings',
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
    },
    handler: async (request) => {
      const data = cashFlowSettingsSchema.parse(request.body);
      const settings = await cashFlowService.updateSettings(request.authUser!.id, data);
      return { success: true, data: settings };
    },
  });
};
