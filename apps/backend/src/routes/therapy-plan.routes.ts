import type { FastifyPluginAsync } from 'fastify';
import {
  ATTACHMENT_MAX_BYTES,
  createMilestoneAttachmentSchema,
  createMilestoneSchema,
  createTitrationStepSchema,
  saveWeightSchema,
  therapyRangeQuerySchema,
  updateMilestoneAttachmentSchema,
  updateMilestoneSchema,
} from '@budget/shared';
import { therapyPlanService } from '../services/therapy-plan.service.js';
import { therapyTrendsService } from '../services/therapy-trends.service.js';
import { milestoneAttachmentService } from '../services/milestone-attachment.service.js';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Only the upload route is allowed to be big. The default 1 MB stands
 * everywhere else, so raising the ceiling for a report does not raise it for
 * every other endpoint in the app. base64 costs a third on top of the file,
 * plus room for the surrounding JSON.
 */
const UPLOAD_BODY_LIMIT = Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 64 * 1024;

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

  // ---------- Attachments on a milestone (referti) ----------

  fastify.get<{ Params: { id: string } }>('/milestones/:id/attachments', {
    schema: { tags: ['Therapy plan'], summary: 'Files attached to a date (metadata only)' },
    handler: async (request) => ({
      success: true,
      data: await milestoneAttachmentService.listByMilestone(
        request.authUser!.id,
        request.params.id
      ),
    }),
  });

  fastify.post<{ Params: { id: string } }>('/milestones/:id/attachments', {
    bodyLimit: UPLOAD_BODY_LIMIT,
    schema: { tags: ['Therapy plan'], summary: 'Attach a report to a date' },
    handler: async (request, reply) => {
      const data = createMilestoneAttachmentSchema.parse(request.body);
      const attachment = await milestoneAttachmentService.create(
        request.authUser!.id,
        request.params.id,
        data
      );
      reply.status(201);
      return { success: true, data: attachment };
    },
  });

  fastify.patch<{ Params: { attachmentId: string } }>('/attachments/:attachmentId', {
    schema: { tags: ['Therapy plan'], summary: 'Include or exclude a file from the next export' },
    handler: async (request) => {
      const data = updateMilestoneAttachmentSchema.parse(request.body);
      return {
        success: true,
        data: await milestoneAttachmentService.setIncludeInExport(
          request.authUser!.id,
          request.params.attachmentId,
          data.includeInExport
        ),
      };
    },
  });

  fastify.delete<{ Params: { attachmentId: string } }>('/attachments/:attachmentId', {
    schema: { tags: ['Therapy plan'], summary: 'Remove an attached file' },
    handler: async (request) => {
      await milestoneAttachmentService.remove(request.authUser!.id, request.params.attachmentId);
      return { success: true };
    },
  });

  fastify.get<{ Params: { attachmentId: string } }>('/attachments/:attachmentId/file', {
    schema: { tags: ['Therapy plan'], summary: 'Download an attached file' },
    handler: async (request, reply) => {
      const file = await milestoneAttachmentService.getFile(
        request.authUser!.id,
        request.params.attachmentId
      );
      // Always as a download, never rendered in place: the stored type is
      // whatever was declared at upload, and nothing declared is worth
      // executing inside the app's own origin
      return reply
        .type(file.mimeType)
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
        )
        .send(file.data);
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
