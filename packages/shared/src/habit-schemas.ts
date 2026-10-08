import { z } from 'zod';
import { HABIT_MEASURES, HABIT_STATUSES } from './habit-types';
import { DAY_TRACKS } from './rating-types';

// ============================================================
// Habits - Zod validation schemas
// ============================================================

const habitDateSchema = z.string().date();
const weekdaysSchema = z.array(z.number().int().min(1).max(7)).max(7);
// Wide but bounded: minutes of study and kilometres run share the same field
const amountSchema = z.number().int().min(0).max(100000);

export const habitMeasureSchema = z.enum(HABIT_MEASURES);
export const habitStatusSchema = z.enum(HABIT_STATUSES);

export const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(60),
  measure: habitMeasureSchema.optional(),
  unit: z.string().trim().max(20).optional(),
  target: amountSchema.nullable().optional(),
  moment: z.string().trim().max(40).nullable().optional(),
  daysOfWeek: weekdaysSchema.optional(),
  track: z.enum(DAY_TRACKS).optional(),
});

export const updateHabitSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    measure: habitMeasureSchema.optional(),
    unit: z.string().trim().max(20).optional(),
    target: amountSchema.nullable().optional(),
    moment: z.string().trim().max(40).nullable().optional(),
    daysOfWeek: weekdaysSchema.optional(),
    track: z.enum(DAY_TRACKS).optional(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const setHabitSchema = z.object({
  date: habitDateSchema,
  habitKey: z.string().trim().min(1).max(80),
  status: habitStatusSchema.nullable(),
  value: amountSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const habitDayQuerySchema = z.object({
  date: habitDateSchema,
});

export const habitRangeQuerySchema = z.object({
  from: habitDateSchema.optional(),
  to: habitDateSchema.optional(),
});

// ---------- Type exports ----------

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type SetHabitInput = z.infer<typeof setHabitSchema>;
