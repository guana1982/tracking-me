import { prisma } from '../lib/prisma.js';
import {
  MEAL_TYPE_LABELS,
  MEAL_ITEM_UNIT_LABELS,
  QUICK_LOG_CATEGORY_LABELS,
  QUICK_LOG_VALENCE_LABELS,
  INTAKE_STATUS_LABELS,
  TREATMENT_KIND_LABELS,
  MILESTONE_KIND_LABELS,
  HABIT_STATUS_LABELS,
  ACTIVITY_PRIORITY_LABELS,
  ACTIVITY_STATUS_LABELS,
  BEDTIME_SLOT,
  BEDTIME_SLOT_LABEL,
  describeScaleValue,
} from '@budget/shared';
import type {
  MealTypeDTO,
  MealItemUnitDTO,
  QuickLogCategoryDTO,
  QuickLogValenceDTO,
  CheckInValueDTO,
  IntakeStatusDTO,
} from '@budget/shared';
import { toLocalParts, addDays, foodDashboardService } from './food-dashboard.service.js';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';
import { mealUnitDefinitionService } from './meal-unit-definition.service.js';
import { buildFoodAiPackage } from './food-ai-export.js';

// CSV format (designed to be fed to an external LLM for analysis).
// One row per record, all chronologically interleaved; record_type says what
// each row is, so food, body, mood, intakes and check-in can be correlated
// by date:
//   meal_item   - one food eaten (meal notes in `text`)
//   quick_log   - a body/physical note (category = allenamento/sonno/sensazione/integratore)
//   mood_log    - a MOOD note, the psychological track kept separate by design
//   intake      - one dose taken/skipped (category = what, meal_type = when,
//                 intake_status = preso/non preso/preso in ritardo)
//   checkin     - one scale of the daily self-report (category = scale name,
//                 scale_value/scale_max = the answer, text = its wording);
//                 on these rows `valence` says which direction is good:
//                 "negativo" = it measures a symptom, so lower is better;
//                 "positivo" = higher is better
//   rating      - a vote given in the diary on a user-defined characteristic
//                 (category = its name, scale_value/scale_max = the vote,
//                 text = the note written next to it and, after " · ", the
//                 states picked in the row's popup). These are marks out of
//                 scale_max, so a higher value always reads as better. The
//                 same characteristic can be voted several times a day: each
//                 vote is its own row, at the minute it was given. Those
//                 popup states also appear as their own mood_log row at the
//                 same minute - one event seen from the two tracks, not two
//                 separate events
//   event       - an episode logged the moment it happened (category = its
//                 type, valence = the trigger that set it off, scale_value =
//                 its intensity when given, text = the note). The trigger is
//                 the field to count: its ranking is the point of the log
//   side_effect - a side effect of the therapy, logged the moment it shows up
//                 (category = its name, scale_value = its intensity out of
//                 scale_max, text = the note). Absence is never recorded: a
//                 row here means it happened
//   habit       - a habit answered for the day (category = its name,
//                 intake_status = fatto/non fatto, quantity+unit = how much
//                 when the habit is measured, text = the note)
//   weight      - a weekly weighing (quantity = kg)
//   treatment   - what is being taken (category = name, text = active
//                 ingredient and notes, quantity/unit = dose, meal_type =
//                 when); dated on the start day, or on the first exported day
//                 when it started earlier. This is state, not an event
//   dose_change - a planned dose change (category = treatment, text = new
//                 dose, intake_status = "applicata"/"programmata")
//   milestone   - an exam, an appointment or another date (category = kind,
//                 text = title, values and conditions to respect)
//   activity    - something planned for that day: a task or a deadline
//                 (category = its type, valence = priority, meal_type =
//                 giornata/settimana/scadenza, text = title and note,
//                 intake_status = da fare/in corso/completata). Dated on the
//                 day it was planned or due, so an open row on a past date is
//                 something that slipped. What was intended, next to what was
//                 eaten and felt, is half of why a day went the way it did
//   day_summary - one per tracked day (time 00:00), carrying the two day scores
// body_state / mood_state are averages in [-1, +1] (positive/neutral/negative
// = +1/0/-1) and are INDEPENDENT: an empty one means "not tracked that day".
// linked_meal = "YYYY-MM-DD <tipo pasto>" of the meal a note was auto-linked to.

export const FOOD_CSV_HEADER =
  'record_type,date,time,category,valence,meal_type,food_name,quantity,unit,text,linked_meal,body_state,mood_state,scale_value,scale_max,intake_status';

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

export interface CsvIntakeInput {
  date: string; // YYYY-MM-DD, the day the dose belongs to
  loggedAt: Date; // when it was ticked
  treatmentName: string;
  doseLabel: string | null;
  slotName: string; // resolved moment ("Colazione", "Prima di dormire")
  status: IntakeStatusDTO;
}

export interface CsvCheckInInput {
  date: string; // YYYY-MM-DD
  loggedAt: Date;
  values: CheckInValueDTO[];
  note: string | null;
}

export interface CsvRatingInput {
  date: string; // YYYY-MM-DD
  loggedAt: Date;
  ratingName: string;
  value: number | null;
  maxValue: number;
  note: string | null;
  /** Text of the entry picked in the row's popup, when the row has one */
  linkedText: string | null;
  /** `rating` (periodic mark), `event` (episode) or `side_effect` */
  recordType?: 'rating' | 'event' | 'side_effect';
  /** What set the episode off */
  trigger?: string | null;
}

export interface CsvWeightInput {
  date: string; // YYYY-MM-DD
  weightKg: number;
  note: string | null;
}

export interface CsvHabitInput {
  date: string; // YYYY-MM-DD
  loggedAt: Date;
  habitName: string;
  statusLabel: string;
  /** The count or the minutes, with its unit; null for a plain yes/no */
  value: number | null;
  unit: string;
  note: string | null;
}

export interface CsvTreatmentInput {
  date: string; // start date, or the first exported day
  name: string;
  kindLabel: string;
  dose: string | null;
  form: string | null;
  slotNames: string[];
  detail: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CsvDoseChangeInput {
  date: string;
  treatmentName: string;
  dose: string;
  applied: boolean;
}

export interface CsvMilestoneInput {
  date: string;
  kindLabel: string;
  title: string;
  items: string[];
  advisories: string[];
  notes: string | null;
  isDone: boolean;
}

export interface CsvActivityInput {
  date: string; // the day it is planned for, or the day it is due
  time: string; // HH:MM, "00:00" when no hour was set
  title: string;
  notes: string | null;
  typeName: string | null;
  scopeLabel: string; // Giornata / Settimana / Scadenza
  priorityLabel: string;
  statusLabel: string;
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
  daySummaries: CsvDaySummaryInput[] = [],
  intakes: CsvIntakeInput[] = [],
  checkIns: CsvCheckInInput[] = [],
  ratings: CsvRatingInput[] = [],
  weights: CsvWeightInput[] = [],
  treatments: CsvTreatmentInput[] = [],
  doseChanges: CsvDoseChangeInput[] = [],
  milestones: CsvMilestoneInput[] = [],
  habits: CsvHabitInput[] = [],
  activities: CsvActivityInput[] = []
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
      '',
      '',
      '',
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
      '',
      '',
      '',
    ].join(',');
    rows.push({ sortKey: `${local.date} ${time} 1`, line });
  }

  // Adherence: the moment lands in meal_type, so an intake and the meal it
  // belongs to share the same column and line up naturally
  for (const intake of intakes) {
    const local = toLocalParts(intake.loggedAt, tzOffset);
    const time = hhmm(local.hour, local.minutes);
    const line = [
      'intake',
      intake.date,
      time,
      escapeCsvField(intake.treatmentName),
      '',
      escapeCsvField(intake.slotName),
      '',
      '',
      '',
      escapeCsvField(intake.doseLabel ?? ''),
      '',
      '',
      '',
      '',
      '',
      INTAKE_STATUS_LABELS[intake.status],
    ].join(',');
    rows.push({ sortKey: `${intake.date} ${time} 1`, line });
  }

  // One row per scale: the set of scales is user-defined, so a wide layout
  // with one column each would break the moment someone adds one
  for (const checkIn of checkIns) {
    const local = toLocalParts(checkIn.loggedAt, tzOffset);
    const time = hhmm(local.hour, local.minutes);
    for (const value of checkIn.values) {
      const line = [
        'checkin',
        checkIn.date,
        time,
        escapeCsvField(value.name),
        value.isPositive ? 'positivo' : 'negativo',
        '',
        '',
        '',
        '',
        escapeCsvField(describeScaleValue(value.value, value.maxValue, value.isPositive)),
        '',
        '',
        '',
        String(value.value),
        String(value.maxValue),
        '',
      ].join(',');
      rows.push({ sortKey: `${checkIn.date} ${time} 1`, line });
    }
    if (checkIn.note) {
      const line = [
        'checkin',
        checkIn.date,
        time,
        'nota',
        '',
        '',
        '',
        '',
        '',
        escapeCsvField(checkIn.note),
        '',
        '',
        '',
        '',
        '',
        '',
      ].join(',');
      rows.push({ sortKey: `${checkIn.date} ${time} 2`, line });
    }
  }

  // Diary votes, at the minute they were given so they interleave with meals.
  // Every recorded vote produces a row - none is filtered out here
  for (const rating of ratings) {
    const local = toLocalParts(rating.loggedAt, tzOffset);
    const time = hhmm(local.hour, local.minutes);
    // The note and what the popup collected read as one recap, the same way
    // they are shown together in the diary
    const recap = [rating.note, rating.linkedText].filter((part) => Boolean(part)).join(' · ');
    const line = [
      // An episode, a side effect and a periodic mark answer different
      // questions, so they must be separable without reading the name
      rating.recordType ?? 'rating',
      rating.date,
      time,
      escapeCsvField(rating.ratingName),
      // The trigger rides in `valence` on event rows: it is the dimension
      // that qualifies the episode, and it stays one column to count
      escapeCsvField(rating.trigger ?? ''),
      '',
      '',
      '',
      '',
      escapeCsvField(recap),
      '',
      '',
      '',
      rating.value === null ? '' : String(rating.value),
      String(rating.maxValue),
      '',
    ].join(',');
    rows.push({ sortKey: `${rating.date} ${time} 1`, line });
  }

  // Weight sits at the top of its day: it is a measure of the day, not of a
  // moment, and the hour it was taken carries no information
  for (const weight of weights) {
    const line = [
      'weight',
      weight.date,
      '00:00',
      'peso',
      '',
      '',
      '',
      String(weight.weightKg),
      'kg',
      escapeCsvField(weight.note ?? ''),
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(',');
    rows.push({ sortKey: `${weight.date} 00:00 0`, line });
  }

  // Habits sit at the minute they were answered, like the intakes
  for (const habit of habits) {
    const local = toLocalParts(habit.loggedAt, tzOffset);
    const time = hhmm(local.hour, local.minutes);
    const line = [
      'habit',
      habit.date,
      time,
      escapeCsvField(habit.habitName),
      '',
      '',
      '',
      habit.value === null ? '' : String(habit.value),
      escapeCsvField(habit.unit),
      escapeCsvField(habit.note ?? ''),
      '',
      '',
      '',
      '',
      '',
      escapeCsvField(habit.statusLabel),
    ].join(',');
    rows.push({ sortKey: `${habit.date} ${time} 1`, line });
  }

  // The therapy itself: without it the rest of the file has no subject
  for (const treatment of treatments) {
    const line = [
      'treatment',
      treatment.date,
      '00:00',
      escapeCsvField(treatment.name),
      treatment.isActive ? 'attivo' : 'sospeso',
      escapeCsvField(treatment.slotNames.join(', ')),
      escapeCsvField(treatment.kindLabel),
      escapeCsvField(treatment.dose ?? ''),
      escapeCsvField(treatment.form ?? ''),
      escapeCsvField([treatment.detail, treatment.notes].filter(Boolean).join(' · ')),
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(',');
    // Sorted before the day summary: an LLM reads the therapy first
    rows.push({ sortKey: `${treatment.date} 00:00 -1`, line });
  }

  for (const change of doseChanges) {
    const line = [
      'dose_change',
      change.date,
      '00:00',
      escapeCsvField(change.treatmentName),
      '',
      '',
      '',
      '',
      '',
      escapeCsvField(change.dose),
      '',
      '',
      '',
      '',
      '',
      change.applied ? 'applicata' : 'programmata',
    ].join(',');
    rows.push({ sortKey: `${change.date} 00:00 0`, line });
  }

  for (const milestone of milestones) {
    // Values to check and conditions to respect belong on the same row: they
    // are what makes the appointment readable months later
    const detail = [
      milestone.title,
      milestone.items.length > 0 ? `valori: ${milestone.items.join(', ')}` : null,
      milestone.advisories.length > 0 ? `condizioni: ${milestone.advisories.join('; ')}` : null,
      milestone.notes,
    ]
      .filter(Boolean)
      .join(' · ');
    const line = [
      'milestone',
      milestone.date,
      '00:00',
      escapeCsvField(milestone.kindLabel),
      milestone.isDone ? 'fatto' : 'da fare',
      '',
      '',
      '',
      '',
      escapeCsvField(detail),
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(',');
    rows.push({ sortKey: `${milestone.date} 00:00 0`, line });
  }

  // What the day was supposed to contain. An open row on a past date is a
  // slipped task, and it reads as such without any extra column
  for (const activity of activities) {
    const detail = [activity.title, activity.notes].filter(Boolean).join(' · ');
    const line = [
      'activity',
      activity.date,
      activity.time,
      escapeCsvField(activity.typeName ?? ''),
      escapeCsvField(activity.priorityLabel),
      escapeCsvField(activity.scopeLabel),
      '',
      '',
      '',
      escapeCsvField(detail),
      '',
      '',
      '',
      '',
      '',
      escapeCsvField(activity.statusLabel),
    ].join(',');
    rows.push({ sortKey: `${activity.date} ${activity.time} 1`, line });
  }

  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  // BOM so Excel detects UTF-8
  return '\uFEFF' + [FOOD_CSV_HEADER, ...rows.map((r) => r.line)].join('\n') + '\n';
}

class FoodExportService {
  async exportAiPackage(
    userId: string,
    from?: string,
    to?: string,
    tzOffset = 0
  ): Promise<Uint8Array> {
    const csv = await this.exportCsv(userId, from, to, tzOffset);
    return buildFoodAiPackage(csv, { from, to, tzOffset });
  }

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

    // Intakes and check-in are stored on plain calendar days, so they need no
    // timezone shifting - only the clock in their row comes from loggedAt
    const dayFilter =
      from || to
        ? {
            date: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
            },
          }
        : {};

    // Activities live on `scheduledFor`, not on `date`, so they need their own
    // window - the deadline ones are already normalised onto their due day
    const activityFilter =
      from || to
        ? {
            scheduledFor: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
            },
          }
        : {};

    const [intakes, checkIns, ratings, weights, treatments, doseSteps, milestones, habits, activities] = await Promise.all([
      prisma.treatmentIntake.findMany({
        where: { userId, ...dayFilter },
        orderBy: { date: 'asc' },
      }),
      prisma.checkInEntry.findMany({
        where: { userId, ...dayFilter },
        orderBy: { date: 'asc' },
      }),
      prisma.ratingEntry.findMany({
        where: { userId, ...dayFilter },
        // The linked entry travels with the vote so the recap stays whole
        include: { quickLog: { select: { text: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.weightEntry.findMany({
        where: { userId, ...dayFilter },
        orderBy: { date: 'asc' },
      }),
      // The catalogue is state, not an event: taken whole, whatever the range
      prisma.treatmentDefinition.findMany({
        where: { userId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.titrationStep.findMany({
        where: { userId, ...dayFilter },
        include: { treatment: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.milestone.findMany({
        where: { userId, ...dayFilter },
        orderBy: { date: 'asc' },
      }),
      prisma.habitEntry.findMany({
        where: { userId, ...dayFilter },
        orderBy: { date: 'asc' },
      }),
      prisma.activity.findMany({
        where: { userId, ...activityFilter },
        include: { type: { select: { name: true } } },
        orderBy: { scheduledFor: 'asc' },
      }),
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
      daySummaries,
      intakes.map((intake) => ({
        date: intake.date.toISOString().slice(0, 10),
        loggedAt: intake.loggedAt,
        treatmentName: intake.treatmentName,
        doseLabel: intake.doseLabel,
        slotName:
          intake.slot === BEDTIME_SLOT
            ? BEDTIME_SLOT_LABEL
            : names.get(intake.slot) ?? intake.slot,
        status: intake.status,
      })),
      checkIns.map((entry) => ({
        date: entry.date.toISOString().slice(0, 10),
        loggedAt: entry.loggedAt,
        values: Array.isArray(entry.valuesJson)
          ? (entry.valuesJson as unknown as CheckInValueDTO[])
          : [],
        note: entry.note,
      })),
      ratings.map((entry) => ({
        date: entry.date.toISOString().slice(0, 10),
        loggedAt: entry.loggedAt,
        ratingName: entry.ratingName,
        value: entry.value,
        maxValue: entry.maxValue,
        note: entry.note,
        linkedText: entry.quickLog?.text ?? null,
        recordType:
          entry.kind === 'EVENT'
            ? ('event' as const)
            : entry.kind === 'SIDE_EFFECT'
              ? ('side_effect' as const)
              : ('rating' as const),
        trigger: entry.trigger,
      })),
      weights.map((entry) => ({
        date: entry.date.toISOString().slice(0, 10),
        weightKg: entry.weightKg,
        note: entry.note,
      })),
      treatments.map((treatment) => {
        const declared =
          treatment.startedOn?.toISOString().slice(0, 10) ??
          treatment.createdAt.toISOString().slice(0, 10);
        return {
          // A therapy that began before the window still has to be declared,
          // so it is dated at the first day the export covers
          date: from && declared < from ? from : declared,
          name: treatment.name,
          kindLabel: TREATMENT_KIND_LABELS[treatment.kind],
          dose: treatment.dose,
          form: treatment.form,
          slotNames: treatment.slots.map((slot) =>
            slot === BEDTIME_SLOT ? BEDTIME_SLOT_LABEL : names.get(slot) ?? slot
          ),
          detail: treatment.detail,
          notes: treatment.notes,
          isActive: treatment.isActive,
        };
      }),
      doseSteps.map((step) => ({
        date: step.date.toISOString().slice(0, 10),
        treatmentName: step.treatment.name,
        dose: step.dose,
        applied: step.applied,
      })),
      milestones.map((milestone) => ({
        date: milestone.date.toISOString().slice(0, 10),
        kindLabel: MILESTONE_KIND_LABELS[milestone.kind],
        title: milestone.title,
        items: milestone.items,
        advisories: milestone.advisories,
        notes: milestone.notes,
        isDone: milestone.isDone,
      })),
      habits.map((entry) => ({
        date: entry.date.toISOString().slice(0, 10),
        loggedAt: entry.loggedAt,
        habitName: entry.habitName,
        statusLabel: HABIT_STATUS_LABELS[entry.status],
        value: entry.value,
        unit: entry.unit,
        note: entry.note,
      })),
      activities.map((activity) => ({
        date: (activity.kind === 'DEADLINE' ? activity.dueDate ?? activity.scheduledFor : activity.scheduledFor)
          .toISOString()
          .slice(0, 10),
        time: activity.dueTime ?? '00:00',
        title: activity.title,
        notes: activity.notes,
        typeName: activity.type?.name ?? activity.typeName,
        scopeLabel:
          activity.kind === 'DEADLINE'
            ? 'Scadenza'
            : activity.scope === 'WEEK'
              ? 'Settimana'
              : 'Giornata',
        priorityLabel: ACTIVITY_PRIORITY_LABELS[activity.priority],
        statusLabel: ACTIVITY_STATUS_LABELS[activity.status],
      }))
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
