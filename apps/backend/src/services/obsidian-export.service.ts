import {
  ACTIVITY_PRIORITY_LABELS,
  BEDTIME_SLOT,
  BEDTIME_SLOT_LABEL,
  MEAL_ITEM_UNIT_LABELS,
  MEAL_TYPE_LABELS,
  MILESTONE_KIND_LABELS,
  QUICK_LOG_CATEGORY_LABELS,
  TREATMENT_KIND_LABELS,
} from '@budget/shared';
import type { CheckInValueDTO } from '@budget/shared';
import { toLocalParts } from './food-dashboard.service.js';
import { foodExportService, type ExportSource } from './food-export.service.js';
import {
  buildObsidianVault,
  groupByDate,
  type ObsidianDay,
  type ObsidianDaySummary,
  type ObsidianRecord,
} from './obsidian-export.js';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The clock a record happened at, in the user's own timezone */
function localTime(instant: Date, tzOffset: number): { date: string; time: string } {
  const parts = toLocalParts(instant, tzOffset);
  return { date: parts.date, time: `${pad(parts.hour)}:${pad(parts.minutes % 60)}` };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function labelFor(map: Record<string, string>, key: string, names: Map<string, string>): string {
  return names.get(key) ?? map[key] ?? key;
}

/**
 * The database rows turned into the flat records the Markdown renderer reads.
 *
 * This is the whole of the Obsidian export's knowledge of the schema: one
 * function, one direction, no queries. Everything downstream of it is pure,
 * and everything upstream of it is the export the CSV already uses.
 */
export function normalizeRecords(source: ExportSource, tzOffset: number): ObsidianRecord[] {
  const records: ObsidianRecord[] = [];
  const { mealTypeNames, unitNames } = source;

  for (const meal of source.meals) {
    const mealTypeName = labelFor(MEAL_TYPE_LABELS, meal.mealType, mealTypeNames);
    records.push({
      recordType: 'meal',
      // The meal's own day is authoritative; insertion time only fills the clock
      date: isoDate(meal.date),
      time: localTime(meal.createdAt, tzOffset).time,
      summary: `${mealTypeName}: ${meal.items.map((item) => item.foodName).join(', ')}`,
      mealTypeName,
      notes: meal.notes,
      items: meal.items.map((item) => ({
        foodName: item.foodName,
        quantity: item.quantity,
        unitName: item.unit ? labelFor(MEAL_ITEM_UNIT_LABELS, item.unit, unitNames) : null,
      })),
    });
  }

  for (const log of source.quickLogs) {
    const { date, time } = localTime(log.loggedAt, tzOffset);
    if (log.derivedCategory === null) {
      // No category means nobody classified it: it is the free comment on the day
      records.push({ recordType: 'day_note', date, time, summary: log.text, text: log.text });
    } else if (log.derivedCategory === 'MOOD') {
      records.push({ recordType: 'mood_log', date, time, summary: log.text, text: log.text });
    } else {
      const categoryLabel = QUICK_LOG_CATEGORY_LABELS[log.derivedCategory] ?? null;
      records.push({
        recordType: 'quick_log',
        date,
        time,
        summary: `${categoryLabel ?? 'nota'}: ${log.text}`,
        categoryLabel,
        text: log.text,
      });
    }
  }

  for (const weight of source.weights) {
    records.push({
      recordType: 'weight',
      date: isoDate(weight.date),
      time: null,
      summary: `Peso ${weight.weightKg} kg`,
      weightKg: weight.weightKg,
      note: weight.note,
    });
  }

  for (const entry of source.ratings) {
    const date = isoDate(entry.date);
    const { time } = localTime(entry.loggedAt, tzOffset);
    const note = entry.note;
    if (entry.kind === 'EVENT') {
      records.push({
        recordType: 'event',
        date,
        time,
        summary: `Episodio: ${entry.ratingName}`,
        name: entry.ratingName,
        value: entry.value,
        maxValue: entry.maxValue,
        trigger: entry.trigger,
        note,
      });
    } else if (entry.kind === 'SIDE_EFFECT') {
      records.push({
        recordType: 'side_effect',
        date,
        time,
        summary: `Effetto: ${entry.ratingName}`,
        name: entry.ratingName,
        value: entry.value,
        maxValue: entry.maxValue,
        note,
      });
    } else {
      records.push({
        recordType: 'rating',
        date,
        time,
        summary: `${entry.ratingName}: ${entry.value ?? '—'}/${entry.maxValue}`,
        name: entry.ratingName,
        value: entry.value,
        maxValue: entry.maxValue,
        note,
        linkedText: entry.quickLog?.text ?? null,
      });
    }
  }

  for (const intake of source.intakes) {
    const slotName =
      intake.slot === BEDTIME_SLOT ? BEDTIME_SLOT_LABEL : mealTypeNames.get(intake.slot) ?? intake.slot;
    records.push({
      recordType: 'intake',
      date: isoDate(intake.date),
      time: localTime(intake.loggedAt, tzOffset).time,
      summary: `${intake.treatmentName} (${slotName})`,
      treatmentName: intake.treatmentName,
      doseLabel: intake.doseLabel,
      slotName,
      status: intake.status,
    });
  }

  for (const entry of source.checkIns) {
    const values = Array.isArray(entry.valuesJson)
      ? (entry.valuesJson as unknown as CheckInValueDTO[])
      : [];
    records.push({
      recordType: 'checkin',
      date: isoDate(entry.date),
      time: localTime(entry.loggedAt, tzOffset).time,
      summary: `Check-in: ${values.map((value) => `${value.name} ${value.value}`).join(', ')}`,
      values: values.map((value) => ({
        name: value.name,
        value: value.value,
        maxValue: value.maxValue,
        isPositive: value.isPositive,
      })),
      note: entry.note,
    });
  }

  for (const habit of source.habits) {
    records.push({
      recordType: 'habit',
      date: isoDate(habit.date),
      time: localTime(habit.loggedAt, tzOffset).time,
      summary: `${habit.habitName}: ${habit.status === 'DONE' ? 'fatto' : 'non fatto'}`,
      name: habit.habitName,
      done: habit.status === 'DONE',
      value: habit.value,
      unit: habit.unit,
      note: habit.note,
    });
  }

  for (const step of source.doseSteps) {
    records.push({
      recordType: 'dose_change',
      date: isoDate(step.date),
      time: null,
      summary: `${step.treatment.name} → ${step.dose}`,
      treatmentName: step.treatment.name,
      dose: step.dose,
      applied: step.applied,
    });
  }

  for (const milestone of source.milestones) {
    records.push({
      recordType: 'milestone',
      date: isoDate(milestone.date),
      time: null,
      summary: `${MILESTONE_KIND_LABELS[milestone.kind]}: ${milestone.title}`,
      kindLabel: MILESTONE_KIND_LABELS[milestone.kind],
      title: milestone.title,
      items: milestone.items,
      advisories: milestone.advisories,
      notes: milestone.notes,
      isDone: milestone.isDone,
    });
  }

  for (const activity of source.activities) {
    // A deadline belongs to the day it is due; a task to the day it is planned
    const date = isoDate(
      activity.kind === 'DEADLINE' ? activity.dueDate ?? activity.scheduledFor : activity.scheduledFor
    );
    records.push({
      recordType: 'activity',
      date,
      time: activity.dueTime,
      summary: activity.title,
      title: activity.title,
      notes: activity.notes,
      typeName: activity.type?.name ?? activity.typeName,
      scopeLabel:
        activity.kind === 'DEADLINE' ? 'Scadenza' : activity.scope === 'WEEK' ? 'Settimana' : 'Giornata',
      priorityLabel: ACTIVITY_PRIORITY_LABELS[activity.priority],
      status: activity.status,
    });
  }

  for (const attachment of source.attachments) {
    records.push({
      recordType: 'attachment',
      date: attachment.date,
      time: null,
      summary: `Referto: ${attachment.fileName}`,
      fileName: attachment.fileName,
      milestoneTitle: attachment.milestoneTitle,
      kindLabel: attachment.kindLabel,
    });
  }

  return records;
}

/** The therapy catalogue, dated the way the CSV dates it: state, not an event */
function normalizeTreatments(source: ExportSource, from?: string): ObsidianRecord[] {
  return source.treatments.map((treatment) => {
    const declared = isoDate(treatment.startedOn ?? treatment.createdAt);
    return {
      recordType: 'treatment' as const,
      date: from && declared < from ? from : declared,
      time: null,
      summary: `Terapia: ${treatment.name}`,
      name: treatment.name,
      kindLabel: TREATMENT_KIND_LABELS[treatment.kind],
      dose: treatment.dose,
      slotNames: treatment.slots.map((slot) =>
        slot === BEDTIME_SLOT ? BEDTIME_SLOT_LABEL : source.mealTypeNames.get(slot) ?? slot
      ),
      detail: treatment.detail,
      isActive: treatment.isActive,
    };
  });
}

class ObsidianExportService {
  /**
   * A vault of one Markdown note per day, built from the very rows the CSV
   * export reads. Nothing is stored for it and nothing is queried twice: the
   * only thing this adds to the app is a second way of writing the same days
   * down.
   */
  async exportVault(
    userId: string,
    from?: string,
    to?: string,
    tzOffset = 0
  ): Promise<Uint8Array> {
    const source = await foodExportService.collectForExport(userId, from, to, tzOffset);
    const records = [...normalizeRecords(source, tzOffset), ...normalizeTreatments(source, from)];

    const summaries = new Map<string, ObsidianDaySummary>(
      source.daySummaries.map((day) => [
        day.date,
        { bodyState: day.bodyState, moodState: day.moodState, mealCount: day.mealCount },
      ])
    );

    const days: ObsidianDay[] = groupByDate(records, summaries);
    return buildObsidianVault(days);
  }
}

export const obsidianExportService = new ObsidianExportService();
