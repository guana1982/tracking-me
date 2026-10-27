import type { FastifyPluginAsync } from 'fastify';
import {
  adjustPantryItemSchema,
  createMealPlanEntrySchema,
  createPantryItemSchema,
  createRecipeSchema,
  createShoppingItemSchema,
  kitchenIdSchema,
  kitchenRangeQuerySchema,
  kitchenWeekBodySchema,
  kitchenWeekQuerySchema,
  updateMealPlanEntrySchema,
  updatePantryItemSchema,
  updateRecipeSchema,
  updateShoppingItemSchema,
} from '@budget/shared';
import { kitchenService } from '../services/kitchen.service.js';

type IdParams = { Params: { id: string } };

export const kitchenRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/week', {
    schema: { tags: ['Kitchen'], summary: 'Menu, shopping list, pantry and coverage for one week' },
    handler: async (request) => {
      const { date, today } = kitchenWeekQuerySchema.parse(request.query);
      return { success: true, data: await kitchenService.getWeek(request.authUser!.id, date, today) };
    },
  });

  fastify.get('/marks', {
    schema: { tags: ['Kitchen'], summary: 'Per-day menu marks for the calendar' },
    handler: async (request) => {
      const { from, to, today } = kitchenRangeQuerySchema.parse(request.query);
      return { success: true, data: await kitchenService.getMarks(request.authUser!.id, from, to, today) };
    },
  });

  // Pantry
  fastify.post('/pantry', {
    schema: { tags: ['Kitchen'], summary: 'Add something to the pantry' },
    handler: async (request, reply) => {
      const data = createPantryItemSchema.parse(request.body);
      reply.status(201);
      return { success: true, data: await kitchenService.createPantryItem(request.authUser!.id, data) };
    },
  });

  fastify.put<IdParams>('/pantry/:id', {
    schema: { tags: ['Kitchen'], summary: 'Update a pantry item' },
    handler: async (request) => {
      const id = kitchenIdSchema.parse(request.params.id);
      const data = updatePantryItemSchema.parse(request.body);
      await kitchenService.updatePantryItem(request.authUser!.id, id, data);
      return { success: true };
    },
  });

  fastify.post<IdParams>('/pantry/:id/adjust', {
    schema: { tags: ['Kitchen'], summary: 'Use up or top up a pantry item' },
    handler: async (request) => {
      const id = kitchenIdSchema.parse(request.params.id);
      const { delta } = adjustPantryItemSchema.parse(request.body);
      await kitchenService.adjustPantryItem(request.authUser!.id, id, delta);
      return { success: true };
    },
  });

  fastify.delete<IdParams>('/pantry/:id', {
    schema: { tags: ['Kitchen'], summary: 'Remove a pantry item' },
    handler: async (request) => {
      await kitchenService.deletePantryItem(request.authUser!.id, kitchenIdSchema.parse(request.params.id));
      return { success: true };
    },
  });

  // Shopping list
  fastify.post('/shopping', {
    schema: { tags: ['Kitchen'], summary: 'Add an item to a week shopping list' },
    handler: async (request, reply) => {
      const data = createShoppingItemSchema.parse(request.body);
      reply.status(201);
      return { success: true, data: await kitchenService.createShoppingItem(request.authUser!.id, data) };
    },
  });

  fastify.put<IdParams>('/shopping/:id', {
    schema: { tags: ['Kitchen'], summary: 'Edit or tick a shopping list item (ticking stocks the pantry)' },
    handler: async (request) => {
      const id = kitchenIdSchema.parse(request.params.id);
      const data = updateShoppingItemSchema.parse(request.body);
      return { success: true, data: await kitchenService.updateShoppingItem(request.authUser!.id, id, data) };
    },
  });

  fastify.delete<IdParams>('/shopping/:id', {
    schema: { tags: ['Kitchen'], summary: 'Remove a shopping list item' },
    handler: async (request) => {
      await kitchenService.deleteShoppingItem(request.authUser!.id, kitchenIdSchema.parse(request.params.id));
      return { success: true };
    },
  });

  fastify.post('/shopping/add-missing', {
    schema: { tags: ['Kitchen'], summary: 'Add what the menu still needs to the list' },
    handler: async (request) => {
      const { date, today } = kitchenWeekBodySchema.parse(request.body);
      return { success: true, data: await kitchenService.addMissingToList(request.authUser!.id, date, today) };
    },
  });

  fastify.post('/shopping/clear-checked', {
    schema: { tags: ['Kitchen'], summary: 'Remove the ticked items of a week' },
    handler: async (request) => {
      const { date } = kitchenWeekBodySchema.parse(request.body);
      return { success: true, data: await kitchenService.clearChecked(request.authUser!.id, date) };
    },
  });

  fastify.post('/shopping/copy-previous', {
    schema: { tags: ['Kitchen'], summary: 'Start from last week list' },
    handler: async (request) => {
      const { date } = kitchenWeekBodySchema.parse(request.body);
      return { success: true, data: await kitchenService.copyPreviousList(request.authUser!.id, date) };
    },
  });

  // Dishes
  fastify.post('/recipes', {
    schema: { tags: ['Kitchen'], summary: 'Create a family dish' },
    handler: async (request, reply) => {
      const data = createRecipeSchema.parse(request.body);
      reply.status(201);
      return { success: true, data: await kitchenService.createRecipe(request.authUser!.id, data) };
    },
  });

  fastify.put<IdParams>('/recipes/:id', {
    schema: { tags: ['Kitchen'], summary: 'Update a dish' },
    handler: async (request) => {
      const id = kitchenIdSchema.parse(request.params.id);
      const data = updateRecipeSchema.parse(request.body);
      await kitchenService.updateRecipe(request.authUser!.id, id, data);
      return { success: true };
    },
  });

  fastify.delete<IdParams>('/recipes/:id', {
    schema: { tags: ['Kitchen'], summary: 'Delete a dish (the menu keeps its name)' },
    handler: async (request) => {
      await kitchenService.deleteRecipe(request.authUser!.id, kitchenIdSchema.parse(request.params.id));
      return { success: true };
    },
  });

  // Menu
  fastify.post('/plan', {
    schema: { tags: ['Kitchen'], summary: 'Put a lunch or dinner on the menu' },
    handler: async (request, reply) => {
      const data = createMealPlanEntrySchema.parse(request.body);
      reply.status(201);
      return { success: true, data: await kitchenService.createPlanEntry(request.authUser!.id, data) };
    },
  });

  fastify.put<IdParams>('/plan/:id', {
    schema: { tags: ['Kitchen'], summary: 'Change a meal, or mark it cooked (uses the pantry)' },
    handler: async (request) => {
      const id = kitchenIdSchema.parse(request.params.id);
      const data = updateMealPlanEntrySchema.parse(request.body);
      await kitchenService.updatePlanEntry(request.authUser!.id, id, data);
      return { success: true };
    },
  });

  fastify.delete<IdParams>('/plan/:id', {
    schema: { tags: ['Kitchen'], summary: 'Remove a meal from the menu' },
    handler: async (request) => {
      await kitchenService.deletePlanEntry(request.authUser!.id, kitchenIdSchema.parse(request.params.id));
      return { success: true };
    },
  });

  fastify.post('/plan/copy-previous', {
    schema: { tags: ['Kitchen'], summary: 'Repeat last week menu in the empty slots' },
    handler: async (request) => {
      const { date } = kitchenWeekBodySchema.parse(request.body);
      return { success: true, data: await kitchenService.copyPreviousPlan(request.authUser!.id, date) };
    },
  });
};
