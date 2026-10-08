import { z } from 'zod';
import {
  ACTIVITY_KINDS,
  ACTIVITY_PRIORITIES,
  ACTIVITY_SCOPES,
  ACTIVITY_STATUSES,
} from './activity-types';

const activityDateSchema = z.string().date();
const activityTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const activityColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const activityKindSchema = z.enum(ACTIVITY_KINDS);
export const activityScopeSchema = z.enum(ACTIVITY_SCOPES);
export const activityPrioritySchema = z.enum(ACTIVITY_PRIORITIES);
export const activityStatusSchema = z.enum(ACTIVITY_STATUSES);
export const activityIdSchema = z.string().trim().min(1).max(80);
export const activityTypeKeySchema = z.string().trim().min(1).max(80);

export const activityOverviewQuerySchema = z.object({
  date: activityDateSchema,
});

export const activityRangeQuerySchema = z
  .object({
    from: activityDateSchema,
    to: activityDateSchema,
  })
  .refine((data) => data.from <= data.to, {
    path: ['to'],
    message: 'La data finale non può precedere quella iniziale',
  });

export const reorderActivitiesSchema = z.object({
  activityIds: z
    .array(activityIdSchema)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Activity IDs must be unique',
    }),
});

/** Empty list = drop the manual order everywhere, not just on what is on screen. */
export const resetActivityOrderSchema = z.object({
  activityIds: z.array(activityIdSchema).max(500).optional(),
});

export const createActivitySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(2000).nullable().optional(),
    kind: activityKindSchema.default('TASK'),
    scope: activityScopeSchema.default('DAY'),
    scheduledFor: activityDateSchema,
    dueDate: activityDateSchema.nullable().optional(),
    dueTime: activityTimeSchema.nullable().optional(),
    priority: activityPrioritySchema.default('MEDIUM'),
    typeKey: activityTypeKeySchema.nullable().optional(),
  })
  .superRefine((data, context) => {
    if (data.kind === 'DEADLINE' && !data.dueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'La data di scadenza è obbligatoria',
      });
    }
    if (data.dueTime && !data.dueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueTime'],
        message: 'Imposta una data prima dell’orario',
      });
    }
  });

export const updateActivitySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    kind: activityKindSchema.optional(),
    scope: activityScopeSchema.optional(),
    scheduledFor: activityDateSchema.optional(),
    dueDate: activityDateSchema.nullable().optional(),
    dueTime: activityTimeSchema.nullable().optional(),
    priority: activityPrioritySchema.optional(),
    status: activityStatusSchema.optional(),
    typeKey: activityTypeKeySchema.nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const createActivityTypeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: activityColorSchema,
  kind: activityKindSchema,
});

export const updateActivityTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: activityColorSchema.optional(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ReorderActivitiesInput = z.infer<typeof reorderActivitiesSchema>;
export type ResetActivityOrderInput = z.infer<typeof resetActivityOrderSchema>;
export type ActivityRangeQueryInput = z.infer<typeof activityRangeQuerySchema>;
export type CreateActivityTypeInput = z.infer<typeof createActivityTypeSchema>;
export type UpdateActivityTypeInput = z.infer<typeof updateActivityTypeSchema>;
