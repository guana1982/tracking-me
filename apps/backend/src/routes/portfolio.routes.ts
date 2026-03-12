import type { FastifyPluginAsync } from 'fastify';
import { portfolioService } from '../services/portfolio.service.js';
import { portfolioHistoryQuerySchema } from '@budget/shared';
import type { PortfolioHistoryHorizonDTO } from '@budget/shared';

type PortfolioHistoryQuery = {
  symbols?: string;
  horizon?: PortfolioHistoryHorizonDTO;
};

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: PortfolioHistoryQuery }>('/history', {
    schema: {
      tags: ['Portfolio'],
      summary: 'Get historical monthly series for portfolio symbols',
      querystring: {
        type: 'object',
        properties: {
          symbols: {
            type: 'string',
            description: 'Comma-separated symbols (e.g. VTI,BND,EMB)',
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

