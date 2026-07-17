import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { FOOD_CONFIG, extractSupplementNames, hasSupplementStopWord } from '@budget/shared';
import type {
  FoodOverviewDTO,
  FoodDayOverviewDTO,
  FoodComparisonDTO,
  FoodComparisonConditionDTO,
  FoodComparisonGroupDTO,
  FoodAssociationsDTO,
  FoodStatsDTO,
  SupplementPeriodDTO,
  QuickLogValenceDTO,
} from '@budget/shared';

// ---- "Stato del giorno" formula lives HERE, in one place ----
// dayState = simple average of the day's quick-log valences
// (positive = +1, neutral = 0, negative = -1). Days without logs = null.
// SLEEP logs are attributed to the day they influence: morning logs
// (before SLEEP_ATTRIBUTION_HOUR) describe last night -> same day;
// evening logs -> next day.

interface DayData {
  mealCount: number;
  dinnerAfter21: boolean;
  foods: Set<string>; // lowercased food names eaten that day
  stateScores: number[];
  workoutScores: number[];
  sleepScores: number[];
  feelingScores: number[];
}

function emptyDay(): DayData {
  return {
    mealCount: 0,
    dinnerAfter21: false,
    foods: new Set(),
    stateScores: [],
    workoutScores: [],
    sleepScores: [],
    feelingScores: [],
  };
}

/** Shift a UTC instant by tzOffset minutes and read local date/hour parts */
function toLocalParts(instant: Date, tzOffset: number): { date: string; hour: number; minutes: number } {
  const shifted = new Date(instant.getTime() + tzOffset * 60000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
}

/** Collapse a day's scores into a single valence (sum sign) */
function valenceFromScores(scores: number[]): QuickLogValenceDTO | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, v) => acc + v, 0);
  if (sum > 0) return 'POSITIVE';
  if (sum < 0) return 'NEGATIVE';
  return 'NEUTRAL';
}

function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

class FoodDashboardService {
  async getOverview(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    tzOffset: number
  ): Promise<FoodOverviewDTO> {
    const range = this.resolveRange(from, to, tzOffset);
    const dayMap = await this.buildDayMap(userId, range.from, range.to, tzOffset);
    const supplementPeriods = await this.buildSupplementPeriods(userId, tzOffset);

    const days: FoodDayOverviewDTO[] = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const day = dayMap.get(date) ?? emptyDay();
      days.push({
        date,
        mealCount: day.mealCount,
        hasMeals: day.mealCount > 0,
        dayState: average(day.stateScores),
        workoutPresent: day.workoutScores.length > 0,
        workoutValence: valenceFromScores(day.workoutScores),
        sleepValence: valenceFromScores(day.sleepScores),
        dinnerAfter21: day.dinnerAfter21,
      });
    }

    return {
      from: range.from,
      to: range.to,
      days,
      supplementPeriods: supplementPeriods.filter(
        (p) => (p.endDate ?? '9999-12-31') >= range.from && p.startDate <= range.to
      ),
      totalTrackedDays: days.filter((d) => d.hasMeals || d.dayState !== null).length,
    };
  }

  async getComparison(
    userId: string,
    condition: FoodComparisonConditionDTO,
    value: string | undefined,
    from: string | undefined,
    to: string | undefined,
    tzOffset: number
  ): Promise<FoodComparisonDTO> {
    const range = this.resolveRange(from, to, tzOffset, 90);
    const dayMap = await this.buildDayMap(userId, range.from, range.to, tzOffset);
    const normalizedValue = value?.trim().toLowerCase() ?? null;

    let inPeriod: ((date: string) => boolean) | null = null;
    if (condition === 'SUPPLEMENT_PERIOD') {
      if (!normalizedValue) {
        throw new AppError('Supplement name is required', 400, 'VALIDATION_ERROR');
      }
      const periods = (await this.buildSupplementPeriods(userId, tzOffset)).filter(
        (p) => p.name === normalizedValue
      );
      inPeriod = (date) =>
        periods.some((p) => date >= p.startDate && date <= (p.endDate ?? '9999-12-31'));
    }

    const matches = (date: string, day: DayData): boolean => {
      switch (condition) {
        case 'WORKOUT':
          return day.workoutScores.length > 0;
        case 'DINNER_AFTER_21':
          return day.dinnerAfter21;
        case 'FOOD':
          return normalizedValue !== null && day.foods.has(normalizedValue);
        case 'SUPPLEMENT_PERIOD':
          return inPeriod !== null && inPeriod(date);
      }
    };

    // Universe: only days the user actually tracked (meals or logs)
    const withDays: DayData[] = [];
    const withoutDays: DayData[] = [];
    for (const [date, day] of dayMap) {
      if (day.mealCount === 0 && day.stateScores.length === 0) continue;
      (matches(date, day) ? withDays : withoutDays).push(day);
    }

    const labels = this.comparisonLabels(condition, value ?? null);
    const withGroup = this.buildGroup(labels.with, withDays);
    const withoutGroup = this.buildGroup(labels.without, withoutDays);

    return {
      condition,
      conditionValue: value ?? null,
      withGroup,
      withoutGroup,
      minReliableDays: FOOD_CONFIG.MIN_RELIABLE_GROUP_DAYS,
      lowReliability:
        withGroup.days < FOOD_CONFIG.MIN_RELIABLE_GROUP_DAYS ||
        withoutGroup.days < FOOD_CONFIG.MIN_RELIABLE_GROUP_DAYS,
    };
  }

  /** Foods most frequent in meals preceding positive/negative feelings */
  async getAssociations(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    tzOffset: number
  ): Promise<FoodAssociationsDTO> {
    const range = this.resolveRange(from, to, tzOffset, 90);
    const logs = await prisma.quickLog.findMany({
      where: {
        userId,
        derivedCategory: 'FEELING',
        derivedValence: { in: ['POSITIVE', 'NEGATIVE'] },
        mealId: { not: null },
        loggedAt: {
          gte: new Date(new Date(range.from).getTime() - tzOffset * 60000),
          lt: new Date(new Date(addDays(range.to, 1)).getTime() - tzOffset * 60000),
        },
      },
      include: { meal: { include: { items: true } } },
    });

    const positive = new Map<string, number>();
    const negative = new Map<string, number>();
    for (const log of logs) {
      if (!log.meal) continue;
      const target = log.derivedValence === 'POSITIVE' ? positive : negative;
      for (const item of log.meal.items) {
        const key = item.foodName.trim().toLowerCase();
        target.set(key, (target.get(key) ?? 0) + 1);
      }
    }

    const toRanking = (map: Map<string, number>) =>
      [...map.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([foodName, count]) => ({ foodName, count }));

    return {
      positive: toRanking(positive),
      negative: toRanking(negative),
      linkedFeelingLogs: logs.length,
    };
  }

  async getStats(
    userId: string,
    from: string | undefined,
    to: string | undefined,
    tzOffset: number
  ): Promise<FoodStatsDTO> {
    const range = this.resolveRange(from, to, tzOffset, 30);
    const dayMap = await this.buildDayMap(userId, range.from, range.to, tzOffset);

    const meals = await prisma.meal.findMany({
      where: { userId, date: { gte: new Date(range.from), lte: new Date(range.to) } },
      include: { items: true },
    });

    const lunchMinutes: number[] = [];
    const dinnerMinutes: number[] = [];
    const foodCounts = new Map<string, number>();
    for (const meal of meals) {
      const localMinutes = toLocalParts(meal.createdAt, tzOffset).minutes;
      if (meal.mealType === 'LUNCH') lunchMinutes.push(localMinutes);
      if (meal.mealType === 'DINNER') dinnerMinutes.push(localMinutes);
      for (const item of meal.items) {
        const key = item.foodName.trim().toLowerCase();
        foodCounts.set(key, (foodCounts.get(key) ?? 0) + 1);
      }
    }

    const mealsPerDay: { date: string; count: number }[] = [];
    let daysWithMeals = 0;
    let workoutCount = 0;
    let sleepPositive = 0;
    let sleepNegative = 0;
    let feelingPositive = 0;
    let feelingNegative = 0;
    const dayStates: number[] = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const day = dayMap.get(date) ?? emptyDay();
      mealsPerDay.push({ date, count: day.mealCount });
      if (day.mealCount > 0) daysWithMeals += 1;
      if (day.workoutScores.length > 0) workoutCount += 1;
      const sleep = valenceFromScores(day.sleepScores);
      if (sleep === 'POSITIVE') sleepPositive += 1;
      if (sleep === 'NEGATIVE') sleepNegative += 1;
      feelingPositive += day.feelingScores.filter((s) => s > 0).length;
      feelingNegative += day.feelingScores.filter((s) => s < 0).length;
      const state = average(day.stateScores);
      if (state !== null) dayStates.push(state);
    }

    const avgLunch = average(lunchMinutes);
    const avgDinner = average(dinnerMinutes);

    return {
      from: range.from,
      to: range.to,
      totalDays: daysBetween(range.from, range.to),
      daysWithMeals,
      mealsPerDay,
      avgLunchTime: avgLunch !== null ? minutesToHHmm(avgLunch) : null,
      avgDinnerTime: avgDinner !== null ? minutesToHHmm(avgDinner) : null,
      workoutCount,
      sleepPositive,
      sleepNegative,
      feelingPositive,
      feelingNegative,
      avgDayState: average(dayStates),
      topFoods: [...foodCounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([foodName, count]) => ({ foodName, count })),
    };
  }

  // ---------- shared building blocks ----------

  private resolveRange(
    from: string | undefined,
    to: string | undefined,
    tzOffset: number,
    defaultDays = 30
  ): { from: string; to: string } {
    const today = toLocalParts(new Date(), tzOffset).date;
    const resolvedTo = to ?? today;
    const resolvedFrom = from ?? addDays(resolvedTo, -(defaultDays - 1));
    if (resolvedFrom > resolvedTo) {
      throw new AppError('Invalid date range', 400, 'VALIDATION_ERROR');
    }
    return { from: resolvedFrom, to: resolvedTo };
  }

  private async buildDayMap(
    userId: string,
    from: string,
    to: string,
    tzOffset: number
  ): Promise<Map<string, DayData>> {
    const dayMap = new Map<string, DayData>();
    const getDay = (date: string): DayData => {
      let day = dayMap.get(date);
      if (!day) {
        day = emptyDay();
        dayMap.set(date, day);
      }
      return day;
    };

    const meals = await prisma.meal.findMany({
      where: { userId, date: { gte: new Date(from), lte: new Date(to) } },
      include: { items: true },
    });
    for (const meal of meals) {
      const date = meal.date.toISOString().slice(0, 10);
      const day = getDay(date);
      day.mealCount += 1;
      for (const item of meal.items) {
        day.foods.add(item.foodName.trim().toLowerCase());
      }
      if (
        meal.mealType === 'DINNER' &&
        toLocalParts(meal.createdAt, tzOffset).hour >= FOOD_CONFIG.LATE_DINNER_HOUR
      ) {
        day.dinnerAfter21 = true;
      }
    }

    // Fetch logs with margin: sleep attribution and timezone shifts can move
    // a log across the range boundary by up to one day
    const logs = await prisma.quickLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: new Date(new Date(from).getTime() - 2 * 86400000),
          lt: new Date(new Date(to).getTime() + 2 * 86400000),
        },
      },
    });
    for (const log of logs) {
      if (!log.derivedValence) continue;
      const local = toLocalParts(log.loggedAt, tzOffset);
      // Evening sleep notes ("a letto presto") influence tomorrow
      const attributedDate =
        log.derivedCategory === 'SLEEP' && local.hour >= FOOD_CONFIG.SLEEP_ATTRIBUTION_HOUR
          ? addDays(local.date, 1)
          : local.date;
      if (attributedDate < from || attributedDate > to) continue;

      const day = getDay(attributedDate);
      const score = FOOD_CONFIG.VALENCE_SCORES[log.derivedValence];
      day.stateScores.push(score);
      if (log.derivedCategory === 'WORKOUT') day.workoutScores.push(score);
      if (log.derivedCategory === 'SLEEP') day.sleepScores.push(score);
      if (log.derivedCategory === 'FEELING') day.feelingScores.push(score);
    }

    return dayMap;
  }

  /**
   * Supplement periods from the FULL history: a SUPPLEMENT log naming a
   * supplement opens a period; a later one with the same name plus a stop
   * word (smesso/finito/stop...) closes it; no closure = still running.
   */
  private async buildSupplementPeriods(
    userId: string,
    tzOffset: number
  ): Promise<SupplementPeriodDTO[]> {
    const logs = await prisma.quickLog.findMany({
      where: { userId, derivedCategory: 'SUPPLEMENT' },
      orderBy: { loggedAt: 'asc' },
      select: { text: true, loggedAt: true },
    });

    const periods: SupplementPeriodDTO[] = [];
    const open = new Map<string, SupplementPeriodDTO>();
    for (const log of logs) {
      const names = extractSupplementNames(log.text);
      if (names.length === 0) continue;
      const date = toLocalParts(log.loggedAt, tzOffset).date;
      const closing = hasSupplementStopWord(log.text);
      for (const name of names) {
        const running = open.get(name);
        if (closing) {
          if (running) {
            running.endDate = date;
            open.delete(name);
          }
        } else if (!running) {
          const period: SupplementPeriodDTO = { name, startDate: date, endDate: null };
          periods.push(period);
          open.set(name, period);
        }
      }
    }
    return periods;
  }

  private buildGroup(label: string, days: DayData[]): FoodComparisonGroupDTO {
    const states: number[] = [];
    const sleepAvgs: number[] = [];
    const feelingAvgs: number[] = [];
    for (const day of days) {
      const state = average(day.stateScores);
      if (state !== null) states.push(state);
      const sleep = average(day.sleepScores);
      if (sleep !== null) sleepAvgs.push(sleep);
      const feeling = average(day.feelingScores);
      if (feeling !== null) feelingAvgs.push(feeling);
    }
    return {
      label,
      days: days.length,
      avgState: average(states),
      avgSleepValence: average(sleepAvgs),
      avgFeelingValence: average(feelingAvgs),
    };
  }

  // Labels are user-facing (the app is Italian-only). Wording is careful:
  // "nei giorni con", never "causa/effetto"
  private comparisonLabels(
    condition: FoodComparisonConditionDTO,
    value: string | null
  ): { with: string; without: string } {
    switch (condition) {
      case 'WORKOUT':
        return { with: 'Giorni con allenamento', without: 'Giorni senza allenamento' };
      case 'DINNER_AFTER_21':
        return { with: 'Giorni con cena dopo le 21', without: 'Giorni con cena entro le 21' };
      case 'FOOD':
        return {
          with: `Giorni con "${value ?? ''}"`,
          without: `Giorni senza "${value ?? ''}"`,
        };
      case 'SUPPLEMENT_PERIOD':
        return {
          with: `Giorni nel periodo "${value ?? ''}"`,
          without: `Giorni fuori dal periodo "${value ?? ''}"`,
        };
    }
  }
}

// Re-export for the CSV export service and unit tests
export { toLocalParts, addDays, average, valenceFromScores };
export const foodDashboardService = new FoodDashboardService();
