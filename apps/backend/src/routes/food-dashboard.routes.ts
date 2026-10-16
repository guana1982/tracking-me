import type { FastifyPluginAsync } from 'fastify';
import { foodDashboardService } from '../services/food-dashboard.service.js';
import { foodExportService } from '../services/food-export.service.js';
import { obsidianExportService } from '../services/obsidian-export.service.js';
import { foodRangeQuerySchema, foodComparisonQuerySchema } from '@budget/shared';

export const foodDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Per-day aggregates: calendar + day-state line + supplement period bands
  fastify.get('/overview', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Per-day aggregates and supplement periods',
    },
    handler: async (request) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const overview = await foodDashboardService.getOverview(
        request.authUser!.id,
        from,
        to,
        tzOffset
      );
      return { success: true, data: overview };
    },
  });

  // Conditioned comparison (allenamento sì/no, cena tardi, alimento, integratore)
  fastify.get('/comparison', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Average day-state comparison between condition groups',
    },
    handler: async (request) => {
      const { condition, value, from, to, tzOffset } = foodComparisonQuerySchema.parse(
        request.query
      );
      const comparison = await foodDashboardService.getComparison(
        request.authUser!.id,
        condition,
        value,
        from,
        to,
        tzOffset
      );
      return { success: true, data: comparison };
    },
  });

  // Foods recurring in meals linked to positive/negative feelings
  fastify.get('/associations', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Foods associated with post-meal feelings',
    },
    handler: async (request) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const associations = await foodDashboardService.getAssociations(
        request.authUser!.id,
        from,
        to,
        tzOffset
      );
      return { success: true, data: associations };
    },
  });

  // Weekly/monthly trends and top foods (also used for period comparison)
  fastify.get('/stats', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Aggregate stats for a date range',
    },
    handler: async (request) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const stats = await foodDashboardService.getStats(request.authUser!.id, from, to, tzOffset);
      return { success: true, data: stats };
    },
  });

  // CSV download: raw text/csv response (not the JSON envelope) so the
  // browser can save it as a file; the frontend fetches it with the token
  fastify.get('/export.csv', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Export meals and quick logs as CSV (one row per item)',
    },
    handler: async (request, reply) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const csv = await foodExportService.exportCsv(request.authUser!.id, from, to, tzOffset);
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="diario-alimentare.csv"');
      return reply.send(csv);
    },
  });

  fastify.get('/export-ai.zip', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Export a self-describing ZIP package for external AI analysis',
    },
    handler: async (request, reply) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const archive = await foodExportService.exportAiPackage(
        request.authUser!.id,
        from,
        to,
        tzOffset
      );
      reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="diario-alimentare-ai.zip"');
      return reply.send(Buffer.from(archive));
    },
  });

  // A second view of the same rows: one Markdown note per day, ready to drop
  // into an Obsidian vault. The CSV and the AI package are untouched by it
  fastify.get('/export-obsidian.zip', {
    schema: {
      tags: ['Food Dashboard'],
      summary: 'Export the diary as one Markdown note per day (Obsidian vault)',
    },
    handler: async (request, reply) => {
      const { from, to, tzOffset } = foodRangeQuerySchema.parse(request.query);
      const archive = await obsidianExportService.exportVault(
        request.authUser!.id,
        from,
        to,
        tzOffset
      );
      reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', 'attachment; filename="diario-obsidian.zip"');
      return reply.send(Buffer.from(archive));
    },
  });
};
