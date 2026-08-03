import { z } from 'zod';
import {
  DAY_TRACKS,
  RATING_KINDS,
  RATING_LINKED_FORMS,
  RATING_MAX_MAX,
  RATING_MIN_MAX,
} from './rating-types';

// ============================================================
// Daily ratings - Zod validation schemas
// ============================================================

const ratingDateSchema = z.string().date();
const maxValueSchema = z.number().int().min(RATING_MIN_MAX).max(RATING_MAX_MAX);

export const ratingLinkedFormSchema = z.enum(RATING_LINKED_FORMS);
export const ratingKindSchema = z.enum(RATING_KINDS);
export const dayTrackSchema = z.enum(DAY_TRACKS);
const triggerSchema = z.string().trim().max(80);

export const createRatingDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: ratingKindSchema.optional(),
  maxValue: maxValueSchema.optional(),
  track: dayTrackSchema.optional(),
  sourceTreatmentKeys: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  linkedForm: ratingLinkedFormSchema.optional(),
});

export const installSideEffectRatingsSchema = z.object({
  names: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
});

export const updateRatingDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    kind: ratingKindSchema.optional(),
    maxValue: maxValueSchema.optional(),
    track: dayTrackSchema.optional(),
    sourceTreatmentKeys: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    linkedForm: ratingLinkedFormSchema.optional(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const createRatingEntrySchema = z.object({
  date: ratingDateSchema,
  ratingKey: z.string().trim().min(1).max(80),
  // The vote is 1-based: box 1 is the lowest, there is no "zero" to tap.
  // Nullable so an episode can be logged in one tap and rated afterwards
  value: z.number().int().min(1).max(RATING_MAX_MAX).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  trigger: triggerSchema.nullable().optional(),
  quickLogId: z.string().trim().min(1).max(60).nullable().optional(),
  loggedAt: z.string().datetime().optional(),
});

export const updateRatingEntrySchema = z
  .object({
    value: z.number().int().min(1).max(RATING_MAX_MAX).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    trigger: triggerSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const ratingRangeQuerySchema = z.object({
  from: ratingDateSchema.optional(),
  to: ratingDateSchema.optional(),
});

// ---------- Type exports ----------

export type CreateRatingDefinitionInput = z.infer<typeof createRatingDefinitionSchema>;
export type UpdateRatingDefinitionInput = z.infer<typeof updateRatingDefinitionSchema>;
export type CreateRatingEntryInput = z.infer<typeof createRatingEntrySchema>;
export type UpdateRatingEntryInput = z.infer<typeof updateRatingEntrySchema>;
