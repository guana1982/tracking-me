import type { FastifyPluginAsync } from 'fastify';
import {
  createMealUnitDefinitionSchema,
  updateMealUnitDefinitionSchema,
} from '@budget/shared';
import { mealUnitDefinitionService } from '../services/meal-unit-definition.service.js';

export const mealUnitDefinitionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: { tags: ['Meal Units'], summary: 'List custom meal units' },
    handler: async (request) => ({
      success: true,
      data: await mealUnitDefinitionService.list(request.authUser!.id),
    }),
  });

  fastify.post('/', {
    schema: { tags: ['Meal Units'], summary: 'Create a custom meal unit' },
    handler: async (request, reply) => {
      const data = createMealUnitDefinitionSchema.parse(request.body);
      const definition = await mealUnitDefinitionService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: definition };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Meal Units'], summary: 'Update or archive a meal unit' },
    handler: async (request) => {
      const data = updateMealUnitDefinitionSchema.parse(request.body);
      const definition = await mealUnitDefinitionService.update(
        request.params.key,
        request.authUser!.id,
        data
      );
      return { success: true, data: definition };
    },
  });
};
