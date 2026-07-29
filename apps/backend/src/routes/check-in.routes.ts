import type { FastifyPluginAsync } from 'fastify';
import {
  checkInDayQuerySchema,
  createCheckInScaleSchema,
  installSideEffectsSchema,
  saveCheckInSchema,
  updateCheckInScaleSchema,
} from '@budget/shared';
import { checkInService } from '../services/check-in.service.js';

export const checkInRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------- Scales ----------

  fastify.get('/scales', {
    schema: { tags: ['Check-in'], summary: 'List the configured check-in scales' },
    handler: async (request) => ({
      success: true,
      data: await checkInService.listScales(request.authUser!.id),
    }),
  });

  fastify.post('/scales/defaults', {
    schema: { tags: ['Check-in'], summary: 'Install the suggested set of scales' },
    handler: async (request, reply) => {
      const scales = await checkInService.installDefaultScales(request.authUser!.id);
      reply.status(201);
      return { success: true, data: scales };
    },
  });

  fastify.get('/side-effects/suggested', {
    schema: { tags: ['Check-in'], summary: 'Side effects suggested by the active treatments' },
    handler: async (request) => ({
      success: true,
      data: await checkInService.suggestSideEffects(request.authUser!.id),
    }),
  });

  fastify.post('/side-effects', {
    schema: { tags: ['Check-in'], summary: 'Install side effects as optional scales' },
    handler: async (request, reply) => {
      const { names } = installSideEffectsSchema.parse(request.body);
      const scales = await checkInService.installSideEffects(request.authUser!.id, names);
      reply.status(201);
      return { success: true, data: scales };
    },
  });

  fastify.post('/scales', {
    schema: { tags: ['Check-in'], summary: 'Create a scale' },
    handler: async (request, reply) => {
      const data = createCheckInScaleSchema.parse(request.body);
      const scale = await checkInService.createScale(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: scale };
    },
  });

  fastify.put<{ Params: { key: string } }>('/scales/:key', {
    schema: { tags: ['Check-in'], summary: 'Update, reorder or archive a scale' },
    handler: async (request) => {
      const data = updateCheckInScaleSchema.parse(request.body);
      const scale = await checkInService.updateScale(
        request.params.key,
        request.authUser!.id,
        data
      );
      return { success: true, data: scale };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/scales/:key', {
    schema: { tags: ['Check-in'], summary: 'Delete a scale (past entries are preserved)' },
    handler: async (request) => {
      await checkInService.deleteScale(request.params.key, request.authUser!.id);
      return { success: true };
    },
  });

  // ---------- Entries ----------

  fastify.get('/day', {
    schema: { tags: ['Check-in'], summary: 'Scales, the entry of the day and the prefill' },
    handler: async (request) => {
      const { date } = checkInDayQuerySchema.parse(request.query);
      return { success: true, data: await checkInService.getDay(request.authUser!.id, date) };
    },
  });

  fastify.post('/day', {
    schema: { tags: ['Check-in'], summary: 'Save the day (one entry per day, editable)' },
    handler: async (request) => {
      const data = saveCheckInSchema.parse(request.body);
      return { success: true, data: await checkInService.save(request.authUser!.id, data) };
    },
  });

  fastify.delete<{ Params: { date: string } }>('/day/:date', {
    schema: { tags: ['Check-in'], summary: 'Remove the entry of a day' },
    handler: async (request) => {
      await checkInService.deleteEntry(request.authUser!.id, request.params.date);
      return { success: true };
    },
  });
};
