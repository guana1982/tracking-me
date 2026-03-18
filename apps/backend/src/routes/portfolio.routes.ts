import type { FastifyPluginAsync } from 'fastify';
import { portfolioService } from '../services/portfolio.service.js';
import {
  createPortfolioAssetClassSchema,
  createPortfolioInstrumentSchema,
  portfolioCompareRequestSchema,
  portfolioHistoryQuerySchema,
  updatePortfolioAssetClassSchema,
  updatePortfolioInstrumentSchema,
  updatePortfolioInvestedStateSchema,
} from '@budget/shared';
import type {
  CreatePortfolioAssetClassDTO,
  CreatePortfolioInstrumentDTO,
  PortfolioCompareRequestDTO,
  PortfolioHistoryHorizonDTO,
  UpdatePortfolioAssetClassDTO,
  UpdatePortfolioInstrumentDTO,
  UpdatePortfolioInvestedStateDTO,
} from '@budget/shared';

type PortfolioHistoryQuery = {
  symbols?: string;
  horizon?: PortfolioHistoryHorizonDTO;
};

type PortfolioJustEtfDebugQuery = {
  isin?: string;
};

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/asset-classes', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get user asset classes for portfolio instruments',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
    handler: async (request) => {
      const data = await portfolioService.getAssetClasses(request.authUser!.id);
      return { success: true, data };
    },
  });

  fastify.post<{ Body: CreatePortfolioAssetClassDTO }>('/asset-classes', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Create a new user asset class',
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const parsed = createPortfolioAssetClassSchema.parse(request.body);
      const data = await portfolioService.createAssetClass(request.authUser!.id, parsed);
      reply.status(201);
      return { success: true, data };
    },
  });

  fastify.put<{ Params: { id: string }; Body: UpdatePortfolioAssetClassDTO }>('/asset-classes/:id', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Update a user asset class',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const parsed = updatePortfolioAssetClassSchema.parse(request.body);
      const data = await portfolioService.updateAssetClass(request.authUser!.id, request.params.id, parsed);
      return { success: true, data };
    },
  });

  fastify.get('/instruments', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get user instrument catalog for portfolio',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
    handler: async (request) => {
      const data = await portfolioService.getInstruments(request.authUser!.id);
      return { success: true, data };
    },
  });

  fastify.post<{ Body: CreatePortfolioInstrumentDTO }>('/instruments', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Create a new user instrument',
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const parsed = createPortfolioInstrumentSchema.parse(request.body);
      const data = await portfolioService.createInstrument(request.authUser!.id, parsed);
      reply.status(201);
      return { success: true, data };
    },
  });

  fastify.put<{ Params: { id: string }; Body: UpdatePortfolioInstrumentDTO }>('/instruments/:id', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Update an existing user instrument',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const parsed = updatePortfolioInstrumentSchema.parse(request.body);
      const data = await portfolioService.updateInstrument(request.authUser!.id, request.params.id, parsed);
      return { success: true, data };
    },
  });

  fastify.get('/invested', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get persisted invested portfolio for authenticated user',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const data = await portfolioService.getInvestedState(request.authUser!.id);
      return { success: true, data };
    },
  });

  fastify.put<{ Body: UpdatePortfolioInvestedStateDTO }>('/invested', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Persist invested portfolio for authenticated user',
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const parsed = updatePortfolioInvestedStateSchema.parse(request.body);
      const data = await portfolioService.updateInvestedState(request.authUser!.id, parsed);
      return { success: true, data };
    },
  });

  fastify.post<{ Body: PortfolioCompareRequestDTO }>('/compare', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Compare study portfolios using justETF monthly series',
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const parsed = portfolioCompareRequestSchema.parse(request.body);
      const data = await portfolioService.comparePortfolios(parsed);
      return { success: true, data };
    },
  });

  fastify.get<{ Querystring: PortfolioJustEtfDebugQuery }>('/debug/justetf', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Debug raw justETF payload for one ISIN',
      querystring: {
        type: 'object',
        properties: {
          isin: {
            type: 'string',
            description: 'Optional ISIN code (e.g. IE00B4L5Y983)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const fallbackIsin = (process.env.PORTFOLIO_JUSTETF_DEBUG_ISIN || 'IE00B4L5Y983')
        .trim()
        .toUpperCase();
      const isin = (request.query.isin || fallbackIsin).trim().toUpperCase();
      const payload = await portfolioService.getJustEtfRawChart(isin);
      return { success: true, data: { isin, payload } };
    },
  });

  fastify.get<{ Querystring: PortfolioHistoryQuery }>('/history', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get historical monthly series for portfolio instruments (ISIN)',
      querystring: {
        type: 'object',
        properties: {
          symbols: {
            type: 'string',
            description: 'Comma-separated ISIN codes (e.g. IE00B4L5Y983,LU0290358497)',
          },
          horizon: {
            type: 'string',
            enum: ['1Y', '3Y', '5Y'],
            default: '3Y',
          },
        },
        required: ['symbols'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    handler: async (request) => {
      const rawSymbols = (request.query.symbols || '')
        .split(',')
        .map((symbol) => symbol.trim())
        .filter(Boolean);

      const parsed = portfolioHistoryQuerySchema.parse({
        symbols: rawSymbols,
        horizon: request.query.horizon || '3Y',
      });

      const data = await portfolioService.getHistory(parsed.symbols, parsed.horizon);
      return { success: true, data };
    },
  });
};
