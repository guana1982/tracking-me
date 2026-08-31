import { z } from 'zod';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES, MILESTONE_KINDS } from './therapy-plan-types';

// ============================================================
// Therapy plan - Zod validation schemas
// ============================================================

const planDateSchema = z.string().date();

export const milestoneKindSchema = z.enum(MILESTONE_KINDS);

// ---------- Titration ----------

export const createTitrationStepSchema = z.object({
  treatmentKey: z.string().trim().min(1).max(80),
  date: planDateSchema,
  dose: z.string().trim().min(1).max(60),
});

// ---------- Milestones ----------

const listSchema = z.array(z.string().trim().min(1).max(200)).max(20);

export const createMilestoneSchema = z.object({
  kind: milestoneKindSchema.optional(),
  title: z.string().trim().min(1).max(120),
  date: planDateSchema,
  notes: z.string().trim().max(500).nullable().optional(),
  items: listSchema.optional(),
  advisories: listSchema.optional(),
});

export const updateMilestoneSchema = z
  .object({
    kind: milestoneKindSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    date: planDateSchema.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    items: listSchema.optional(),
    advisories: listSchema.optional(),
    isDone: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// ---------- Attachments (referti) ----------

export const createMilestoneAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(ATTACHMENT_MIME_TYPES),
  // base64 is 4 bytes per 3, plus padding and any newlines a client inserts.
  // This is only a cheap upper bound: the size that counts is the decoded
  // one, and it is checked server-side after decoding
  content: z
    .string()
    .min(1)
    .max(Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 4096),
});

export const updateMilestoneAttachmentSchema = z.object({
  includeInExport: z.boolean(),
});

// ---------- Weight ----------

export const saveWeightSchema = z.object({
  date: planDateSchema,
  // Wide but not absurd: a typo of one digit should still be rejected
  weightKg: z.number().min(20).max(400),
  note: z.string().trim().max(200).nullable().optional(),
});

// ---------- Ranges ----------

export const therapyRangeQuerySchema = z.object({
  from: planDateSchema.optional(),
  to: planDateSchema.optional(),
});

// ---------- Type exports ----------

export type CreateTitrationStepInput = z.infer<typeof createTitrationStepSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateMilestoneAttachmentInput = z.infer<typeof createMilestoneAttachmentSchema>;
export type UpdateMilestoneAttachmentInput = z.infer<typeof updateMilestoneAttachmentSchema>;
export type SaveWeightInput = z.infer<typeof saveWeightSchema>;
