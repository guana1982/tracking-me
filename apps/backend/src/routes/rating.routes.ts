import type { FastifyPluginAsync } from 'fastify';
import {
  createRatingDefinitionSchema,
  ratingRangeQuerySchema,
  setRatingSchema,
  updateRatingDefinitionSchema,
} from '@budget/shared';
import { ratingService } from '../services/rating.service.js';

export const ratingRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------- Characteristics ----------

  fastify.get('/', {
    schema: { tags: ['Ratings'], summary: 'List the rated characteristics' },
    handler: async (request) => ({
      success: true,
      data: await ratingService.list(request.authUser!.id),
    }),
  });

  fastify.post('/', {
    schema: { tags: ['Ratings'], summary: 'Add a characteristic to rate' },
    handler: async (request, reply) => {
      const data = createRatingDefinitionSchema.parse(request.body);
      const definition = await ratingService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: definition };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Ratings'], summary: 'Rename, rescale, reorder or archive it' },
    handler: async (request) => {
      const data = updateRatingDefinitionSchema.parse(request.body);
      const definition = await ratingService.update(request.params.key, request.authUser!.id, data);
      return { success: true, data: definition };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Ratings'], summary: 'Delete it (past votes are preserved)' },
    handler: async (request) => {
      await ratingService.delete(request.params.key, request.authUser!.id);
      return { success: true };
    },
  });

  // ---------- Votes ----------

  fastify.get('/entries', {
    schema: { tags: ['Ratings'], summary: 'Votes given in a date range' },
    handler: async (request) => {
      const { from, to } = ratingRangeQuerySchema.parse(request.query);
      return { success: true, data: await ratingService.getRange(request.authUser!.id, from, to) };
    },
  });

  fastify.post('/entries', {
    schema: { tags: ['Ratings'], summary: 'Set the vote, note or linked entry of a day' },
    handler: async (request) => {
      const data = setRatingSchema.parse(request.body);
      return { success: true, data: await ratingService.setEntry(request.authUser!.id, data) };
    },
  });

  fastify.delete<{ Params: { date: string; key: string } }>('/entries/:date/:key', {
    schema: { tags: ['Ratings'], summary: 'Remove the vote of a day' },
    handler: async (request) => {
      await ratingService.deleteEntry(
        request.authUser!.id,
        request.params.date,
        request.params.key
      );
      return { success: true };
    },
  });
};
