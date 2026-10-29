import {
  fromBaseAmount,
  guessKitchenCategory,
  kitchenNameKey,
  roundKitchenQuantity,
  toBaseAmount,
  unitDimension,
  type IngredientDTO,
  type IngredientNeedDTO,
  type KitchenCategoryDTO,
  type KitchenUnitDTO,
  type MealAvailabilityDTO,
  type MealPlanStatusDTO,
  type MealSlotDTO,
  type RecipeSlotDTO,
} from '@budget/shared';

/**
 * The arithmetic behind the kitchen page, kept free of Prisma so it can be
 * tested on its own: walk the rest of the week's menu in order, take each
 * dish's ingredients out of what is at home, and see where it runs out.
 */

const EPSILON = 1e-6;

export interface PlanningPantryItem {
  id: string;
  name: string;
  category: KitchenCategoryDTO;
  quantity: number;
  unit: KitchenUnitDTO;
}

export interface PlanningShoppingItem {
  name: string;
  quantity: number | null;
  unit: KitchenUnitDTO;
}

export interface PlanningRecipe {
  id: string;
  name: string;
  slot: RecipeSlotDTO;
  ingredients: IngredientDTO[];
}

export interface PlanningEntry {
  id: string;
  date: string;
  slot: MealSlotDTO;
  recipeId: string | null;
  status: MealPlanStatusDTO;
  createdAt: string;
}

export interface EntryPlan {
  availability: MealAvailabilityDTO;
  missing: IngredientNeedDTO[];
}

export interface WeekPlanResult {
  entries: Map<string, EntryPlan>;
  /** Base amount each pantry item is counted on for, keyed by item id */
  reserved: Map<string, number>;
  shortFrom: string | null;
  shortFromAfterShopping: string | null;
  toBuy: IngredientNeedDTO[];
  ideas: Array<{ recipeId: string; missing: IngredientNeedDTO[] }>;
  missingNow: Map<string, IngredientNeedDTO[]>;
}

/** One kind of thing in one kind of measure: eggs in pieces, flour in grams */
function stockKey(name: string, unit: KitchenUnitDTO): string {
  return `${kitchenNameKey(name)}|${unitDimension(unit)}`;
}

/** Base amounts by stock key. Infinity = "bought, in whatever amount" */
type Stock = Map<string, number>;

function pantryStock(pantry: PlanningPantryItem[]): Stock {
  const stock: Stock = new Map();
  for (const item of pantry) {
    const key = stockKey(item.name, item.unit);
    stock.set(key, (stock.get(key) ?? 0) + toBaseAmount(Math.max(0, item.quantity), item.unit));
  }
  return stock;
}

function addShopping(stock: Stock, shopping: PlanningShoppingItem[]): Stock {
  const result = new Map(stock);
  for (const item of shopping) {
    const key = stockKey(item.name, item.unit);
    const amount = item.quantity === null ? Infinity : toBaseAmount(item.quantity, item.unit);
    result.set(key, (result.get(key) ?? 0) + amount);
  }
  return result;
}

/** Anything at all of that name in the house, whatever it is measured in */
function hasAny(stock: Stock, name: string): boolean {
  const prefix = `${kitchenNameKey(name)}|`;
  for (const [key, amount] of stock) {
    if (key.startsWith(prefix) && amount > EPSILON) return true;
  }
  return false;
}

type Category = (name: string) => KitchenCategoryDTO;

/**
 * Takes a dish's ingredients out of the stock and returns what was not there.
 * The stock is changed in place: the next dish only sees what is left.
 */
function consume(
  stock: Stock,
  ingredients: IngredientDTO[],
  categoryOf: Category,
  taken?: Map<string, number>
): IngredientNeedDTO[] {
  const missing: IngredientNeedDTO[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.quantity === null) {
      if (!hasAny(stock, ingredient.name)) {
        missing.push({ ...ingredient, category: categoryOf(ingredient.name) });
      }
      continue;
    }
    const key = stockKey(ingredient.name, ingredient.unit);
    const need = toBaseAmount(ingredient.quantity, ingredient.unit);
    const available = stock.get(key) ?? 0;
    const take = Math.min(need, available);
    if (take > 0) {
      stock.set(key, available - take);
      taken?.set(key, (taken.get(key) ?? 0) + take);
    }
    const deficit = need - take;
    if (deficit > EPSILON) {
      missing.push({
        name: ingredient.name,
        quantity: roundKitchenQuantity(fromBaseAmount(deficit, ingredient.unit)),
        unit: ingredient.unit,
        category: categoryOf(ingredient.name),
      });
    }
  }
  return missing;
}

function missingAgainst(stock: Stock, ingredients: IngredientDTO[], categoryOf: Category) {
  return consume(new Map(stock), ingredients, categoryOf);
}

const SLOT_ORDER: Record<MealSlotDTO, number> = { LUNCH: 0, DINNER: 1 };

export function sortPlanEntries<T extends { date: string; slot: MealSlotDTO; createdAt: string }>(
  entries: T[]
): T[] {
  return [...entries].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot] ||
      left.createdAt.localeCompare(right.createdAt)
  );
}

/** Adds up the same thing asked for by several dishes into one line */
function mergeNeeds(needs: IngredientNeedDTO[]): IngredientNeedDTO[] {
  const merged = new Map<string, IngredientNeedDTO>();
  const order: string[] = [];
  for (const need of needs) {
    const key = stockKey(need.name, need.unit);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...need });
      order.push(key);
      continue;
    }
    if (current.quantity === null || need.quantity === null) {
      current.quantity = current.quantity ?? need.quantity;
      continue;
    }
    const total = toBaseAmount(current.quantity, current.unit) + toBaseAmount(need.quantity, need.unit);
    current.quantity = roundKitchenQuantity(fromBaseAmount(total, current.unit));
  }
  return order.map((key) => merged.get(key)!);
}

export function planWeek(input: {
  today: string;
  pantry: PlanningPantryItem[];
  pendingShopping: PlanningShoppingItem[];
  recipes: PlanningRecipe[];
  entries: PlanningEntry[];
}): WeekPlanResult {
  const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const categories = new Map<string, KitchenCategoryDTO>();
  // "Altro" on a pantry row is the absence of a choice, not a choice
  for (const item of input.pantry) {
    if (item.category !== 'OTHER') categories.set(kitchenNameKey(item.name), item.category);
  }
  const categoryOf: Category = (name) => categories.get(kitchenNameKey(name)) ?? guessKitchenCategory(name);

  const atHome = pantryStock(input.pantry);
  const fullPantry = new Map(atHome);
  const afterShopping = addShopping(atHome, input.pendingShopping);
  const taken = new Map<string, number>();

  const entries = new Map<string, EntryPlan>();
  let shortFrom: string | null = null;
  let shortFromAfterShopping: string | null = null;
  const stillMissing: IngredientNeedDTO[] = [];

  for (const entry of sortPlanEntries(input.entries)) {
    if (entry.status !== 'PLANNED') {
      entries.set(entry.id, { availability: 'DONE', missing: [] });
      continue;
    }
    if (entry.date < input.today) {
      entries.set(entry.id, { availability: 'PAST', missing: [] });
      continue;
    }
    const recipe = entry.recipeId ? recipes.get(entry.recipeId) : undefined;
    if (!recipe) {
      entries.set(entry.id, { availability: 'FREE', missing: [] });
      continue;
    }

    const missing = consume(atHome, recipe.ingredients, categoryOf, taken);
    const missingAfterShopping = consume(afterShopping, recipe.ingredients, categoryOf);
    if (missing.length > 0 && !shortFrom) shortFrom = entry.date;
    if (missingAfterShopping.length > 0 && !shortFromAfterShopping) shortFromAfterShopping = entry.date;
    stillMissing.push(...missingAfterShopping);

    entries.set(entry.id, {
      availability: missing.length === 0 ? 'READY' : missingAfterShopping.length === 0 ? 'ON_LIST' : 'MISSING',
      missing,
    });
  }

  // What the menu counts on, handed out to the pantry rows that hold it
  const reserved = new Map<string, number>();
  for (const item of input.pantry) {
    const key = stockKey(item.name, item.unit);
    const left = taken.get(key) ?? 0;
    if (left <= 0) continue;
    const share = Math.min(left, toBaseAmount(Math.max(0, item.quantity), item.unit));
    if (share > 0) reserved.set(item.id, share);
    taken.set(key, left - share);
  }

  const ideas = input.recipes
    .map((recipe) => ({ recipeId: recipe.id, missing: missingAgainst(atHome, recipe.ingredients, categoryOf) }))
    .filter((idea) => idea.missing.length <= 2)
    .sort(
      (left, right) =>
        left.missing.length - right.missing.length ||
        (recipes.get(left.recipeId)?.name ?? '').localeCompare(recipes.get(right.recipeId)?.name ?? '', 'it')
    );

  const missingNow = new Map(
    input.recipes.map((recipe) => [recipe.id, missingAgainst(fullPantry, recipe.ingredients, categoryOf)])
  );

  return {
    entries,
    reserved,
    shortFrom,
    shortFromAfterShopping,
    toBuy: mergeNeeds(stillMissing),
    ideas,
    missingNow,
  };
}

export interface ConsumedPortion {
  pantryItemId: string;
  /** In the pantry item's unit */
  quantity: number;
}

/**
 * Cooking a dish: what comes out of which pantry row. Never goes below zero -
 * if the pantry said there were 2 eggs and the dish used 3, there are none.
 */
export function portionsToConsume(
  pantry: PlanningPantryItem[],
  ingredients: IngredientDTO[]
): ConsumedPortion[] {
  const left = new Map(pantry.map((item) => [item.id, Math.max(0, item.quantity)]));
  const portions: ConsumedPortion[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.quantity === null) continue;
    let need = toBaseAmount(ingredient.quantity, ingredient.unit);
    const key = stockKey(ingredient.name, ingredient.unit);
    for (const item of pantry) {
      if (need <= EPSILON) break;
      if (stockKey(item.name, item.unit) !== key) continue;
      const available = toBaseAmount(left.get(item.id) ?? 0, item.unit);
      const take = Math.min(need, available);
      if (take <= 0) continue;
      const quantity = fromBaseAmount(take, item.unit);
      left.set(item.id, (left.get(item.id) ?? 0) - quantity);
      portions.push({ pantryItemId: item.id, quantity });
      need -= take;
    }
  }
  return portions;
}

/** Monday of the ISO week containing a plain calendar date */
export function kitchenWeekStart(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

export function addDaysIso(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
