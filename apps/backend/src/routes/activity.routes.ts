import type { FastifyPluginAsync } from 'fastify';
import {
  activityIdSchema,
  activityOverviewQuerySchema,
  activityTypeKeySchema,
  createActivitySchema,
  createActivityTypeSchema,
  updateActivitySchema,
  updateActivityTypeSchema,
} from '@budget/shared';
import { activityService } from '../services/activity.service.js';

export const activityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/overview', {
    schema: { tags: ['Activities'], summary: 'Daily, weekly and deadline overview' },
    handler: async (request) => {
      const { date } = activityOverviewQuerySchema.parse(request.query);
      return { success: true, data: await activityService.getOverview(request.authUser!.id, date) };
    },
  });

  fastify.post('/', {
    schema: { tags: ['Activities'], summary: 'Create an activity or deadline' },
    handler: async (request, reply) => {
      const data = createActivitySchema.parse(request.body);
      const activity = await activityService.create(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: activity };
    },
  });

  fastify.put<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Activities'], summary: 'Update or complete an activity' },
    handler: async (request) => {
      const id = activityIdSchema.parse(request.params.id);
      const data = updateActivitySchema.parse(request.body);
      return { success: true, data: await activityService.update(request.authUser!.id, id, data) };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Activities'], summary: 'Delete an activity' },
    handler: async (request) => {
      const id = activityIdSchema.parse(request.params.id);
      await activityService.delete(request.authUser!.id, id);
      return { success: true };
    },
  });

  fastify.get('/types', {
    schema: { tags: ['Activities'], summary: 'List custom activity and deadline types' },
    handler: async (request) => ({
      success: true,
      data: await activityService.listTypes(request.authUser!.id),
    }),
  });

  fastify.post('/types/defaults', {
    schema: { tags: ['Activities'], summary: 'Install suggested activity types' },
    handler: async (request, reply) => {
      const types = await activityService.installDefaultTypes(request.authUser!.id);
      reply.status(201);
      return { success: true, data: types };
    },
  });

  fastify.post('/types', {
    schema: { tags: ['Activities'], summary: 'Create an activity type' },
    handler: async (request, reply) => {
      const data = createActivityTypeSchema.parse(request.body);
      const type = await activityService.createType(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: type };
    },
  });

  fastify.put<{ Params: { key: string } }>('/types/:key', {
    schema: { tags: ['Activities'], summary: 'Update an activity type' },
    handler: async (request) => {
      const key = activityTypeKeySchema.parse(request.params.key);
      const data = updateActivityTypeSchema.parse(request.body);
      return { success: true, data: await activityService.updateType(request.authUser!.id, key, data) };
    },
  });

  fastify.delete<{ Params: { key: string } }>('/types/:key', {
    schema: { tags: ['Activities'], summary: 'Delete an activity type' },
    handler: async (request) => {
      const key = activityTypeKeySchema.parse(request.params.key);
      await activityService.deleteType(request.authUser!.id, key);
      return { success: true };
    },
  });
};
