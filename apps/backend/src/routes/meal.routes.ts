import type { FastifyPluginAsync } from 'fastify';
import { mealService } from '../services/meal.service.js';
import {
  createMealSchema,
  updateMealSchema,
  foodRangeQuerySchema,
  foodSuggestionQuerySchema,
  repeatMealQuerySchema,
} from '@budget/shared';

export const mealRoutes: FastifyPluginAsync = async (fastify) => {
  // List meals in a date range (diary view)
  fastify.get('/', {
    schema: {
      tags: ['Meals'],
      summary: 'Get meals in a date range',
    },
    handler: async (request) => {
      const { from, to } = foodRangeQuerySchema.parse(request.query);
      const meals = await mealService.getByRange(request.authUser!.id, from, to);
      return { success: true, data: meals };
    },
  });

  // Autocomplete from the user's own history
  fastify.get('/suggestions', {
    schema: {
      tags: ['Meals'],
      summary: 'Food name suggestions from the user meal history',
    },
    handler: async (request) => {
      const { q, limit } = foodSuggestionQuerySchema.parse(request.query);
      const suggestions = await mealService.getSuggestions(request.authUser!.id, q, limit);
      return { success: true, data: suggestions };
    },
  });

  // "Ripeti ieri" prefill (null when yesterday has no meal of that type)
  fastify.get('/repeat-yesterday', {
    schema: {
      tags: ['Meals'],
      summary: "Items of yesterday's meal of the same type",
    },
    handler: async (request) => {
      const { date, mealType } = repeatMealQuerySchema.parse(request.query);
      const meal = await mealService.getRepeatMeal(request.authUser!.id, date, mealType);
      return { success: true, data: meal };
    },
  });

  // Most recurring meals (identical item sets) as prefill bases
  fastify.get('/frequent', {
    schema: {
      tags: ['Meals'],
      summary: 'Most frequent meals grouped by identical items',
    },
    handler: async (request) => {
      const meals = await mealService.getFrequentMeals(request.authUser!.id);
      return { success: true, data: meals };
    },
  });

  // Photo as base64 data URL (img tags cannot send the Bearer token)
  fastify.get<{ Params: { id: string } }>('/:id/photo', {
    schema: {
      tags: ['Meals'],
      summary: 'Get the meal photo as data URL',
    },
    handler: async (request) => {
      const photo = await mealService.getPhoto(request.params.id, request.authUser!.id);
      return { success: true, data: photo };
    },
  });

  // Create meal (photo optionally embedded as resized base64 data URL)
  fastify.post('/', {
    // Base64 photos exceed the default 1MB body limit
    bodyLimit: 4 * 1024 * 1024,
    schema: {
      tags: ['Meals'],
      summary: 'Create a meal with its items',
    },
    handler: async (request, reply) => {
      const data = createMealSchema.parse(request.body);
      const meal = await mealService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: meal };
    },
  });

  // Update meal (items replaced when provided; photo null removes it)
  fastify.put<{ Params: { id: string } }>('/:id', {
    bodyLimit: 4 * 1024 * 1024,
    schema: {
      tags: ['Meals'],
      summary: 'Update a meal',
    },
    handler: async (request) => {
      const data = updateMealSchema.parse(request.body);
      const meal = await mealService.update(request.params.id, request.authUser!.id, data);
      return { success: true, data: meal };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Meals'],
      summary: 'Delete a meal',
    },
    handler: async (request) => {
      await mealService.delete(request.params.id, request.authUser!.id);
      return { success: true };
    },
  });
};
