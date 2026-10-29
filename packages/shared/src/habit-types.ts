import type { DayTrackDTO } from './rating-types';

// ============================================================
// Habits - DTOs
//
// Same shape as the intakes: a catalogue the user owns, and one answer per
// day per entry. What changes is that nothing here is a dose - a habit is
// something you either did or did not do, and the user decides whether that
// is measured as a yes/no, a count, or an amount of time.
// ============================================================

/** How a habit is answered. The unit and the wording follow from this */
export const HABIT_MEASURES = ['DONE', 'COUNT', 'DURATION'] as const;
export type HabitMeasureDTO = (typeof HABIT_MEASURES)[number];

export const HABIT_MEASURE_LABELS: Record<HabitMeasureDTO, string> = {
  DONE: 'Fatto o no',
  COUNT: 'Quante volte',
  DURATION: 'Per quanto tempo',
};

export const HABIT_MEASURE_HINTS: Record<HabitMeasureDTO, string> = {
  DONE: 'Un tocco: fatto, oppure no',
  COUNT: 'Un numero, con l’unità che vuoi (serie, km, pagine)',
  DURATION: 'Minuti',
};

/** Default unit offered for a measure; free text, the user can change it */
export const HABIT_DEFAULT_UNITS: Record<HabitMeasureDTO, string> = {
  DONE: '',
  COUNT: 'volte',
  DURATION: 'min',
};

export const HABIT_STATUSES = ['DONE', 'SKIPPED'] as const;
export type HabitStatusDTO = (typeof HABIT_STATUSES)[number];

export const HABIT_STATUS_LABELS: Record<HabitStatusDTO, string> = {
  DONE: 'fatto',
  SKIPPED: 'non fatto',
};

/** ISO weekday, 1 = Monday … 7 = Sunday */
export const WEEKDAYS: { value: number; short: string; label: string }[] = [
  { value: 1, short: 'L', label: 'lunedì' },
  { value: 2, short: 'M', label: 'martedì' },
  { value: 3, short: 'M', label: 'mercoledì' },
  { value: 4, short: 'G', label: 'giovedì' },
  { value: 5, short: 'V', label: 'venerdì' },
  { value: 6, short: 'S', label: 'sabato' },
  { value: 7, short: 'D', label: 'domenica' },
];

/** Suggested starting set, installed on request and editable from then on */
export interface HabitSeed {
  name: string;
  measure: HabitMeasureDTO;
  unit: string;
}

export const DEFAULT_HABITS: HabitSeed[] = [
  { name: 'Meditazione', measure: 'DURATION', unit: 'min' },
  { name: 'Palestra', measure: 'DONE', unit: '' },
  { name: 'Corsa', measure: 'COUNT', unit: 'km' },
  { name: 'Studio', measure: 'DURATION', unit: 'min' },
];

// ---------- Catalogue ----------

export interface HabitDefinitionDTO {
  key: string;
  name: string;
  measure: HabitMeasureDTO;
  /** Free text: "min", "km", "pagine". Empty for a plain yes/no */
  unit: string;
  /** Daily goal, when there is one. Never a score, only a reference */
  target: number | null;
  /** Optional grouping label ("Mattina", "Dopo il lavoro") */
  moment: string | null;
  /**
   * ISO weekdays the habit is expected on. Empty = every day. A rest day is
   * not a skipped day: outside these, the habit is simply not asked about.
   */
  daysOfWeek: number[];
  /** Which day curve the answer feeds. NONE by default: opt-in, never assumed */
  track: DayTrackDTO;
  position: number;
  isActive: boolean;
  isDefault: boolean;
  /** Already answered at least once: deleting it would drop that history */
  isUsed: boolean;
}

export interface CreateHabitDefinitionDTO {
  name: string;
  measure?: HabitMeasureDTO;
  unit?: string;
  target?: number | null;
  moment?: string | null;
  daysOfWeek?: number[];
  track?: DayTrackDTO;
}

export interface UpdateHabitDefinitionDTO {
  name?: string;
  measure?: HabitMeasureDTO;
  unit?: string;
  target?: number | null;
  moment?: string | null;
  daysOfWeek?: number[];
  track?: DayTrackDTO;
  position?: number;
  isActive?: boolean;
}

// ---------- Answers ----------

export interface HabitEntryDTO {
  date: string; // YYYY-MM-DD
  habitKey: string;
  habitName: string;
  measure: HabitMeasureDTO;
  unit: string;
  status: HabitStatusDTO;
  /** The count or the minutes; null for a plain yes/no */
  value: number | null;
  note: string | null;
  loggedAt: string;
}

/** One line of the daily card: the habit and the answer given so far */
export interface HabitDayItemDTO {
  habitKey: string;
  name: string;
  measure: HabitMeasureDTO;
  unit: string;
  target: number | null;
  /** null = not answered yet; the day is not judged for it */
  status: HabitStatusDTO | null;
  value: number | null;
  note: string | null;
}

export interface HabitDayGroupDTO {
  /** The moment label, or an empty string for the ungrouped ones */
  moment: string;
  items: HabitDayItemDTO[];
}

export interface HabitDayDTO {
  date: string;
  groups: HabitDayGroupDTO[];
  answered: number;
  total: number;
}

export interface SetHabitDTO {
  date: string;
  habitKey: string;
  /** null clears the answer, so a mistaken tap is fully undoable */
  status: HabitStatusDTO | null;
  value?: number | null;
  note?: string | null;
}
