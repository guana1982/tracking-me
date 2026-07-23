import { prisma } from '../lib/prisma.js';
import { MEAL_TYPE_LABELS, MEAL_ITEM_UNIT_LABELS } from '@budget/shared';
import type { MealTypeDTO, MealItemUnitDTO } from '@budget/shared';
import { toLocalParts, addDays } from './food-dashboard.service.js';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';
import { mealUnitDefinitionService } from './meal-unit-definition.service.js';

// CSV format (designed to be fed to an external LLM for analysis):
// one row per meal_item, quick logs interleaved chronologically and
// distinguished by record_type. Meal notes go in the shared `text` column
// (same free-text semantics as quick logs; record_type disambiguates).
// linked_meal = "YYYY-MM-DD <tipo pasto>" of the auto-linked meal.

export const FOOD_CSV_HEADER =
  'record_type,datetime,meal_type,food_name,quantity,unit,text,linked_meal';

export interface CsvMealInput {
  date: string; // YYYY-MM-DD
  mealType: MealTypeDTO;
  mealTypeName?: string;
  notes: string | null;
  createdAt: Date; // time proxy for the meal
  items: {
    foodName: string;
    quantity: number | null;
    unit: MealItemUnitDTO | null;
    unitName?: string;
  }[];
}

export interface CsvQuickLogInput {
  loggedAt: Date;
  text: string;
  linkedMeal: { date: string; mealType: MealTypeDTO; mealTypeName?: string } | null;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatQuantity(quantity: number | null): string {
  return quantity === null ? '' : String(quantity);
}

/** Pure CSV builder, unit-testable without a database */
export function buildFoodCsv(
  meals: CsvMealInput[],
  quickLogs: CsvQuickLogInput[],
  tzOffset: number
): string {
  const rows: { sortKey: string; line: string }[] = [];

  for (const meal of meals) {
    const local = toLocalParts(meal.createdAt, tzOffset);
    // The meal's own date is authoritative for the day; insertion time fills the clock
    const datetime = `${meal.date} ${String(local.hour).padStart(2, '0')}:${String(
      local.minutes % 60
    ).padStart(2, '0')}`;
    for (const item of meal.items) {
      const line = [
        'meal_item',
        datetime,
        meal.mealTypeName ?? MEAL_TYPE_LABELS[meal.mealType as keyof typeof MEAL_TYPE_LABELS] ?? meal.mealType,
        escapeCsvField(item.foodName),
        formatQuantity(item.quantity),
        item.unit
          ? item.unitName ??
            MEAL_ITEM_UNIT_LABELS[item.unit as keyof typeof MEAL_ITEM_UNIT_LABELS] ??
            item.unit
          : '',
        escapeCsvField(meal.notes ?? ''),
        '',
      ].join(',');
      rows.push({ sortKey: datetime, line });
    }
  }

  for (const log of quickLogs) {
    const local = toLocalParts(log.loggedAt, tzOffset);
    const datetime = `${local.date} ${String(local.hour).padStart(2, '0')}:${String(
      local.minutes % 60
    ).padStart(2, '0')}`;
    const linkedMeal = log.linkedMeal
      ? `${log.linkedMeal.date} ${
          log.linkedMeal.mealTypeName ??
          MEAL_TYPE_LABELS[log.linkedMeal.mealType as keyof typeof MEAL_TYPE_LABELS] ??
          log.linkedMeal.mealType
        }`
      : '';
    const line = [
      'quick_log',
      datetime,
      '',
      '',
      '',
      '',
      escapeCsvField(log.text),
      escapeCsvField(linkedMeal),
    ].join(',');
    rows.push({ sortKey: datetime, line });
  }

  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  // BOM so Excel detects UTF-8
  return '\uFEFF' + [FOOD_CSV_HEADER, ...rows.map((r) => r.line)].join('\n') + '\n';
}

class FoodExportService {
  /** Full history by default; optional date range filter */
  async exportCsv(userId: string, from?: string, to?: string, tzOffset = 0): Promise<string> {
    const meals = await prisma.meal.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { date: 'asc' },
    });

    const quickLogs = await prisma.quickLog.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              loggedAt: {
                ...(from ? { gte: new Date(new Date(from).getTime() - tzOffset * 60000) } : {}),
                ...(to
                  ? { lt: new Date(new Date(addDays(to, 1)).getTime() - tzOffset * 60000) }
                  : {}),
              },
            }
          : {}),
      },
      include: { meal: { select: { date: true, mealType: true } } },
      orderBy: { loggedAt: 'asc' },
    });
    const [names, unitNames] = await Promise.all([
      mealTypeDefinitionService.nameMap(userId),
      mealUnitDefinitionService.nameMap(userId),
    ]);

    return buildFoodCsv(
      meals.map((meal) => ({
        date: meal.date.toISOString().slice(0, 10),
        mealType: meal.mealType,
        mealTypeName: names.get(meal.mealType),
        notes: meal.notes,
        createdAt: meal.createdAt,
        items: meal.items.map((item) => ({
          foodName: item.foodName,
          quantity: item.quantity,
          unit: item.unit,
          unitName: item.unit ? unitNames.get(item.unit) : undefined,
        })),
      })),
      quickLogs.map((log) => ({
        loggedAt: log.loggedAt,
        text: log.text,
        linkedMeal: log.meal
          ? {
              date: log.meal.date.toISOString().slice(0, 10),
              mealType: log.meal.mealType,
              mealTypeName: names.get(log.meal.mealType),
            }
          : null,
      })),
      tzOffset
    );
  }
}

export const foodExportService = new FoodExportService();
