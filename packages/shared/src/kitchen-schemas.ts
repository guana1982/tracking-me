import { z } from 'zod';
import {
  KITCHEN_CATEGORIES,
  KITCHEN_UNITS,
  MEAL_PLAN_STATUSES,
  MEAL_SLOTS,
  RECIPE_SLOTS,
} from './kitchen-types';

const kitchenDateSchema = z.string().date();
const kitchenNameSchema = z.string().trim().min(1).max(80);

export const kitchenIdSchema = z.string().trim().min(1).max(80);
export const kitchenUnitSchema = z.enum(KITCHEN_UNITS);
export const kitchenCategorySchema = z.enum(KITCHEN_CATEGORIES);
export const mealSlotSchema = z.enum(MEAL_SLOTS);
export const recipeSlotSchema = z.enum(RECIPE_SLOTS);
export const mealPlanStatusSchema = z.enum(MEAL_PLAN_STATUSES);

const quantitySchema = z.number().finite().min(0).max(100000);
const positiveQuantitySchema = z.number().finite().positive().max(100000);

export const kitchenWeekQuerySchema = z.object({
  date: kitchenDateSchema,
  /** The device's own today: the server clock may already be on tomorrow */
  today: kitchenDateSchema.optional(),
});

export const kitchenRangeQuerySchema = z
  .object({
    from: kitchenDateSchema,
    to: kitchenDateSchema,
    today: kitchenDateSchema.optional(),
  })
  .refine((data) => data.from <= data.to, {
    path: ['to'],
    message: 'La data finale non può precedere quella iniziale',
  });

export const ingredientSchema = z.object({
  name: kitchenNameSchema,
  quantity: positiveQuantitySchema.nullable(),
  unit: kitchenUnitSchema,
});

export const createPantryItemSchema = z.object({
  name: kitchenNameSchema,
  category: kitchenCategorySchema.optional(),
  quantity: quantitySchema,
  unit: kitchenUnitSchema,
});

export const updatePantryItemSchema = createPantryItemSchema.partial();

export const adjustPantryItemSchema = z.object({
  /** In the item's own unit; negative = used up */
  delta: z.number().finite().min(-100000).max(100000),
});

export const createShoppingItemSchema = z.object({
  weekStart: kitchenDateSchema,
  name: kitchenNameSchema,
  category: kitchenCategorySchema.optional(),
  quantity: positiveQuantitySchema.nullable().optional(),
  unit: kitchenUnitSchema.optional(),
});

export const updateShoppingItemSchema = z.object({
  name: kitchenNameSchema.optional(),
  category: kitchenCategorySchema.optional(),
  quantity: positiveQuantitySchema.nullable().optional(),
  unit: kitchenUnitSchema.optional(),
  checked: z.boolean().optional(),
});

export const kitchenWeekBodySchema = z.object({
  /** Any day of the week the action is about */
  date: kitchenDateSchema,
  today: kitchenDateSchema.optional(),
});

export const createRecipeSchema = z.object({
  name: kitchenNameSchema,
  slot: recipeSlotSchema.default('ANY'),
  notes: z.string().trim().max(2000).nullable().optional(),
  ingredients: z.array(ingredientSchema).max(60),
});

export const updateRecipeSchema = z.object({
  name: kitchenNameSchema.optional(),
  slot: recipeSlotSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  ingredients: z.array(ingredientSchema).max(60).optional(),
});

export const createMealPlanEntrySchema = z
  .object({
    date: kitchenDateSchema,
    slot: mealSlotSchema,
    recipeId: kitchenIdSchema.nullable().optional(),
    title: z.string().trim().max(120).optional(),
  })
  .refine((data) => Boolean(data.recipeId) || Boolean(data.title), {
    path: ['title'],
    message: 'Scegli un piatto o scrivi cosa si mangia',
  });

export const updateMealPlanEntrySchema = z.object({
  date: kitchenDateSchema.optional(),
  slot: mealSlotSchema.optional(),
  recipeId: kitchenIdSchema.nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  status: mealPlanStatusSchema.optional(),
});
