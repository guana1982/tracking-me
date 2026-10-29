import type { FastifyPluginAsync } from 'fastify';
import { createMoodDefinitionSchema, updateMoodDefinitionSchema } from '@budget/shared';
import { moodDefinitionService } from '../services/mood-definition.service.js';

export const moodDefinitionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: { tags: ['Moods'], summary: 'List mood states' },
    handler: async (request) => ({
      success: true,
      data: await moodDefinitionService.list(request.authUser!.id),
    }),
  });

  fastify.post('/', {
    schema: { tags: ['Moods'], summary: 'Create a mood state' },
    handler: async (request, reply) => {
      const data = createMoodDefinitionSchema.parse(request.body);
      const definition = await moodDefinitionService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: definition };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Moods'], summary: 'Update, reorder or archive a mood state' },
    handler: async (request) => {
      const data = updateMoodDefinitionSchema.parse(request.body);
      const definition = await moodDefinitionService.update(
        request.params.key,
        request.authUser!.id,
        data
      );
      return { success: true, data: definition };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Moods'], summary: 'Delete a mood state (history is preserved)' },
    handler: async (request) => {
      await moodDefinitionService.delete(request.params.key, request.authUser!.id);
      return { success: true };
    },
  });
};
