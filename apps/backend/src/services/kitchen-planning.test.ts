import { describe, expect, it } from 'vitest';
import { createMealPlanEntrySchema, guessKitchenCategory, kitchenNameKey, parseKitchenLine } from '@budget/shared';
import {
  kitchenWeekStart,
  planWeek,
  portionsToConsume,
  type PlanningEntry,
  type PlanningPantryItem,
  type PlanningRecipe,
} from './kitchen-planning.js';

const carbonara: PlanningRecipe = {
  id: 'carbonara',
  name: 'Carbonara',
  slot: 'ANY',
  ingredients: [
    { name: 'Spaghetti', quantity: 400, unit: 'g' },
    { name: 'Uova', quantity: 4, unit: 'pz' },
    { name: 'Guanciale', quantity: 150, unit: 'g' },
    { name: 'Pepe', quantity: null, unit: 'pz' },
  ],
};

const frittata: PlanningRecipe = {
  id: 'frittata',
  name: 'Frittata',
  slot: 'DINNER',
  ingredients: [
    { name: 'uova', quantity: 6, unit: 'pz' },
    { name: 'Zucchine', quantity: 0.5, unit: 'kg' },
  ],
};

function pantry(items: Array<Partial<PlanningPantryItem> & Pick<PlanningPantryItem, 'name' | 'quantity' | 'unit'>>) {
  return items.map((item, index) => ({ id: `p${index}`, category: 'OTHER' as const, ...item }));
}

function entry(overrides: Partial<PlanningEntry> & Pick<PlanningEntry, 'id' | 'date'>): PlanningEntry {
  return { slot: 'DINNER', recipeId: null, status: 'PLANNED', createdAt: '2026-10-01T00:00:00.000Z', ...overrides };
}

describe('kitchen planning', () => {
  const basePantry = pantry([
    { name: 'Spaghetti', quantity: 1, unit: 'kg' },
    { name: 'Uova', quantity: 6, unit: 'pz' },
    { name: 'Guanciale', quantity: 300, unit: 'g' },
    { name: 'Pepe', quantity: 1, unit: 'conf' },
    { name: 'Zucchine', quantity: 1, unit: 'kg' },
  ]);

  it('walks the menu in order so two dishes cannot use the same eggs', () => {
    const result = planWeek({
      today: '2026-10-27',
      pantry: basePantry,
      pendingShopping: [],
      recipes: [carbonara, frittata],
      entries: [
        entry({ id: 'b', date: '2026-10-29', recipeId: 'frittata' }),
        entry({ id: 'a', date: '2026-10-28', recipeId: 'carbonara', slot: 'LUNCH' }),
      ],
    });

    expect(result.entries.get('a')).toEqual({ availability: 'READY', missing: [] });
    expect(result.entries.get('b')?.availability).toBe('MISSING');
    expect(result.entries.get('b')?.missing).toEqual([
      { name: 'uova', quantity: 4, unit: 'pz', category: 'DAIRY' },
    ]);
    expect(result.shortFrom).toBe('2026-10-29');
    expect(result.toBuy).toEqual([{ name: 'uova', quantity: 4, unit: 'pz', category: 'DAIRY' }]);
    // 4 eggs for the carbonara and the last 2 for the frittata
    expect(result.reserved.get('p1')).toBe(6);
    // 400 g out of 1 kg, kept in grams
    expect(result.reserved.get('p0')).toBe(400);
  });

  it('counts what is on the shopping list and only asks for the rest', () => {
    const result = planWeek({
      today: '2026-10-27',
      pantry: basePantry,
      pendingShopping: [{ name: 'Uova', quantity: 6, unit: 'pz' }],
      recipes: [carbonara, frittata],
      entries: [
        entry({ id: 'a', date: '2026-10-28', recipeId: 'carbonara' }),
        entry({ id: 'b', date: '2026-10-29', recipeId: 'frittata' }),
      ],
    });
    expect(result.entries.get('b')?.availability).toBe('ON_LIST');
    expect(result.shortFrom).toBe('2026-10-29');
    expect(result.shortFromAfterShopping).toBeNull();
    expect(result.toBuy).toEqual([]);
  });

  it('treats a quantity-less ingredient as "is there any" and converts units', () => {
    const result = planWeek({
      today: '2026-10-27',
      pantry: pantry([
        { name: 'Spaghetti', quantity: 300, unit: 'g' },
        { name: 'Uova', quantity: 4, unit: 'pz' },
        { name: 'Guanciale', quantity: 0.2, unit: 'kg' },
      ]),
      pendingShopping: [],
      recipes: [carbonara],
      entries: [entry({ id: 'a', date: '2026-10-27', recipeId: 'carbonara' })],
    });
    expect(result.entries.get('a')?.missing).toEqual([
      { name: 'Spaghetti', quantity: 100, unit: 'g', category: 'BAKERY' },
      { name: 'Pepe', quantity: null, unit: 'pz', category: 'PANTRY' },
    ]);
  });

  it('leaves past, cooked and free meals out of the count', () => {
    const result = planWeek({
      today: '2026-10-28',
      pantry: [],
      pendingShopping: [],
      recipes: [carbonara],
      entries: [
        entry({ id: 'past', date: '2026-10-27', recipeId: 'carbonara' }),
        entry({ id: 'cooked', date: '2026-10-28', recipeId: 'carbonara', status: 'COOKED' }),
        entry({ id: 'free', date: '2026-10-29' }),
      ],
    });
    expect(result.entries.get('past')?.availability).toBe('PAST');
    expect(result.entries.get('cooked')?.availability).toBe('DONE');
    expect(result.entries.get('free')?.availability).toBe('FREE');
    expect(result.shortFrom).toBeNull();
  });

  it('suggests dishes that fit what is left after the menu', () => {
    const result = planWeek({
      today: '2026-10-27',
      pantry: basePantry,
      pendingShopping: [],
      recipes: [carbonara, frittata],
      entries: [],
    });
    expect(result.ideas.map((idea) => [idea.recipeId, idea.missing.length])).toEqual([
      ['carbonara', 0],
      ['frittata', 0],
    ]);
  });

  it('takes cooked ingredients from the matching pantry rows, never below zero', () => {
    const portions = portionsToConsume(
      pantry([
        { name: 'Spaghetti', quantity: 0.25, unit: 'kg' },
        { name: 'spaghetti', quantity: 500, unit: 'g' },
        { name: 'Uova', quantity: 2, unit: 'pz' },
      ]),
      carbonara.ingredients
    );
    expect(portions).toEqual([
      { pantryItemId: 'p0', quantity: 0.25 },
      { pantryItemId: 'p1', quantity: 150 },
      { pantryItemId: 'p2', quantity: 2 },
    ]);
  });

  it('weeks start on Monday', () => {
    expect(kitchenWeekStart('2026-10-27')).toBe('2026-10-26');
    expect(kitchenWeekStart('2026-11-01')).toBe('2026-10-26');
    expect(kitchenWeekStart('2026-11-02')).toBe('2026-11-02');
  });
});

describe('kitchen quick entry', () => {
  it('reads a line typed in a hurry', () => {
    expect(parseKitchenLine('latte 2 l')).toMatchObject({ name: 'latte', quantity: 2, unit: 'l' });
    expect(parseKitchenLine('latte 1,5l')).toMatchObject({ name: 'latte', quantity: 1.5, unit: 'l' });
    expect(parseKitchenLine('2 kg patate')).toMatchObject({ name: 'patate', quantity: 2, unit: 'kg' });
    expect(parseKitchenLine('uova 6')).toMatchObject({ name: 'uova', quantity: 6, unit: 'pz' });
    expect(parseKitchenLine('6 uova')).toMatchObject({ name: 'uova', quantity: 6, unit: 'pz' });
    expect(parseKitchenLine('3 pomodori ramati')).toMatchObject({ name: 'pomodori ramati', quantity: 3, unit: 'pz' });
    expect(parseKitchenLine('pasta 500 g')).toMatchObject({ name: 'pasta', quantity: 500, unit: 'g' });
    expect(parseKitchenLine('  pane  ')).toMatchObject({ name: 'pane', quantity: null, unit: 'pz' });
    expect(parseKitchenLine('   ')).toBeNull();
    expect(parseKitchenLine('latte 2')?.hasUnit).toBe(false);
    expect(parseKitchenLine('latte 2 l')?.hasUnit).toBe(true);
  });

  it('files things under the right aisle and matches spellings', () => {
    expect(guessKitchenCategory('Zucchine')).toBe('PRODUCE');
    expect(guessKitchenCategory('Petto di pollo')).toBe('MEAT_FISH');
    expect(guessKitchenCategory('Mozzarella')).toBe('DAIRY');
    expect(guessKitchenCategory('Detersivo piatti')).toBe('HOUSEHOLD');
    expect(guessKitchenCategory('Qualcosa di strano')).toBe('OTHER');
    expect(kitchenNameKey('  Caffè  Lungo ')).toBe('caffe lungo');
  });

  it('needs a dish or a description to put a meal on the menu', () => {
    expect(() => createMealPlanEntrySchema.parse({ date: '2026-10-27', slot: 'LUNCH' })).toThrow();
    expect(createMealPlanEntrySchema.parse({ date: '2026-10-27', slot: 'LUNCH', title: 'Pizza fuori' }).title).toBe(
      'Pizza fuori'
    );
  });
});
