import { prisma } from '../lib/prisma.js';
import {
  MEAL_TYPE_LABELS,
  MEAL_ITEM_UNIT_LABELS,
  QUICK_LOG_CATEGORY_LABELS,
  QUICK_LOG_VALENCE_LABELS,
} from '@budget/shared';
import type {
  MealTypeDTO,
  MealItemUnitDTO,
  QuickLogCategoryDTO,
  QuickLogValenceDTO,
} from '@budget/shared';
import { toLocalParts, addDays, foodDashboardService } from './food-dashboard.service.js';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';
import { mealUnitDefinitionService } from './meal-unit-definition.service.js';

// CSV format (designed to be fed to an external LLM for analysis).
// One row per record, all chronologically interleaved; record_type says what
// each row is, so food, body and mood can be correlated by date:
//   meal_item   - one food eaten (meal notes in `text`)
//   quick_log   - a body/physical note (category = allenamento/sonno/sensazione/integratore)
//   mood_log    - a MOOD note, the psychological track kept separate by design
//   day_summary - one per tracked day (time 00:00), carrying the two day scores
// body_state / mood_state are averages in [-1, +1] (positive/neutral/negative
// = +1/0/-1) and are INDEPENDENT: an empty one means "not tracked that day".
// linked_meal = "YYYY-MM-DD <tipo pasto>" of the meal a note was auto-linked to.

export const FOOD_CSV_HEADER =
  'record_type,date,time,category,valence,meal_type,food_name,quantity,unit,text,linked_meal,body_state,mood_state';

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
  category: QuickLogCategoryDTO | null;
  valence: QuickLogValenceDTO | null;
  linkedMeal: { date: string; mealType: MealTypeDTO; mealTypeName?: string } | null;
}

export interface CsvDaySummaryInput {
  date: string; // YYYY-MM-DD
  bodyState: number | null;
  moodState: number | null;
  mealCount: number;
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

function formatState(state: number | null): string {
  return state === null ? '' : String(state);
}

function hhmm(hour: number, minutes: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Pure CSV builder, unit-testable without a database */
export function buildFoodCsv(
  meals: CsvMealInput[],
  quickLogs: CsvQuickLogInput[],
  tzOffset: number,
  daySummaries: CsvDaySummaryInput[] = []
): string {
  const rows: { sortKey: string; line: string }[] = [];

  // A day_summary opens its day, so an LLM reads the outcome before the detail
  for (const day of daySummaries) {
    const line = [
      'day_summary',
      day.date,
      '00:00',
      '',
      '',
      '',
      '',
      '',
      '',
      escapeCsvField(`${day.mealCount} pasti registrati`),
      '',
      formatState(day.bodyState),
      formatState(day.moodState),
    ].join(',');
    rows.push({ sortKey: `${day.date} 00:00 0`, line });
  }

  for (const meal of meals) {
    const local = toLocalParts(meal.createdAt, tzOffset);
    // The meal's own date is authoritative for the day; insertion time fills the clock
    const time = hhmm(local.hour, local.minutes);
    for (const item of meal.items) {
      const line = [
        'meal_item',
        meal.date,
        time,
        '',
        '',
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
        '',
        '',
      ].join(',');
      rows.push({ sortKey: `${meal.date} ${time} 1`, line });
    }
  }

  for (const log of quickLogs) {
    const local = toLocalParts(log.loggedAt, tzOffset);
    const time = hhmm(local.hour, local.minutes);
    const linkedMeal = log.linkedMeal
      ? `${log.linkedMeal.date} ${
          log.linkedMeal.mealTypeName ??
          MEAL_TYPE_LABELS[log.linkedMeal.mealType as keyof typeof MEAL_TYPE_LABELS] ??
          log.linkedMeal.mealType
        }`
      : '';
    const line = [
      // Mood gets its own record_type: the psychological track stays separable
      log.category === 'MOOD' ? 'mood_log' : 'quick_log',
      local.date,
      time,
      log.category ? QUICK_LOG_CATEGORY_LABELS[log.category] : '',
      log.valence ? QUICK_LOG_VALENCE_LABELS[log.valence] : '',
      '',
      '',
      '',
      '',
      escapeCsvField(log.text),
      escapeCsvField(linkedMeal),
      '',
      '',
    ].join(',');
    rows.push({ sortKey: `${local.date} ${time} 1`, line });
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

    // Day summaries come from the dashboard service so the day-state formula
    // stays defined in exactly one place. Range = what the export covers.
    const daySummaries = await this.buildDaySummaries(userId, meals, quickLogs, from, to, tzOffset);

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
        category: log.derivedCategory,
        valence: log.derivedValence,
        linkedMeal: log.meal
          ? {
              date: log.meal.date.toISOString().slice(0, 10),
              mealType: log.meal.mealType,
              mealTypeName: names.get(log.meal.mealType),
            }
          : null,
      })),
      tzOffset,
      daySummaries
    );
  }

  /**
   * One summary row per tracked day of the exported range. The range is the
   * requested one, or the full span actually covered by the data.
   */
  private async buildDaySummaries(
    userId: string,
    meals: { date: Date }[],
    quickLogs: { loggedAt: Date }[],
    from: string | undefined,
    to: string | undefined,
    tzOffset: number
  ): Promise<CsvDaySummaryInput[]> {
    const dates: string[] = [
      ...meals.map((m) => m.date.toISOString().slice(0, 10)),
      ...quickLogs.map((l) => toLocalParts(l.loggedAt, tzOffset).date),
    ];
    if (dates.length === 0) return [];

    const rangeFrom = from ?? dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    const rangeTo = to ?? dates.reduce((max, d) => (d > max ? d : max), dates[0]);
    if (rangeFrom > rangeTo) return [];

    const overview = await foodDashboardService.getOverview(userId, rangeFrom, rangeTo, tzOffset);
    return overview.days
      // Skip untracked days: an empty row would just be noise for the LLM
      .filter((day) => day.hasMeals || day.dayState !== null || day.moodState !== null)
      .map((day) => ({
        date: day.date,
        bodyState: day.dayState,
        moodState: day.moodState,
        mealCount: day.mealCount,
      }));
  }
}

export const foodExportService = new FoodExportService();
