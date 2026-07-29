import type { FastifyPluginAsync } from 'fastify';
import {
  createRatingDefinitionSchema,
  createRatingEntrySchema,
  ratingRangeQuerySchema,
  updateRatingDefinitionSchema,
  updateRatingEntrySchema,
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
    schema: { tags: ['Ratings'], summary: 'Record a vote (repeatable within the day)' },
    handler: async (request, reply) => {
      const data = createRatingEntrySchema.parse(request.body);
      const entry = await ratingService.createEntry(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: entry };
    },
  });

  fastify.put<{ Params: { id: string } }>('/entries/:id', {
    schema: { tags: ['Ratings'], summary: 'Correct the mark or the note of a vote' },
    handler: async (request) => {
      const data = updateRatingEntrySchema.parse(request.body);
      const entry = await ratingService.updateEntry(
        request.authUser!.id,
        request.params.id,
        data
      );
      return { success: true, data: entry };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/entries/:id', {
    schema: { tags: ['Ratings'], summary: 'Remove a single vote' },
    handler: async (request) => {
      await ratingService.deleteEntry(request.authUser!.id, request.params.id);
      return { success: true };
    },
  });
};
