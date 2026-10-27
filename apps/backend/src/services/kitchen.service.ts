import { Prisma, type MealPlanEntry, type PantryItem, type Recipe, type ShoppingItem } from '@prisma/client';
import {
  fromBaseAmount,
  guessKitchenCategory,
  ingredientSchema,
  isKitchenUnit,
  KITCHEN_CATEGORIES,
  kitchenNameKey,
  roundKitchenQuantity,
  toBaseAmount,
  unitDimension,
  type CreateMealPlanEntryDTO,
  type CreatePantryItemDTO,
  type CreateRecipeDTO,
  type CreateShoppingItemDTO,
  type IngredientDTO,
  type KitchenCategoryDTO,
  type KitchenDayMarkDTO,
  type KitchenUnitDTO,
  type KitchenWeekDTO,
  type MealPlanEntryDTO,
  type PantryItemDTO,
  type RecipeDTO,
  type ShoppingItemDTO,
  type UpdateMealPlanEntryDTO,
  type UpdatePantryItemDTO,
  type UpdateRecipeDTO,
  type UpdateShoppingItemDTO,
} from '@budget/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import {
  addDaysIso,
  kitchenWeekStart,
  planWeek,
  portionsToConsume,
  sortPlanEntries,
  type ConsumedPortion,
  type PlanningPantryItem,
  type PlanningRecipe,
} from './kitchen-planning.js';

type Tx = Prisma.TransactionClient;

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function localToday(): string {
  return toIsoDate(new Date());
}

function asCategory(value: string): KitchenCategoryDTO {
  return (KITCHEN_CATEGORIES as readonly string[]).includes(value) ? (value as KitchenCategoryDTO) : 'OTHER';
}

function asUnit(value: string): KitchenUnitDTO {
  return isKitchenUnit(value) ? value : 'pz';
}

/** Rows written by an older shape, or by hand, are skipped rather than trusted */
function parseIngredients(value: Prisma.JsonValue): IngredientDTO[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = ingredientSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function parseConsumed(value: Prisma.JsonValue | null): ConsumedPortion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { pantryItemId, quantity } = entry as Record<string, unknown>;
    return typeof pantryItemId === 'string' && typeof quantity === 'number' ? [{ pantryItemId, quantity }] : [];
  });
}

function toPlanningPantry(item: PantryItem): PlanningPantryItem {
  return {
    id: item.id,
    name: item.name,
    category: asCategory(item.category),
    quantity: item.quantity,
    unit: asUnit(item.unit),
  };
}

function toPlanningRecipe(recipe: Recipe): PlanningRecipe {
  return { id: recipe.id, name: recipe.name, slot: recipe.slot, ingredients: parseIngredients(recipe.ingredientsJson) };
}

function toShoppingDTO(item: ShoppingItem): ShoppingItemDTO {
  return {
    id: item.id,
    weekStart: toIsoDate(item.weekStart),
    name: item.name,
    category: asCategory(item.category),
    quantity: item.quantity,
    unit: asUnit(item.unit),
    checked: item.checked,
    fromPlan: item.fromPlan,
    createdAt: item.createdAt.toISOString(),
  };
}

class KitchenService {
  // ----------------------------------------------------------------
  // The week, worked out
  // ----------------------------------------------------------------

  async getWeek(userId: string, date: string, today = localToday()): Promise<KitchenWeekDTO> {
    const weekStart = kitchenWeekStart(date);
    const weekEnd = addDaysIso(weekStart, 6);

    const [pantry, shopping, recipes, entries] = await Promise.all([
      prisma.pantryItem.findMany({ where: { userId }, orderBy: [{ name: 'asc' }] }),
      prisma.shoppingItem.findMany({
        where: { userId, weekStart: dateOnly(weekStart) },
        orderBy: [{ createdAt: 'asc' }],
      }),
      prisma.recipe.findMany({ where: { userId }, orderBy: [{ name: 'asc' }] }),
      prisma.mealPlanEntry.findMany({
        where: { userId, date: { gte: dateOnly(weekStart), lte: dateOnly(weekEnd) } },
      }),
    ]);

    const planningRecipes = recipes.map(toPlanningRecipe);
    const planningEntries = entries.map((entry) => ({
      id: entry.id,
      date: toIsoDate(entry.date),
      slot: entry.slot,
      recipeId: entry.recipeId,
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
    }));
    const result = planWeek({
      today,
      pantry: pantry.map(toPlanningPantry),
      pendingShopping: shopping
        .filter((item) => !item.checked)
        .map((item) => ({ name: item.name, quantity: item.quantity, unit: asUnit(item.unit) })),
      recipes: planningRecipes,
      entries: planningEntries,
    });

    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const plan: MealPlanEntryDTO[] = sortPlanEntries(planningEntries).map((entry) => {
      const record = byId.get(entry.id)!;
      const computed = result.entries.get(entry.id) ?? { availability: 'FREE' as const, missing: [] };
      return {
        id: entry.id,
        date: entry.date,
        slot: entry.slot,
        recipeId: entry.recipeId,
        title: record.title,
        status: entry.status,
        availability: computed.availability,
        missing: computed.missing,
      };
    });

    const plannedThisWeek = new Map<string, number>();
    for (const entry of entries) {
      if (entry.recipeId && entry.status !== 'SKIPPED') {
        plannedThisWeek.set(entry.recipeId, (plannedThisWeek.get(entry.recipeId) ?? 0) + 1);
      }
    }

    const recipeDTOs: RecipeDTO[] = recipes.map((recipe, index) => ({
      id: recipe.id,
      name: recipe.name,
      slot: recipe.slot,
      notes: recipe.notes,
      ingredients: planningRecipes[index].ingredients,
      missingNow: result.missingNow.get(recipe.id) ?? [],
      plannedThisWeek: plannedThisWeek.get(recipe.id) ?? 0,
    }));

    const pantryDTOs: PantryItemDTO[] = pantry.map((item) => ({
      id: item.id,
      name: item.name,
      category: asCategory(item.category),
      quantity: roundKitchenQuantity(item.quantity),
      unit: asUnit(item.unit),
      reserved: roundKitchenQuantity(fromBaseAmount(result.reserved.get(item.id) ?? 0, asUnit(item.unit))),
      updatedAt: item.updatedAt.toISOString(),
    }));

    // Lunch and dinner for each day still ahead this week, minus what is planned
    const firstOpenDay = today > weekStart ? today : weekStart;
    let emptySlots = 0;
    for (let day = firstOpenDay; day <= weekEnd; day = addDaysIso(day, 1)) {
      for (const slot of ['LUNCH', 'DINNER'] as const) {
        const taken = plan.some((entry) => entry.date === day && entry.slot === slot && entry.status !== 'SKIPPED');
        if (!taken) emptySlots += 1;
      }
    }

    const future = plan.filter((entry) => entry.status === 'PLANNED' && entry.date >= today);
    const known = new Map<string, { name: string; category: KitchenCategoryDTO; unit: KitchenUnitDTO }>();
    const remember = (name: string, category: KitchenCategoryDTO, unit: KitchenUnitDTO) => {
      const key = kitchenNameKey(name);
      if (!known.has(key)) known.set(key, { name, category, unit });
    };
    for (const item of pantryDTOs) remember(item.name, item.category, item.unit);
    for (const item of shopping) remember(item.name, asCategory(item.category), asUnit(item.unit));
    for (const recipe of recipeDTOs) {
      for (const ingredient of recipe.ingredients) {
        remember(ingredient.name, guessKitchenCategory(ingredient.name), ingredient.unit);
      }
    }

    const recipeById = new Map(recipeDTOs.map((recipe) => [recipe.id, recipe]));
    return {
      today,
      weekStart,
      weekEnd,
      coverage: {
        status: future.length === 0 ? 'EMPTY' : result.shortFrom ? 'SHORT' : 'COVERED',
        shortFrom: result.shortFrom,
        shortFromAfterShopping: result.shortFromAfterShopping,
        plannedMeals: plan.filter((entry) => entry.status !== 'SKIPPED').length,
        cookedMeals: plan.filter((entry) => entry.status === 'COOKED').length,
        emptySlots: weekEnd < today ? 0 : emptySlots,
        toBuyOnList: shopping.filter((item) => !item.checked).length,
      },
      plan,
      shopping: shopping.map(toShoppingDTO),
      pantry: pantryDTOs,
      recipes: recipeDTOs,
      toBuy: result.toBuy,
      ideas: result.ideas.slice(0, 8).map((idea) => {
        const recipe = recipeById.get(idea.recipeId)!;
        return { recipeId: recipe.id, name: recipe.name, slot: recipe.slot, missing: idea.missing };
      }),
      knownItems: [...known.values()].sort((left, right) => left.name.localeCompare(right.name, 'it')),
    };
  }

  /** The dots under the calendar days */
  async getMarks(userId: string, from: string, to: string, today = localToday()): Promise<KitchenDayMarkDTO[]> {
    const [pantry, recipes, entries] = await Promise.all([
      prisma.pantryItem.findMany({ where: { userId } }),
      prisma.recipe.findMany({ where: { userId } }),
      // From today on, the whole way: whether a later day runs short depends on
      // everything planned before it
      prisma.mealPlanEntry.findMany({
        where: {
          userId,
          OR: [
            { date: { gte: dateOnly(from), lte: dateOnly(to) } },
            { date: { gte: dateOnly(today), lte: dateOnly(to) }, status: 'PLANNED' },
          ],
        },
      }),
    ]);

    const result = planWeek({
      today,
      pantry: pantry.map(toPlanningPantry),
      pendingShopping: [],
      recipes: recipes.map(toPlanningRecipe),
      entries: entries.map((entry) => ({
        id: entry.id,
        date: toIsoDate(entry.date),
        slot: entry.slot,
        recipeId: entry.recipeId,
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
      })),
    });

    const marks = new Map<string, KitchenDayMarkDTO>();
    for (const entry of entries) {
      const date = toIsoDate(entry.date);
      if (date < from || date > to || entry.status === 'SKIPPED') continue;
      const mark = marks.get(date) ?? { date, planned: 0, cooked: 0, missing: 0 };
      if (entry.status === 'COOKED') mark.cooked += 1;
      else mark.planned += 1;
      const availability = result.entries.get(entry.id)?.availability;
      if (availability === 'MISSING' || availability === 'ON_LIST') mark.missing += 1;
      marks.set(date, mark);
    }
    return [...marks.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  // ----------------------------------------------------------------
  // Pantry
  // ----------------------------------------------------------------

  /**
   * Puts something in the pantry, on the row that already holds it when there
   * is one, converting kilos to grams and so on. Returns what was added there.
   */
  private async addToPantry(
    tx: Tx,
    userId: string,
    input: { name: string; category: KitchenCategoryDTO; quantity: number | null; unit: KitchenUnitDTO }
  ): Promise<{ pantryItemId: string; added: number }> {
    const nameKey = kitchenNameKey(input.name);
    const candidates = await tx.pantryItem.findMany({ where: { userId, nameKey }, orderBy: { createdAt: 'asc' } });
    const existing =
      candidates.find((item) => item.unit === input.unit) ??
      candidates.find((item) => isKitchenUnit(item.unit) && unitDimension(item.unit) === unitDimension(input.unit));

    if (existing) {
      const unit = asUnit(existing.unit);
      // "Some" bread: there is bread now, which is all that was said
      const added =
        input.quantity === null
          ? existing.quantity > 0
            ? 0
            : 1
          : fromBaseAmount(toBaseAmount(input.quantity, input.unit), unit);
      if (added > 0) {
        await tx.pantryItem.update({ where: { id: existing.id }, data: { quantity: { increment: added } } });
      }
      return { pantryItemId: existing.id, added };
    }

    const added = input.quantity ?? 1;
    const created = await tx.pantryItem.create({
      data: {
        userId,
        name: input.name.trim(),
        nameKey,
        category: input.category,
        quantity: added,
        unit: input.unit,
      },
    });
    return { pantryItemId: created.id, added };
  }

  private async takeFromPantry(tx: Tx, userId: string, portions: ConsumedPortion[]) {
    for (const portion of portions) {
      const item = await tx.pantryItem.findFirst({ where: { id: portion.pantryItemId, userId } });
      if (!item) continue;
      await tx.pantryItem.update({
        where: { id: item.id },
        data: { quantity: Math.max(0, roundKitchenQuantity(item.quantity - portion.quantity)) },
      });
    }
  }

  private async giveBackToPantry(tx: Tx, userId: string, portions: ConsumedPortion[]) {
    for (const portion of portions) {
      // A row deleted in the meantime stays deleted
      await tx.pantryItem.updateMany({
        where: { id: portion.pantryItemId, userId },
        data: { quantity: { increment: portion.quantity } },
      });
    }
  }

  async createPantryItem(userId: string, data: CreatePantryItemDTO) {
    return prisma.$transaction(async (tx) => {
      const { pantryItemId } = await this.addToPantry(tx, userId, {
        name: data.name,
        category: data.category ?? guessKitchenCategory(data.name),
        quantity: data.quantity,
        unit: data.unit,
      });
      return { id: pantryItemId };
    });
  }

  async updatePantryItem(userId: string, id: string, data: UpdatePantryItemDTO) {
    await this.findPantryItem(userId, id);
    await prisma.pantryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim(), nameKey: kitchenNameKey(data.name) } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
      },
    });
  }

  async adjustPantryItem(userId: string, id: string, delta: number) {
    const item = await this.findPantryItem(userId, id);
    await prisma.pantryItem.update({
      where: { id },
      data: { quantity: Math.max(0, roundKitchenQuantity(item.quantity + delta)) },
    });
  }

  async deletePantryItem(userId: string, id: string) {
    await this.findPantryItem(userId, id);
    await prisma.pantryItem.delete({ where: { id } });
  }

  private async findPantryItem(userId: string, id: string) {
    const item = await prisma.pantryItem.findFirst({ where: { id, userId } });
    if (!item) throw new AppError('Prodotto non trovato in dispensa', 404, 'NOT_FOUND');
    return item;
  }

  // ----------------------------------------------------------------
  // Shopping list
  // ----------------------------------------------------------------

  async createShoppingItem(userId: string, data: CreateShoppingItemDTO, fromPlan = false) {
    const weekStart = kitchenWeekStart(data.weekStart);
    const unit = data.unit ?? 'pz';
    const quantity = data.quantity ?? null;
    const nameKey = kitchenNameKey(data.name);

    // The same thing twice on one list is one line with more of it
    const existing = await prisma.shoppingItem.findFirst({
      where: { userId, weekStart: dateOnly(weekStart), nameKey, checked: false },
    });
    if (existing && isKitchenUnit(existing.unit) && unitDimension(existing.unit) === unitDimension(unit)) {
      const merged =
        existing.quantity === null || quantity === null
          ? existing.quantity ?? quantity
          : roundKitchenQuantity(
              existing.quantity + fromBaseAmount(toBaseAmount(quantity, unit), asUnit(existing.unit))
            );
      return toShoppingDTO(
        await prisma.shoppingItem.update({ where: { id: existing.id }, data: { quantity: merged } })
      );
    }

    return toShoppingDTO(
      await prisma.shoppingItem.create({
        data: {
          userId,
          weekStart: dateOnly(weekStart),
          name: data.name.trim(),
          nameKey,
          category: data.category ?? (await this.categoryFor(userId, data.name)),
          quantity,
          unit,
          fromPlan,
        },
      })
    );
  }

  /** The aisle it was filed under last time, before guessing from the name */
  private async categoryFor(userId: string, name: string): Promise<KitchenCategoryDTO> {
    const nameKey = kitchenNameKey(name);
    const known =
      (await prisma.pantryItem.findFirst({ where: { userId, nameKey }, select: { category: true } })) ??
      (await prisma.shoppingItem.findFirst({
        where: { userId, nameKey },
        select: { category: true },
        orderBy: { createdAt: 'desc' },
      }));
    return known ? asCategory(known.category) : guessKitchenCategory(name);
  }

  async updateShoppingItem(userId: string, id: string, data: UpdateShoppingItemDTO) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.shoppingItem.findFirst({ where: { id, userId } });
      if (!item) throw new AppError('Voce della spesa non trovata', 404, 'NOT_FOUND');

      const next = {
        name: data.name?.trim() ?? item.name,
        category: data.category ?? asCategory(item.category),
        quantity: data.quantity !== undefined ? data.quantity : item.quantity,
        unit: data.unit ?? asUnit(item.unit),
      };
      const update: Prisma.ShoppingItemUpdateInput = {
        name: next.name,
        nameKey: kitchenNameKey(next.name),
        category: next.category,
        quantity: next.quantity,
        unit: next.unit,
      };

      // Ticked = in the bag = in the pantry. Unticked = take back what ticking put there
      if (data.checked === true && !item.checked) {
        const { pantryItemId, added } = await this.addToPantry(tx, userId, next);
        Object.assign(update, { checked: true, checkedAt: new Date(), pantryItemId, addedQuantity: added });
      } else if (data.checked === false && item.checked) {
        if (item.pantryItemId && item.addedQuantity) {
          const pantryItem = await tx.pantryItem.findFirst({ where: { id: item.pantryItemId, userId } });
          if (pantryItem) {
            await tx.pantryItem.update({
              where: { id: pantryItem.id },
              data: { quantity: Math.max(0, roundKitchenQuantity(pantryItem.quantity - item.addedQuantity)) },
            });
          }
        }
        Object.assign(update, { checked: false, checkedAt: null, pantryItemId: null, addedQuantity: null });
      }

      return toShoppingDTO(await tx.shoppingItem.update({ where: { id }, data: update }));
    });
  }

  async deleteShoppingItem(userId: string, id: string) {
    const item = await prisma.shoppingItem.findFirst({ where: { id, userId } });
    if (!item) throw new AppError('Voce della spesa non trovata', 404, 'NOT_FOUND');
    // Deleting a bought line does not un-buy it: the pantry keeps it
    await prisma.shoppingItem.delete({ where: { id } });
  }

  /** Writes what the menu still needs onto the list */
  async addMissingToList(userId: string, date: string, today?: string) {
    const week = await this.getWeek(userId, date, today);
    for (const need of week.toBuy) {
      await this.createShoppingItem(
        userId,
        { weekStart: week.weekStart, name: need.name, category: need.category, quantity: need.quantity, unit: need.unit },
        true
      );
    }
    return { added: week.toBuy.length };
  }

  async clearChecked(userId: string, date: string) {
    const { count } = await prisma.shoppingItem.deleteMany({
      where: { userId, weekStart: dateOnly(kitchenWeekStart(date)), checked: true },
    });
    return { removed: count };
  }

  /** Last week's list, unticked, as a starting point */
  async copyPreviousList(userId: string, date: string) {
    const weekStart = kitchenWeekStart(date);
    const previous = await prisma.shoppingItem.findMany({
      where: { userId, weekStart: dateOnly(addDaysIso(weekStart, -7)) },
      orderBy: { createdAt: 'asc' },
    });
    for (const item of previous) {
      await this.createShoppingItem(userId, {
        weekStart,
        name: item.name,
        category: asCategory(item.category),
        quantity: item.quantity,
        unit: asUnit(item.unit),
      });
    }
    return { added: previous.length };
  }

  // ----------------------------------------------------------------
  // Dishes
  // ----------------------------------------------------------------

  async createRecipe(userId: string, data: CreateRecipeDTO) {
    const recipe = await prisma.recipe.create({
      data: {
        userId,
        name: data.name.trim(),
        slot: data.slot ?? 'ANY',
        notes: data.notes ?? null,
        ingredientsJson: data.ingredients as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: recipe.id };
  }

  async updateRecipe(userId: string, id: string, data: UpdateRecipeDTO) {
    await this.findRecipe(userId, id);
    await prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.slot !== undefined ? { slot: data.slot } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.ingredients !== undefined
            ? { ingredientsJson: data.ingredients as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
      // The menu shows the dish's name; keep the planned ones in step
      if (data.name !== undefined) {
        await tx.mealPlanEntry.updateMany({
          where: { userId, recipeId: id, status: 'PLANNED' },
          data: { title: data.name.trim() },
        });
      }
    });
  }

  async deleteRecipe(userId: string, id: string) {
    await this.findRecipe(userId, id);
    await prisma.recipe.delete({ where: { id } });
  }

  private async findRecipe(userId: string, id: string) {
    const recipe = await prisma.recipe.findFirst({ where: { id, userId } });
    if (!recipe) throw new AppError('Piatto non trovato', 404, 'NOT_FOUND');
    return recipe;
  }

  // ----------------------------------------------------------------
  // Menu
  // ----------------------------------------------------------------

  async createPlanEntry(userId: string, data: CreateMealPlanEntryDTO) {
    const recipe = data.recipeId ? await this.findRecipe(userId, data.recipeId) : null;
    const entry = await prisma.mealPlanEntry.create({
      data: {
        userId,
        date: dateOnly(data.date),
        slot: data.slot,
        recipeId: recipe?.id ?? null,
        title: data.title?.trim() || recipe?.name || 'Pasto',
      },
    });
    return { id: entry.id };
  }

  /**
   * Cooked takes the dish's ingredients out of the pantry; anything else puts
   * back exactly what cooking took, so a wrong tap costs nothing.
   */
  async updatePlanEntry(userId: string, id: string, data: UpdateMealPlanEntryDTO) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.mealPlanEntry.findFirst({ where: { id, userId }, include: { recipe: true } });
      if (!entry) throw new AppError('Pasto non trovato', 404, 'NOT_FOUND');

      const update: Prisma.MealPlanEntryUpdateInput = {};
      if (data.date !== undefined) update.date = dateOnly(data.date);
      if (data.slot !== undefined) update.slot = data.slot;
      if (data.title !== undefined) update.title = data.title.trim();

      let recipe: Recipe | null = entry.recipe;
      if (data.recipeId !== undefined) {
        recipe = data.recipeId ? await tx.recipe.findFirst({ where: { id: data.recipeId, userId } }) : null;
        if (data.recipeId && !recipe) throw new AppError('Piatto non trovato', 404, 'NOT_FOUND');
        update.recipe = recipe ? { connect: { id: recipe.id } } : { disconnect: true };
        if (recipe && data.title === undefined) update.title = recipe.name;
      }

      if (data.status !== undefined && data.status !== entry.status) {
        if (entry.status === 'COOKED') {
          await this.giveBackToPantry(tx, userId, parseConsumed(entry.consumedJson));
          update.consumedJson = Prisma.DbNull;
          update.cookedAt = null;
        }
        if (data.status === 'COOKED') {
          const pantry = await tx.pantryItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
          const portions = recipe
            ? portionsToConsume(pantry.map(toPlanningPantry), parseIngredients(recipe.ingredientsJson))
            : [];
          await this.takeFromPantry(tx, userId, portions);
          update.consumedJson = portions as unknown as Prisma.InputJsonValue;
          update.cookedAt = new Date();
        }
        update.status = data.status;
      }

      await tx.mealPlanEntry.update({ where: { id }, data: update });
    });
  }

  async deletePlanEntry(userId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.mealPlanEntry.findFirst({ where: { id, userId } });
      if (!entry) throw new AppError('Pasto non trovato', 404, 'NOT_FOUND');
      if (entry.status === 'COOKED') await this.giveBackToPantry(tx, userId, parseConsumed(entry.consumedJson));
      await tx.mealPlanEntry.delete({ where: { id } });
    });
  }

  /** Last week's menu, moved forward seven days, into the slots that are still empty */
  async copyPreviousPlan(userId: string, date: string) {
    const weekStart = kitchenWeekStart(date);
    const previousStart = addDaysIso(weekStart, -7);
    const [previous, current] = await Promise.all([
      prisma.mealPlanEntry.findMany({
        where: {
          userId,
          date: { gte: dateOnly(previousStart), lte: dateOnly(addDaysIso(previousStart, 6)) },
          status: { not: 'SKIPPED' },
        },
      }),
      prisma.mealPlanEntry.findMany({
        where: { userId, date: { gte: dateOnly(weekStart), lte: dateOnly(addDaysIso(weekStart, 6)) } },
      }),
    ]);
    const taken = new Set(current.map((entry) => `${toIsoDate(entry.date)}|${entry.slot}`));
    const copies = previous
      .map((entry: MealPlanEntry) => ({ ...entry, nextDate: addDaysIso(toIsoDate(entry.date), 7) }))
      .filter((entry) => !taken.has(`${entry.nextDate}|${entry.slot}`));
    if (copies.length > 0) {
      await prisma.mealPlanEntry.createMany({
        data: copies.map((entry) => ({
          userId,
          date: dateOnly(entry.nextDate),
          slot: entry.slot,
          recipeId: entry.recipeId,
          title: entry.title,
        })),
      });
    }
    return { added: copies.length };
  }
}

export const kitchenService = new KitchenService();
