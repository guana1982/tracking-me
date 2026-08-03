import { prisma } from '../lib/prisma.js';
import { describeIntensity } from '@budget/shared';
import type {
  AdherenceDTO,
  CheckInValueDTO,
  DoseChangeMarkerDTO,
  SideEffectReportDTO,
  TherapyScaleSeriesDTO,
  TherapyTrendsDTO,
  TherapyWeekPointDTO,
  TriggerRankDTO,
} from '@budget/shared';
import { therapyPlanService } from './therapy-plan.service.js';

const TRIGGER_WINDOW_DAYS = 30;
const MONTHS = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Monday of the week a date falls in */
function weekStartOf(date: string): string {
  const d = dateOnly(date);
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(date, -weekday);
}

function weekLabel(weekStart: string): string {
  const start = dateOnly(weekStart);
  const end = dateOnly(addDays(weekStart, 6));
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];
  return startMonth === endMonth
    ? `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`
    : `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`;
}

function readValues(valuesJson: unknown): CheckInValueDTO[] {
  if (!Array.isArray(valuesJson)) return [];
  return (valuesJson as unknown[]).filter(
    (value): value is CheckInValueDTO =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as CheckInValueDTO).key === 'string' &&
      typeof (value as CheckInValueDTO).value === 'number'
  );
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * The weekly reading of everything the diary collects (§4.4).
 *
 * Weekly on purpose, never daily: the daily grain serves the collection, the
 * weekly one serves the reading. Nothing here produces a verdict, an arrow or
 * an automatic "insight" - every figure travels with the number of
 * observations behind it, and the caller decides what that is worth.
 */
class TherapyTrendsService {
  async getTrends(userId: string, from: string, to: string): Promise<TherapyTrendsDTO> {
    const start = weekStartOf(from);
    const [scales, entries, definitions, ratings, intakes, treatments, doseSteps, weight] =
      await Promise.all([
        prisma.checkInScale.findMany({
          where: { userId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.checkInEntry.findMany({
          where: { userId, date: { gte: dateOnly(start), lte: dateOnly(to) } },
          orderBy: { date: 'asc' },
        }),
        prisma.ratingDefinition.findMany({
          where: { userId, kind: 'EVENT' },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.ratingEntry.findMany({
          where: { userId, kind: 'EVENT', date: { gte: dateOnly(start), lte: dateOnly(to) } },
          orderBy: { date: 'asc' },
        }),
        prisma.treatmentIntake.findMany({
          where: { userId, date: { gte: dateOnly(from), lte: dateOnly(to) } },
        }),
        prisma.treatmentDefinition.findMany({ where: { userId } }),
        prisma.titrationStep.findMany({
          where: { userId, date: { gte: dateOnly(start), lte: dateOnly(to) } },
          include: { treatment: { select: { name: true } } },
          orderBy: { date: 'asc' },
        }),
        therapyPlanService.getWeightSummary(userId, to),
      ]);

    // ---------- Weekly curves ----------

    const weeks: TherapyWeekPointDTO[] = [];
    const todayWeek = weekStartOf(to);
    const sums = new Map<string, Map<string, { total: number; count: number }>>();
    const counts = new Map<string, number>();
    const eventCounts = new Map<string, Map<string, number>>();

    for (const entry of entries) {
      const week = weekStartOf(toIsoDate(entry.date));
      counts.set(week, (counts.get(week) ?? 0) + 1);
      const perScale = sums.get(week) ?? new Map();
      for (const value of readValues(entry.valuesJson)) {
        const acc = perScale.get(value.key) ?? { total: 0, count: 0 };
        acc.total += value.value;
        acc.count += 1;
        perScale.set(value.key, acc);
      }
      sums.set(week, perScale);
    }

    for (const rating of ratings) {
      const week = weekStartOf(toIsoDate(rating.date));
      const perEvent = eventCounts.get(week) ?? new Map<string, number>();
      perEvent.set(rating.ratingKey, (perEvent.get(rating.ratingKey) ?? 0) + 1);
      eventCounts.set(week, perEvent);
    }

    for (let week = start; week <= todayWeek; week = addDays(week, 7)) {
      const perScale = sums.get(week);
      const scaleMeans: Record<string, number | null> = {};
      for (const scale of scales) {
        const acc = perScale?.get(scale.key);
        scaleMeans[scale.key] = acc && acc.count > 0 ? round(acc.total / acc.count, 2) : null;
      }
      const perEvent = eventCounts.get(week);
      const events: Record<string, number> = {};
      for (const definition of definitions) {
        events[definition.key] = perEvent?.get(definition.key) ?? 0;
      }
      weeks.push({
        weekStart: week,
        label: weekLabel(week),
        // The running week is shown from day one - the curve has to start
        // somewhere - but it is flagged, because its mean is still forming
        isPartial: week === todayWeek,
        checkIns: counts.get(week) ?? 0,
        scales: scaleMeans,
        events,
      });
    }

    // ---------- Triggers ----------

    const triggerFrom = addDays(to, -(TRIGGER_WINDOW_DAYS - 1));
    const recentTriggers = await prisma.ratingEntry.findMany({
      where: {
        userId,
        trigger: { not: null },
        date: { gte: dateOnly(triggerFrom), lte: dateOnly(to) },
      },
      select: { trigger: true },
    });
    const triggerTally = new Map<string, number>();
    for (const row of recentTriggers) {
      if (!row.trigger) continue;
      triggerTally.set(row.trigger, (triggerTally.get(row.trigger) ?? 0) + 1);
    }
    const triggers: TriggerRankDTO[] = [...triggerTally.entries()]
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger));

    // ---------- Adherence ----------

    const days = Math.max(1, Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000) + 1);
    const adherence: AdherenceDTO[] = treatments
      .filter((treatment) => treatment.isActive)
      .map((treatment) => {
        const own = intakes.filter((intake) => intake.treatmentKey === treatment.key);
        const taken = own.filter((intake) => intake.status === 'TAKEN').length;
        const late = own.filter((intake) => intake.status === 'LATE').length;
        const skipped = own.filter((intake) => intake.status === 'SKIPPED').length;
        // Days counted from the start date, when it falls inside the period
        const startedOn = treatment.startedOn ? toIsoDate(treatment.startedOn) : null;
        const activeDays =
          startedOn && startedOn > from
            ? Math.max(0, Math.round((dateOnly(to).getTime() - dateOnly(startedOn).getTime()) / 86_400_000) + 1)
            : days;
        const expected = activeDays * treatment.slots.length;
        return {
          treatmentKey: treatment.key,
          name: treatment.name,
          taken,
          late,
          skipped,
          expected,
          recordedPct: expected > 0 ? round(((taken + late + skipped) / expected) * 100, 1) : 0,
          takenPct: expected > 0 ? round(((taken + late) / expected) * 100, 1) : 0,
        };
      });

    // ---------- Side effects ----------

    // Read from the chips in the diary: what matters is when one appeared and
    // how often it came back, not the shape of a nightly curve
    const [sideEffectDefinitions, sideEffectEntries] = await Promise.all([
      prisma.ratingDefinition.findMany({
        where: { userId, kind: 'SIDE_EFFECT' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.ratingEntry.findMany({
        where: {
          userId,
          kind: 'SIDE_EFFECT',
          date: { gte: dateOnly(start), lte: dateOnly(to) },
        },
        orderBy: { loggedAt: 'asc' },
      }),
    ]);

    const sideEffects: SideEffectReportDTO[] = sideEffectDefinitions.map((definition) => {
      const own = sideEffectEntries.filter((entry) => entry.ratingKey === definition.key);
      const days = new Set(own.map((entry) => toIsoDate(entry.date)));
      const last = own[own.length - 1];
      return {
        key: definition.key,
        name: definition.name,
        firstSeen: own.length > 0 ? toIsoDate(own[0].date) : null,
        daysPresent: days.size,
        lastLabel:
          last && last.value !== null ? describeIntensity(last.value, last.maxValue) : null,
      };
    });

    // ---------- Dose changes ----------

    const doseChanges: DoseChangeMarkerDTO[] = doseSteps.map((step) => ({
      date: toIsoDate(step.date),
      weekStart: weekStartOf(toIsoDate(step.date)),
      label: `${step.treatment.name} → ${step.dose}`,
    }));

    const series: TherapyScaleSeriesDTO[] = scales.map((scale) => ({
      key: scale.key,
      name: scale.name,
      maxValue: scale.maxValue,
      isPositive: scale.isPositive,
      // Legacy flag: side effects no longer live among the check-in scales
      isSideEffect: scale.isSideEffect,
    }));

    return {
      from,
      to,
      weeks,
      scales: series,
      events: definitions.map((definition) => ({ key: definition.key, name: definition.name })),
      triggers,
      triggerWindowDays: TRIGGER_WINDOW_DAYS,
      adherence,
      sideEffects,
      doseChanges,
      weight:
        weight.first && weight.last && weight.deltaKg !== null
          ? { first: weight.first, last: weight.last, deltaKg: weight.deltaKg }
          : null,
      totalCheckIns: entries.length,
    };
  }
}

export const therapyTrendsService = new TherapyTrendsService();
