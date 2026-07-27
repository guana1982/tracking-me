import { z } from 'zod';
import {
  QUICK_LOG_CATEGORIES,
  QUICK_LOG_VALENCES,
} from './food-dictionaries';

// ============================================================
// Food Diary module - Zod validation schemas
// ============================================================

export const mealTypeSchema = z.string().trim().min(1).max(64);
export const mealItemUnitSchema = z.string().trim().min(1).max(64);
export const quickLogCategorySchema = z.enum(QUICK_LOG_CATEGORIES);
export const quickLogValenceSchema = z.enum(QUICK_LOG_VALENCES);

const foodDateSchema = z.string().date();

// ---------- Meals ----------

export const createMealItemSchema = z.object({
  foodName: z.string().min(1).max(120).trim(),
  // Optional by design: a meal without quantities is better than no meal
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: mealItemUnitSchema.nullable().optional(),
});

// Client resizes to ~1280px JPEG before upload; cap the payload anyway
export const mealPhotoUploadSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: 'Photo must be a base64 image data URL',
    })
    .max(2_800_000),
});

export const createMealSchema = z.object({
  date: foodDateSchema,
  mealType: mealTypeSchema,
  notes: z.string().max(1000).trim().optional(),
  items: z.array(createMealItemSchema).min(1).max(50),
  photo: mealPhotoUploadSchema.nullable().optional(),
});

export const updateMealSchema = z
  .object({
    date: foodDateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    notes: z.string().max(1000).trim().nullable().optional(),
    items: z.array(createMealItemSchema).min(1).max(50).optional(),
    // undefined = untouched, null = remove photo, object = replace photo
    photo: mealPhotoUploadSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.date !== undefined ||
      data.mealType !== undefined ||
      data.notes !== undefined ||
      data.items !== undefined ||
      data.photo !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

// tzOffset = minutes to ADD to UTC to get the user's local time
// (frontend sends -new Date().getTimezoneOffset(); Italy in summer = +120).
// Used to attribute timestamps to the correct local day.
const tzOffsetSchema = z.coerce.number().int().min(-840).max(840).default(0);

export const foodRangeQuerySchema = z.object({
  from: foodDateSchema.optional(),
  to: foodDateSchema.optional(),
  tzOffset: tzOffsetSchema,
});

export const foodSuggestionQuerySchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const repeatMealQuerySchema = z.object({
  date: foodDateSchema,
  mealType: mealTypeSchema,
});

export const createMealTypeDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export const updateMealTypeDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    position: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.position !== undefined || data.isActive !== undefined,
    { message: 'At least one field must be provided' }
  );

export const createMealUnitDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(24),
});

export const updateMealUnitDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(24).optional(),
    position: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.position !== undefined || data.isActive !== undefined,
    { message: 'At least one field must be provided' }
  );

// ---------- Mood definitions ----------

export const createMoodDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(40),
  valence: quickLogValenceSchema,
});

export const updateMoodDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    valence: quickLogValenceSchema.optional(),
    position: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.valence !== undefined ||
      data.position !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field must be provided' }
  );

// ---------- Quick logs ----------

export const createQuickLogSchema = z.object({
  // Raw free text, no content validation by design (dictation-friendly)
  text: z.string().trim().min(1).max(2000),
  loggedAt: z.string().datetime({ offset: true }).optional(),
  // Structured entries (mood picker) pin category/valence explicitly
  derivedCategory: quickLogCategorySchema.optional(),
  derivedValence: quickLogValenceSchema.optional(),
});

export const updateQuickLogSchema = z
  .object({
    text: z.string().trim().min(1).max(2000).optional(),
    derivedCategory: quickLogCategorySchema.optional(),
    derivedValence: quickLogValenceSchema.optional(),
  })
  .refine(
    (data) =>
      data.text !== undefined ||
      data.derivedCategory !== undefined ||
      data.derivedValence !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

// ---------- Dashboard ----------

export const foodComparisonQuerySchema = z
  .object({
    condition: z.enum(['WORKOUT', 'DINNER_AFTER_21', 'FOOD', 'SUPPLEMENT_PERIOD']),
    value: z.string().min(1).max(120).optional(), // food or supplement name
    from: foodDateSchema.optional(),
    to: foodDateSchema.optional(),
    tzOffset: tzOffsetSchema,
  })
  .refine(
    (data) =>
      (data.condition !== 'FOOD' && data.condition !== 'SUPPLEMENT_PERIOD') ||
      data.value !== undefined,
    {
      message: 'A value is required for FOOD and SUPPLEMENT_PERIOD conditions',
    }
  );

// ---------- Type exports ----------

export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
export type CreateQuickLogInput = z.infer<typeof createQuickLogSchema>;
export type UpdateQuickLogInput = z.infer<typeof updateQuickLogSchema>;
export type FoodRangeQueryInput = z.infer<typeof foodRangeQuerySchema>;
export type FoodComparisonQueryInput = z.infer<typeof foodComparisonQuerySchema>;
export type CreateMealTypeDefinitionInput = z.infer<typeof createMealTypeDefinitionSchema>;
export type UpdateMealTypeDefinitionInput = z.infer<typeof updateMealTypeDefinitionSchema>;
export type CreateMealUnitDefinitionInput = z.infer<typeof createMealUnitDefinitionSchema>;
export type UpdateMealUnitDefinitionInput = z.infer<typeof updateMealUnitDefinitionSchema>;
export type CreateMoodDefinitionInput = z.infer<typeof createMoodDefinitionSchema>;
export type UpdateMoodDefinitionInput = z.infer<typeof updateMoodDefinitionSchema>;
