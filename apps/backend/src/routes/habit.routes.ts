import type { FastifyPluginAsync } from 'fastify';
import {
  createHabitSchema,
  habitDayQuerySchema,
  habitRangeQuerySchema,
  setHabitSchema,
  updateHabitSchema,
} from '@budget/shared';
import { habitService } from '../services/habit.service.js';

export const habitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: { tags: ['Habits'], summary: 'List the tracked habits' },
    handler: async (request) => ({
      success: true,
      data: await habitService.list(request.authUser!.id),
    }),
  });

  fastify.post('/defaults', {
    schema: { tags: ['Habits'], summary: 'Install the suggested set of habits' },
    handler: async (request, reply) => {
      const habits = await habitService.installDefaults(request.authUser!.id);
      reply.status(201);
      return { success: true, data: habits };
    },
  });

  fastify.post('/', {
    schema: { tags: ['Habits'], summary: 'Add a habit' },
    handler: async (request, reply) => {
      const data = createHabitSchema.parse(request.body);
      const habit = await habitService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: habit };
    },
  });

  fastify.put<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Habits'], summary: 'Update, reorder or archive a habit' },
    handler: async (request) => {
      const data = updateHabitSchema.parse(request.body);
      const habit = await habitService.update(request.params.key, request.authUser!.id, data);
      return { success: true, data: habit };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/:key', {
    schema: { tags: ['Habits'], summary: 'Delete a habit (past answers are preserved)' },
    handler: async (request) => {
      await habitService.delete(request.params.key, request.authUser!.id);
      return { success: true };
    },
  });

  fastify.get('/day', {
    schema: { tags: ['Habits'], summary: 'Habits expected on a day, with the answers so far' },
    handler: async (request) => {
      const { date } = habitDayQuerySchema.parse(request.query);
      return { success: true, data: await habitService.getDay(request.authUser!.id, date) };
    },
  });

  fastify.post('/day', {
    schema: { tags: ['Habits'], summary: 'Answer a habit for a day (returns the refreshed day)' },
    handler: async (request) => {
      const data = setHabitSchema.parse(request.body);
      return { success: true, data: await habitService.setEntry(request.authUser!.id, data) };
    },
  });

  fastify.get('/entries', {
    schema: { tags: ['Habits'], summary: 'Answers in a date range' },
    handler: async (request) => {
      const { from, to } = habitRangeQuerySchema.parse(request.query);
      return { success: true, data: await habitService.getRange(request.authUser!.id, from, to) };
    },
  });
};
