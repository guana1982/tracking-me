import type { FastifyPluginAsync } from 'fastify';
import {
  createMilestoneSchema,
  createTitrationStepSchema,
  saveWeightSchema,
  therapyRangeQuerySchema,
  updateMilestoneSchema,
} from '@budget/shared';
import { therapyPlanService } from '../services/therapy-plan.service.js';
import { therapyTrendsService } from '../services/therapy-trends.service.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const therapyPlanRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------- Titration ----------

  fastify.get('/titration', {
    schema: { tags: ['Therapy plan'], summary: 'Planned dose changes' },
    handler: async (request) => ({
      success: true,
      data: await therapyPlanService.listTitration(request.authUser!.id),
    }),
  });

  fastify.post('/titration', {
    schema: { tags: ['Therapy plan'], summary: 'Plan a dose change' },
    handler: async (request, reply) => {
      const data = createTitrationStepSchema.parse(request.body);
      const step = await therapyPlanService.createTitrationStep(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: step };
    },
  });

  fastify.post<{ Params: { id: string } }>('/titration/:id/apply', {
    schema: { tags: ['Therapy plan'], summary: 'Write the planned dose onto the treatment' },
    handler: async (request) => ({
      success: true,
      data: await therapyPlanService.applyTitrationStep(request.authUser!.id, request.params.id),
    }),
  });

  fastify.delete<{ Params: { id: string } }>('/titration/:id', {
    schema: { tags: ['Therapy plan'], summary: 'Remove a planned dose change' },
    handler: async (request) => {
      await therapyPlanService.deleteTitrationStep(request.authUser!.id, request.params.id);
      return { success: true };
    },
  });

  // ---------- Milestones ----------

  fastify.get('/milestones', {
    schema: { tags: ['Therapy plan'], summary: 'Exams, appointments and other dates' },
    handler: async (request) => ({
      success: true,
      data: await therapyPlanService.listMilestones(request.authUser!.id),
    }),
  });

  fastify.get('/milestones/advisories', {
    schema: { tags: ['Therapy plan'], summary: 'Suggested conditional reminders for an exam' },
    handler: async () => ({ success: true, data: therapyPlanService.suggestedAdvisories() }),
  });

  fastify.post('/milestones', {
    schema: { tags: ['Therapy plan'], summary: 'Add a date to the schedule' },
    handler: async (request, reply) => {
      const data = createMilestoneSchema.parse(request.body);
      const milestone = await therapyPlanService.createMilestone(request.authUser!.id, data);
      reply.status(201);
      return { success: true, data: milestone };
    },
  });

  fastify.put<{ Params: { id: string } }>('/milestones/:id', {
    schema: { tags: ['Therapy plan'], summary: 'Update or tick off a date' },
    handler: async (request) => {
      const data = updateMilestoneSchema.parse(request.body);
      const milestone = await therapyPlanService.updateMilestone(
        request.authUser!.id,
        request.params.id,
        data
      );
      return { success: true, data: milestone };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/milestones/:id', {
    schema: { tags: ['Therapy plan'], summary: 'Remove a date' },
    handler: async (request) => {
      await therapyPlanService.deleteMilestone(request.authUser!.id, request.params.id);
      return { success: true };
    },
  });

  fastify.get('/schedule', {
    schema: { tags: ['Therapy plan'], summary: 'Milestones and dose changes as one list' },
    handler: async (request) => ({
      success: true,
      data: await therapyPlanService.getSchedule(request.authUser!.id, todayIso()),
    }),
  });

  // ---------- Weight ----------

  fastify.get('/weight', {
    schema: { tags: ['Therapy plan'], summary: 'Weight history with first, last and delta' },
    handler: async (request) => ({
      success: true,
      data: await therapyPlanService.getWeightSummary(request.authUser!.id, todayIso()),
    }),
  });

  fastify.post('/weight', {
    schema: { tags: ['Therapy plan'], summary: 'Record the weight of a day' },
    handler: async (request) => {
      const data = saveWeightSchema.parse(request.body);
      return { success: true, data: await therapyPlanService.saveWeight(request.authUser!.id, data) };
    },
  });

  fastify.delete<{ Params: { id: string } }>('/weight/:id', {
    schema: { tags: ['Therapy plan'], summary: 'Remove a weight entry' },
    handler: async (request) => {
      await therapyPlanService.deleteWeight(request.authUser!.id, request.params.id);
      return { success: true };
    },
  });

  // ---------- Weekly reading ----------

  fastify.get('/trends', {
    schema: { tags: ['Therapy plan'], summary: 'Weekly curves, events, triggers and adherence' },
    handler: async (request) => {
      const { from, to } = therapyRangeQuerySchema.parse(request.query);
      const end = to ?? todayIso();
      // Twelve weeks by default: enough to see a shape, short enough to read
      const startDefault = new Date(`${end}T00:00:00.000Z`);
      startDefault.setUTCDate(startDefault.getUTCDate() - 83);
      const start = from ?? startDefault.toISOString().slice(0, 10);
      return {
        success: true,
        data: await therapyTrendsService.getTrends(request.authUser!.id, start, end),
      };
    },
  });
};
