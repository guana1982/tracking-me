import type { FastifyPluginAsync } from 'fastify';
import {
  createTreatmentSchema,
  intakeDayQuerySchema,
  setIntakesSchema,
  updateTreatmentSchema,
} from '@budget/shared';
import { treatmentService } from '../services/treatment.service.js';

export const treatmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: { tags: ['Intakes'], summary: 'List tracked treatments and supplements' },
    handler: async (request) => ({
      success: true,
      data: await treatmentService.list(request.authUser!.id),
    }),
  });

  fastify.post('/', {
    schema: { tags: ['Intakes'], summary: 'Add something to take' },
    handler: async (request, reply) => {
      const data = createTreatmentSchema.parse(request.body);
      const definition = await treatmentService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: definition };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Intakes'], summary: 'Update, suspend or reorder an entry' },
    handler: async (request) => {
      const data = updateTreatmentSchema.parse(request.body);
      const definition = await treatmentService.update(
        request.params.key,
        request.authUser!.id,
        data
      );
      return { success: true, data: definition };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Intakes'], summary: 'Delete an entry (recorded intakes are preserved)' },
    handler: async (request) => {
      await treatmentService.delete(request.params.key, request.authUser!.id);
      return { success: true };
    },
  });

  fastify.get('/day', {
    schema: { tags: ['Intakes'], summary: 'What is due on a day, with the answers so far' },
    handler: async (request) => {
      const { date } = intakeDayQuerySchema.parse(request.query);
      return { success: true, data: await treatmentService.getDay(request.authUser!.id, date) };
    },
  });

  fastify.post('/day', {
    schema: { tags: ['Intakes'], summary: 'Record or clear intakes (idempotent per slot)' },
    handler: async (request) => {
      const { entries } = setIntakesSchema.parse(request.body);
      await treatmentService.setIntakes(request.authUser!.id, entries);
      // Return the refreshed day so the caller never has to guess the result
      return {
        success: true,
        data: await treatmentService.getDay(request.authUser!.id, entries[0].date),
      };
    },
  });
};
