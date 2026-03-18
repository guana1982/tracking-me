import type { FastifyPluginAsync } from 'fastify';
import { portfolioService } from '../services/portfolio.service.js';
import { portfolioHistoryQuerySchema } from '@budget/shared';
import type { PortfolioHistoryHorizonDTO } from '@budget/shared';

type PortfolioHistoryQuery = {
  symbols?: string;
  horizon?: PortfolioHistoryHorizonDTO;
};

type PortfolioJustEtfDebugQuery = {
  isin?: string;
};

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
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
            data: { type: 'object' },
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
            data: { type: 'object' },
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
