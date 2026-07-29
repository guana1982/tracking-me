import { z } from 'zod';
import { INTAKE_STATUSES, TREATMENT_KINDS } from './therapy-dictionaries';

// ============================================================
// Intake & check-in module - Zod validation schemas
// ============================================================

const therapyDateSchema = z.string().date();
const slotSchema = z.string().trim().min(1).max(64);

export const treatmentKindSchema = z.enum(TREATMENT_KINDS);
export const intakeStatusSchema = z.enum(INTAKE_STATUSES);

// ---------- Catalogue ----------

export const createTreatmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: treatmentKindSchema.optional(),
  detail: z.string().trim().max(120).nullable().optional(),
  form: z.string().trim().max(60).nullable().optional(),
  dose: z.string().trim().max(60).nullable().optional(),
  // At least one moment, otherwise the entry could never be ticked anywhere
  slots: z.array(slotSchema).min(1).max(12),
  notes: z.string().trim().max(500).nullable().optional(),
  startedOn: therapyDateSchema.nullable().optional(),
});

export const updateTreatmentSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    kind: treatmentKindSchema.optional(),
    detail: z.string().trim().max(120).nullable().optional(),
    form: z.string().trim().max(60).nullable().optional(),
    dose: z.string().trim().max(60).nullable().optional(),
    slots: z.array(slotSchema).min(1).max(12).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    startedOn: therapyDateSchema.nullable().optional(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// ---------- Adherence ----------

export const setIntakeSchema = z.object({
  date: therapyDateSchema,
  treatmentKey: z.string().trim().min(1).max(80),
  slot: slotSchema,
  status: intakeStatusSchema.nullable(),
});

export const setIntakesSchema = z.object({
  entries: z.array(setIntakeSchema).min(1).max(50),
});

export const intakeDayQuerySchema = z.object({
  date: therapyDateSchema,
});

export const intakeRangeQuerySchema = z.object({
  from: therapyDateSchema.optional(),
  to: therapyDateSchema.optional(),
});

// ---------- Check-in ----------

export const createCheckInScaleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  lowLabel: z.string().trim().max(80).optional(),
  highLabel: z.string().trim().max(80).optional(),
  levelLabels: z.array(z.string().trim().min(1).max(40)).max(11).optional(),
  maxValue: z.number().int().min(1).max(10).optional(),
  isPositive: z.boolean().optional(),
  isCore: z.boolean().optional(),
  isSideEffect: z.boolean().optional(),
});

export const updateCheckInScaleSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    lowLabel: z.string().trim().max(80).optional(),
    highLabel: z.string().trim().max(80).optional(),
    levelLabels: z.array(z.string().trim().min(1).max(40)).max(11).optional(),
    maxValue: z.number().int().min(1).max(10).optional(),
    isPositive: z.boolean().optional(),
    isCore: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const saveCheckInSchema = z.object({
  date: therapyDateSchema,
  values: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        value: z.number().int().min(0).max(10),
      })
    )
    .max(20),
  note: z.string().trim().max(500).nullable().optional(),
});

export const checkInDayQuerySchema = z.object({
  date: therapyDateSchema,
});

// ---------- Type exports ----------

export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;
export type UpdateTreatmentInput = z.infer<typeof updateTreatmentSchema>;
export type SetIntakeInput = z.infer<typeof setIntakeSchema>;
export type SetIntakesInput = z.infer<typeof setIntakesSchema>;
export type CreateCheckInScaleInput = z.infer<typeof createCheckInScaleSchema>;
export type UpdateCheckInScaleInput = z.infer<typeof updateCheckInScaleSchema>;
export type SaveCheckInInput = z.infer<typeof saveCheckInSchema>;
