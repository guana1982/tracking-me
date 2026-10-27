// ============================================================
// Kitchen - weekly shopping list, pantry, family dishes, menu
// ============================================================

export const KITCHEN_UNITS = ['pz', 'g', 'kg', 'ml', 'l', 'conf'] as const;
export type KitchenUnitDTO = (typeof KITCHEN_UNITS)[number];

export const KITCHEN_UNIT_LABELS: Record<KitchenUnitDTO, string> = {
  pz: 'pezzi',
  g: 'grammi',
  kg: 'chili',
  ml: 'millilitri',
  l: 'litri',
  conf: 'confezioni',
};

/** Aisles, in the order a supermarket is usually walked */
export const KITCHEN_CATEGORIES = [
  'PRODUCE',
  'BAKERY',
  'MEAT_FISH',
  'DAIRY',
  'PANTRY',
  'FROZEN',
  'DRINKS',
  'HOUSEHOLD',
  'OTHER',
] as const;
export type KitchenCategoryDTO = (typeof KITCHEN_CATEGORIES)[number];

export const KITCHEN_CATEGORY_META: Record<KitchenCategoryDTO, { label: string; emoji: string }> = {
  PRODUCE: { label: 'Frutta e verdura', emoji: '🥦' },
  BAKERY: { label: 'Pane, pasta e cereali', emoji: '🥖' },
  MEAT_FISH: { label: 'Carne e pesce', emoji: '🍗' },
  DAIRY: { label: 'Latticini e uova', emoji: '🧀' },
  PANTRY: { label: 'Dispensa', emoji: '🥫' },
  FROZEN: { label: 'Surgelati', emoji: '🧊' },
  DRINKS: { label: 'Bevande', emoji: '🧃' },
  HOUSEHOLD: { label: 'Casa e igiene', emoji: '🧻' },
  OTHER: { label: 'Altro', emoji: '🛒' },
};

export const MEAL_SLOTS = ['LUNCH', 'DINNER'] as const;
export type MealSlotDTO = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlotDTO, string> = {
  LUNCH: 'Pranzo',
  DINNER: 'Cena',
};

/** When a dish is usually eaten; ANY shows it for both */
export const RECIPE_SLOTS = ['LUNCH', 'DINNER', 'ANY'] as const;
export type RecipeSlotDTO = (typeof RECIPE_SLOTS)[number];

export const MEAL_PLAN_STATUSES = ['PLANNED', 'COOKED', 'SKIPPED'] as const;
export type MealPlanStatusDTO = (typeof MEAL_PLAN_STATUSES)[number];

/**
 * What a planned meal means for the pantry, worked out over the whole rest of
 * the week in order, so two dinners cannot both count on the same eggs.
 * - READY: everything is at home
 * - ON_LIST: something is missing, but it is already on the shopping list
 * - MISSING: something is missing and nobody has written it down yet
 * - FREE: no dish attached, so nothing to check
 * - DONE: cooked or skipped
 * - PAST: an earlier day still marked as planned - did it get cooked?
 */
export const MEAL_AVAILABILITIES = ['READY', 'ON_LIST', 'MISSING', 'FREE', 'DONE', 'PAST'] as const;
export type MealAvailabilityDTO = (typeof MEAL_AVAILABILITIES)[number];

export interface IngredientDTO {
  name: string;
  /** null = "some": it only has to be in the house, nothing is counted */
  quantity: number | null;
  unit: KitchenUnitDTO;
}

/** A missing amount, in the unit of what asked for it */
export interface IngredientNeedDTO extends IngredientDTO {
  category: KitchenCategoryDTO;
}

export interface PantryItemDTO {
  id: string;
  name: string;
  category: KitchenCategoryDTO;
  quantity: number;
  unit: KitchenUnitDTO;
  /** How much of it the rest of the week's menu is counting on, in the item's unit */
  reserved: number;
  updatedAt: string;
}

export interface ShoppingItemDTO {
  id: string;
  weekStart: string;
  name: string;
  category: KitchenCategoryDTO;
  quantity: number | null;
  unit: KitchenUnitDTO;
  checked: boolean;
  /** Added by "what the menu still needs" rather than typed in */
  fromPlan: boolean;
  createdAt: string;
}

export interface RecipeDTO {
  id: string;
  name: string;
  slot: RecipeSlotDTO;
  notes: string | null;
  ingredients: IngredientDTO[];
  /** Against everything in the pantry right now, menu aside */
  missingNow: IngredientNeedDTO[];
  /** How many times it is on this week's menu */
  plannedThisWeek: number;
}

export interface MealPlanEntryDTO {
  id: string;
  date: string;
  slot: MealSlotDTO;
  recipeId: string | null;
  title: string;
  status: MealPlanStatusDTO;
  availability: MealAvailabilityDTO;
  missing: IngredientNeedDTO[];
}

export interface KitchenCoverageDTO {
  /** COVERED: the rest of the menu can be cooked; SHORT: a trip is needed; EMPTY: nothing planned */
  status: 'COVERED' | 'SHORT' | 'EMPTY';
  /** First day with a meal that cannot be cooked with what is at home */
  shortFrom: string | null;
  /** Same, once the unchecked shopping list is bought */
  shortFromAfterShopping: string | null;
  plannedMeals: number;
  cookedMeals: number;
  /** Lunches and dinners from today to Sunday with nothing planned */
  emptySlots: number;
  /** Unchecked shopping list items */
  toBuyOnList: number;
}

export interface RecipeIdeaDTO {
  recipeId: string;
  name: string;
  slot: RecipeSlotDTO;
  /** Empty = can be made with what is left after the menu */
  missing: IngredientNeedDTO[];
}

export interface KitchenWeekDTO {
  today: string;
  weekStart: string;
  weekEnd: string;
  coverage: KitchenCoverageDTO;
  plan: MealPlanEntryDTO[];
  shopping: ShoppingItemDTO[];
  pantry: PantryItemDTO[];
  recipes: RecipeDTO[];
  /** What the menu still needs and is not on the list yet */
  toBuy: IngredientNeedDTO[];
  /** Dishes that fit what is left over, best first */
  ideas: RecipeIdeaDTO[];
  /** Every name used so far, for autocomplete */
  knownItems: Array<{ name: string; category: KitchenCategoryDTO; unit: KitchenUnitDTO }>;
}

export interface KitchenDayMarkDTO {
  date: string;
  planned: number;
  cooked: number;
  missing: number;
}

export interface CreatePantryItemDTO {
  name: string;
  category?: KitchenCategoryDTO;
  quantity: number;
  unit: KitchenUnitDTO;
}

export type UpdatePantryItemDTO = Partial<CreatePantryItemDTO>;

export interface CreateShoppingItemDTO {
  weekStart: string;
  name: string;
  category?: KitchenCategoryDTO;
  quantity?: number | null;
  unit?: KitchenUnitDTO;
}

export interface UpdateShoppingItemDTO {
  name?: string;
  category?: KitchenCategoryDTO;
  quantity?: number | null;
  unit?: KitchenUnitDTO;
  checked?: boolean;
}

export interface CreateRecipeDTO {
  name: string;
  slot?: RecipeSlotDTO;
  notes?: string | null;
  ingredients: IngredientDTO[];
}

export type UpdateRecipeDTO = Partial<CreateRecipeDTO>;

export interface CreateMealPlanEntryDTO {
  date: string;
  slot: MealSlotDTO;
  recipeId?: string | null;
  title?: string;
}

export interface UpdateMealPlanEntryDTO {
  date?: string;
  slot?: MealSlotDTO;
  recipeId?: string | null;
  title?: string;
  status?: MealPlanStatusDTO;
}
