import type { FastifyPluginAsync } from 'fastify';
import {
  createMealTypeDefinitionSchema,
  updateMealTypeDefinitionSchema,
} from '@budget/shared';
import { mealTypeDefinitionService } from '../services/meal-type-definition.service.js';

export const mealTypeDefinitionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: { tags: ['Meal Types'], summary: 'List custom meal types' },
    handler: async (request) => ({
      success: true,
      data: await mealTypeDefinitionService.list(request.authUser!.id),
    }),
  });

  fastify.post('/', {
    schema: { tags: ['Meal Types'], summary: 'Create a custom meal type' },
    handler: async (request, reply) => {
      const data = createMealTypeDefinitionSchema.parse(request.body);
      const definition = await mealTypeDefinitionService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: definition };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Meal Types'], summary: 'Update or archive a meal type' },
    handler: async (request) => {
      const data = updateMealTypeDefinitionSchema.parse(request.body);
      const definition = await mealTypeDefinitionService.update(
        request.params.key,
        request.authUser!.id,
        data
      );
      return { success: true, data: definition };
    },
  });
};
