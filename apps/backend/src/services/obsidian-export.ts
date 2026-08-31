import { strToU8, zipSync } from 'fflate';
import type { ActivityStatusDTO, IntakeStatusDTO } from '@budget/shared';

// ============================================================
// Obsidian vault: the same diary, rendered as one Markdown note per day.
//
// A second VIEW of the records the CSV export already reads, never a second
// source: everything here is pure, takes normalised records in and gives text
// out, and knows nothing about the database.
//
//   records --> groupByDate --> ObsidianDay --> renderDay --> buildObsidianVault
//
// Plain Markdown throughout, no Obsidian-only syntax beyond task checkboxes,
// which are standard anyway: the point of exporting is that the notes still
// read somewhere else.
// ============================================================

/** Folder the notes land in, so the archive can be dropped into a vault as-is */
const VAULT_DIR = 'Diario';

const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export type ObsidianRecordType =
  | 'day_note'
  | 'weight'
  | 'rating'
  | 'mood_log'
  | 'checkin'
  | 'meal'
  | 'quick_log'
  | 'habit'
  | 'intake'
  | 'dose_change'
  | 'treatment'
  | 'side_effect'
  | 'event'
  | 'milestone'
  | 'activity'
  | 'attachment';

interface RecordBase {
  /** Local calendar day, YYYY-MM-DD */
  date: string;
  /** HH:mm, or null when the record belongs to the day and not to a moment */
  time: string | null;
  /**
   * A readable one-liner. Every record carries one so the fallback renderer
   * always has something to print: a type that gains no renderer of its own
   * still reaches the file instead of disappearing from it.
   */
  summary: string;
}

export type ObsidianRecord =
  | (RecordBase & { recordType: 'day_note'; text: string })
  | (RecordBase & { recordType: 'weight'; weightKg: number; note: string | null })
  | (RecordBase & {
      recordType: 'rating';
      name: string;
      value: number | null;
      maxValue: number;
      note: string | null;
      linkedText: string | null;
    })
  | (RecordBase & { recordType: 'mood_log'; text: string })
  | (RecordBase & {
      recordType: 'checkin';
      values: { name: string; value: number; maxValue: number; isPositive: boolean }[];
      note: string | null;
    })
  | (RecordBase & {
      recordType: 'meal';
      mealTypeName: string;
      notes: string | null;
      items: { foodName: string; quantity: number | null; unitName: string | null }[];
    })
  | (RecordBase & { recordType: 'quick_log'; categoryLabel: string | null; text: string })
  | (RecordBase & {
      recordType: 'habit';
      name: string;
      done: boolean;
      value: number | null;
      unit: string;
      note: string | null;
    })
  | (RecordBase & {
      recordType: 'intake';
      treatmentName: string;
      doseLabel: string | null;
      slotName: string;
      status: IntakeStatusDTO;
    })
  | (RecordBase & { recordType: 'dose_change'; treatmentName: string; dose: string; applied: boolean })
  | (RecordBase & {
      recordType: 'treatment';
      name: string;
      kindLabel: string;
      dose: string | null;
      slotNames: string[];
      detail: string | null;
      isActive: boolean;
    })
  | (RecordBase & {
      recordType: 'side_effect';
      name: string;
      value: number | null;
      maxValue: number;
      note: string | null;
    })
  | (RecordBase & {
      recordType: 'event';
      name: string;
      value: number | null;
      maxValue: number;
      trigger: string | null;
      note: string | null;
    })
  | (RecordBase & {
      recordType: 'milestone';
      kindLabel: string;
      title: string;
      items: string[];
      advisories: string[];
      notes: string | null;
      isDone: boolean;
    })
  | (RecordBase & {
      recordType: 'activity';
      title: string;
      notes: string | null;
      typeName: string | null;
      scopeLabel: string;
      priorityLabel: string;
      status: ActivityStatusDTO;
    })
  | (RecordBase & {
      recordType: 'attachment';
      fileName: string;
      milestoneTitle: string;
      kindLabel: string;
    });

/** The aggregates the app already computes; never recalculated here */
export interface ObsidianDaySummary {
  bodyState: number | null;
  moodState: number | null;
  mealCount: number;
}

export interface ObsidianDay {
  date: string; // YYYY-MM-DD
  records: ObsidianRecord[];
  summary?: ObsidianDaySummary;
}

// ---------- Text helpers ----------

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "2026-08-25" -> "25 agosto 2026" */
export function italianDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** Italian decimals, so 80.1 reads as 80,1 the way the app shows it */
function decimal(value: number): string {
  return String(value).replace('.', ',');
}

/**
 * Free text on a line of its own. Newlines are kept - a paragraph is allowed
 * to be a paragraph - and only the line endings are normalised.
 */
function block(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

/**
 * Free text inside a bullet or after a dash. Newlines have to go: a stray one
 * ends the list item and the rest of the sentence falls out of the list.
 */
function inline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * YAML is the one place where user text can break the file rather than just
 * look odd, so every string is quoted and escaped rather than guessed at.
 */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

export type FrontmatterValue = string | number | boolean | string[];

/**
 * Numbers stay numbers and booleans stay booleans, or Obsidian cannot filter
 * on them. Anything absent is left out entirely: an empty property is worse
 * than a missing one, because it reads as a measurement of zero.
 */
export function serializeFrontmatter(entries: [string, FrontmatterValue][]): string {
  const lines: string[] = ['---'];
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${yamlString(item)}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${Number.isFinite(value) ? value : 0}`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${yamlString(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** Property keys have to survive YAML and Obsidian, so they stay ascii and flat */
function propertyKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function scale(value: number | null, maxValue: number): string {
  return value === null ? '—' : `**${value}/${maxValue}**`;
}

function timed(time: string | null, rest: string): string {
  return time ? `${time} — ${rest}` : rest;
}

/** Drops the empty pieces and joins what is left, so no " —  — " ever appears */
function joinParts(parts: (string | null | undefined | false)[], separator = ' — '): string {
  return parts.filter((part): part is string => Boolean(part)).join(separator);
}

// ---------- Sections ----------

interface Section {
  heading: string;
  body: string[];
}

type Renderer = (records: ObsidianRecord[]) => Section[];

function byTime(left: ObsidianRecord, right: ObsidianRecord): number {
  // Records without a clock belong to the day itself, so they lead
  if (left.time === right.time) return 0;
  if (left.time === null) return -1;
  if (right.time === null) return 1;
  return left.time.localeCompare(right.time);
}

/** Narrows a list to one variant; every renderer is registered under its own type */
function only<T extends ObsidianRecordType>(
  records: ObsidianRecord[],
  recordType: T
): Extract<ObsidianRecord, { recordType: T }>[] {
  return records.filter(
    (record): record is Extract<ObsidianRecord, { recordType: T }> =>
      record.recordType === recordType
  );
}

function renderDayNotes(records: ObsidianRecord[]): Section[] {
  const notes = only(records, 'day_note');
  if (notes.length === 0) return [];
  const body: string[] = [];
  for (const note of notes) {
    // The clock only earns its place when there is more than one note to tell
    // apart; a single comment on the day needs no timestamp above it
    if (notes.length > 1 && note.time) body.push(`**${note.time}**`, '');
    body.push(block(note.text), '');
  }
  return [{ heading: '## 📝 Nota della giornata', body }];
}

function renderWeight(records: ObsidianRecord[]): Section[] {
  const weights = only(records, 'weight');
  if (weights.length === 0) return [];
  const body: string[] = [];
  for (const weight of weights) {
    body.push(`**${decimal(weight.weightKg)} kg**`, '');
    if (weight.note) body.push(block(weight.note), '');
  }
  return [{ heading: '## ⚖️ Peso', body }];
}

/** A hint of a face for the names people actually use; anything else gets the neutral one */
const RATING_EMOJI: { match: RegExp; emoji: string }[] = [
  { match: /sonn|dorm/i, emoji: '😴' },
  { match: /umor|mood/i, emoji: '🧠' },
  { match: /energ/i, emoji: '⚡' },
  { match: /benesser|fisic|corpo/i, emoji: '🩺' },
  { match: /stress|ansia/i, emoji: '🌀' },
  { match: /dolor/i, emoji: '🩹' },
];

function ratingEmoji(name: string): string {
  return RATING_EMOJI.find((entry) => entry.match.test(name))?.emoji ?? '📊';
}

/**
 * One section per characteristic rather than one list of everything: the names
 * are the user's own, and "Sonno" next to "Energia" is what makes the note
 * readable months later.
 */
function renderRatings(records: ObsidianRecord[]): Section[] {
  const ratings = only(records, 'rating');
  if (ratings.length === 0) return [];

  const byName = new Map<string, typeof ratings>();
  for (const rating of ratings) {
    byName.set(rating.name, [...(byName.get(rating.name) ?? []), rating]);
  }

  return [...byName.entries()].map(([name, votes]) => {
    const heading = `## ${ratingEmoji(name)} ${name}`;
    if (votes.length === 1) {
      const [vote] = votes;
      const body = [scale(vote.value, vote.maxValue), ''];
      const note = joinParts([vote.note, vote.linkedText], ' · ');
      if (note) body.push(block(note), '');
      return { heading, body };
    }
    return {
      heading,
      body: [
        ...votes.map((vote) =>
          `- ${timed(
            vote.time,
            joinParts([
              scale(vote.value, vote.maxValue),
              vote.note && inline(vote.note),
              vote.linkedText && inline(vote.linkedText),
            ])
          )}`
        ),
        '',
      ],
    };
  });
}

function renderMoodLogs(records: ObsidianRecord[]): Section[] {
  const logs = only(records, 'mood_log');
  if (logs.length === 0) return [];
  return [
    {
      heading: '## 🧠 Umore',
      body: [...logs.map((log) => `- ${timed(log.time, inline(log.text))}`), ''],
    },
  ];
}

function renderCheckIns(records: ObsidianRecord[]): Section[] {
  const checkIns = only(records, 'checkin');
  if (checkIns.length === 0) return [];
  const body: string[] = [];
  for (const checkIn of checkIns) {
    for (const value of checkIn.values) {
      body.push(
        `- ${value.name}: **${value.value}/${value.maxValue}** _(${
          value.isPositive ? 'più alto è meglio' : 'più basso è meglio'
        })_`
      );
    }
    if (checkIn.note) body.push(`- Nota: ${inline(checkIn.note)}`);
  }
  body.push('');
  return [{ heading: '## 🩺 Check-in', body }];
}

/** Meal-type emoji, purely so the note skims well */
function mealEmoji(name: string): string {
  if (/colaz/i.test(name)) return '☕';
  if (/pranz/i.test(name)) return '🍚';
  if (/cena/i.test(name)) return '🍲';
  if (/spunt|snack|meren/i.test(name)) return '🥪';
  return '🍽️';
}

function renderMeals(records: ObsidianRecord[]): Section[] {
  const meals = only(records, 'meal');
  if (meals.length === 0) return [];
  const body: string[] = [];
  for (const meal of meals) {
    body.push(
      `### ${mealEmoji(meal.mealTypeName)} ${meal.mealTypeName}${meal.time ? ` — ${meal.time}` : ''}`,
      ''
    );
    for (const item of meal.items) {
      const quantity = joinParts(
        [item.quantity === null ? null : decimal(item.quantity), item.unitName],
        ' '
      );
      body.push(`- ${joinParts([item.foodName, quantity])}`);
    }
    if (meal.notes) body.push('', `_${inline(meal.notes)}_`);
    body.push('');
  }
  return [{ heading: '## 🍽️ Alimentazione', body }];
}

function renderQuickLogs(records: ObsidianRecord[]): Section[] {
  const logs = only(records, 'quick_log');
  if (logs.length === 0) return [];
  return [
    {
      heading: '## 💬 Note',
      body: [
        ...logs.map((log) =>
          `- ${timed(log.time, joinParts([log.categoryLabel && `_${log.categoryLabel}_`, inline(log.text)]))}`
        ),
        '',
      ],
    },
  ];
}

function renderHabits(records: ObsidianRecord[]): Section[] {
  const habits = only(records, 'habit');
  if (habits.length === 0) return [];
  return [
    {
      heading: '## 🔁 Abitudini',
      body: [
        ...habits.map((habit) => {
          const amount =
            habit.value === null ? null : joinParts([decimal(habit.value), habit.unit], ' ');
          return `- [${habit.done ? 'x' : ' '}] ${joinParts([
            habit.name,
            amount,
            habit.note && inline(habit.note),
          ])}`;
        }),
        '',
      ],
    },
  ];
}

/**
 * A checkbox, because the difference that matters here is between a dose taken
 * and a dose that was only due. The label still says which of the two it was,
 * late included.
 */
function renderIntakes(records: ObsidianRecord[]): Section[] {
  const intakes = only(records, 'intake');
  if (intakes.length === 0) return [];
  return [
    {
      heading: '## 💊 Assunzioni',
      body: [
        ...intakes.map((intake) => {
          const taken = intake.status === 'TAKEN' || intake.status === 'LATE';
          const label =
            intake.status === 'TAKEN' ? 'presa' : intake.status === 'LATE' ? 'presa in ritardo' : 'non presa';
          return `- [${taken ? 'x' : ' '}] ${joinParts([
            joinParts([intake.treatmentName, intake.doseLabel], ' '),
            intake.slotName,
            label,
            intake.time,
          ])}`;
        }),
        '',
      ],
    },
  ];
}

function renderDoseChanges(records: ObsidianRecord[]): Section[] {
  const changes = only(records, 'dose_change');
  if (changes.length === 0) return [];
  return [
    {
      heading: '## 💉 Cambi dose',
      body: [
        ...changes.map(
          (change) =>
            // Planned is not applied: the box stays empty until it happened
            `- [${change.applied ? 'x' : ' '}] ${change.treatmentName} → ${change.dose}${
              change.applied ? '' : ' _(programmata)_'
            }`
        ),
        '',
      ],
    },
  ];
}

function renderTreatments(records: ObsidianRecord[]): Section[] {
  const treatments = only(records, 'treatment');
  if (treatments.length === 0) return [];
  return [
    {
      heading: '## 🧪 Terapia',
      body: [
        ...treatments.map((treatment) =>
          `- ${joinParts([
            treatment.name,
            treatment.dose,
            treatment.slotNames.length > 0 ? treatment.slotNames.join(', ') : null,
            treatment.kindLabel,
            treatment.detail && inline(treatment.detail),
            treatment.isActive ? null : 'sospesa',
          ])}`
        ),
        '',
      ],
    },
  ];
}

function renderSideEffects(records: ObsidianRecord[]): Section[] {
  const effects = only(records, 'side_effect');
  if (effects.length === 0) return [];
  return [
    {
      heading: '## ⚠️ Effetti / sintomi',
      body: [
        ...effects.map((effect) =>
          `- ${timed(
            effect.time,
            joinParts([
              effect.name,
              effect.value === null ? null : scale(effect.value, effect.maxValue),
              effect.note && inline(effect.note),
            ])
          )}`
        ),
        '',
      ],
    },
  ];
}

function renderEvents(records: ObsidianRecord[]): Section[] {
  const events = only(records, 'event');
  if (events.length === 0) return [];
  return [
    {
      heading: '## 📅 Episodi',
      body: [
        ...events.map((event) =>
          `- ${timed(
            event.time,
            joinParts([
              event.name,
              event.value === null ? null : scale(event.value, event.maxValue),
              event.trigger && `innesco: ${inline(event.trigger)}`,
              event.note && inline(event.note),
            ])
          )}`
        ),
        '',
      ],
    },
  ];
}

/**
 * Appointments are dated, and a date in the future has not happened yet. The
 * checkbox comes from the record's own done flag, never from the date having
 * passed, so nothing planned is ever written down as done.
 */
function renderMilestones(records: ObsidianRecord[]): Section[] {
  const milestones = only(records, 'milestone');
  if (milestones.length === 0) return [];
  const body: string[] = [];
  for (const milestone of milestones) {
    body.push(
      `- [${milestone.isDone ? 'x' : ' '}] ${joinParts(
        [milestone.kindLabel, milestone.title],
        ': '
      )}`
    );
    if (milestone.items.length > 0) body.push(`  - Valori: ${milestone.items.join(', ')}`);
    for (const advisory of milestone.advisories) body.push(`  - ⚠️ ${inline(advisory)}`);
    if (milestone.notes) body.push(`  - ${inline(milestone.notes)}`);
  }
  body.push('');
  return [{ heading: '## 🗓️ Scadenze e traguardi', body }];
}

function renderActivities(records: ObsidianRecord[]): Section[] {
  const activities = only(records, 'activity');
  if (activities.length === 0) return [];
  const body: string[] = [];
  for (const activity of activities) {
    // Only DONE ticks the box: something in progress is still something to do
    const meta = joinParts(
      [
        activity.typeName,
        activity.scopeLabel,
        activity.priorityLabel,
        activity.status === 'IN_PROGRESS' ? 'in corso' : null,
        activity.time,
      ],
      ' · '
    );
    body.push(
      `- [${activity.status === 'DONE' ? 'x' : ' '}] ${activity.title}${meta ? ` _(${meta})_` : ''}`
    );
    if (activity.notes) body.push(`  - ${inline(activity.notes)}`);
  }
  body.push('');
  return [{ heading: '## ✅ Attività', body }];
}

function renderAttachments(records: ObsidianRecord[]): Section[] {
  const attachments = only(records, 'attachment');
  if (attachments.length === 0) return [];
  return [
    {
      heading: '## 📎 Referti',
      body: [
        ...attachments.map((attachment) =>
          `- ${joinParts([attachment.fileName, attachment.kindLabel, attachment.milestoneTitle])}`
        ),
        '',
      ],
    },
  ];
}

/**
 * The order a day reads in: what the day was, then what the body said, then
 * what went in, then what was planned. Anything whose type has no renderer
 * falls through to the end rather than out of the file.
 */
const SECTION_ORDER: ObsidianRecordType[] = [
  'day_note',
  'weight',
  'rating',
  'mood_log',
  'checkin',
  'meal',
  'quick_log',
  'habit',
  'intake',
  'dose_change',
  'treatment',
  'side_effect',
  'event',
  'milestone',
  'activity',
  'attachment',
];

const RENDERERS: Partial<Record<ObsidianRecordType, Renderer>> = {
  day_note: renderDayNotes,
  weight: renderWeight,
  rating: renderRatings,
  mood_log: renderMoodLogs,
  checkin: renderCheckIns,
  meal: renderMeals,
  quick_log: renderQuickLogs,
  habit: renderHabits,
  intake: renderIntakes,
  dose_change: renderDoseChanges,
  treatment: renderTreatments,
  side_effect: renderSideEffects,
  event: renderEvents,
  milestone: renderMilestones,
  activity: renderActivities,
  attachment: renderAttachments,
};

// ---------- Frontmatter ----------

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/**
 * Daily metrics only: enough to search, filter and chart a year of days, and
 * nothing that belongs in the body. Every entry is computed from records that
 * are actually there - a day without a weighing simply has no `weight` key.
 */
export function buildFrontmatter(day: ObsidianDay): [string, FrontmatterValue][] {
  const entries: [string, FrontmatterValue][] = [
    ['date', day.date],
    ['type', 'diario'],
  ];

  const weights = only(day.records, 'weight');
  if (weights.length > 0) entries.push(['weight', weights[weights.length - 1].weightKg]);

  const meals = only(day.records, 'meal');
  // The app's own count when it has one, so the note and the charts agree
  const mealCount = day.summary?.mealCount ?? meals.length;
  if (mealCount > 0) entries.push(['meal_count', mealCount]);

  if (day.summary?.bodyState !== null && day.summary?.bodyState !== undefined) {
    entries.push(['body_state', day.summary.bodyState]);
  }
  if (day.summary?.moodState !== null && day.summary?.moodState !== undefined) {
    entries.push(['mood_state', day.summary.moodState]);
  }

  // One property per characteristic voted that day, so a dashboard can plot
  // "sonno" over a year without anybody having to name it in advance
  const votes = new Map<string, number[]>();
  for (const rating of only(day.records, 'rating')) {
    if (rating.value === null) continue;
    const key = propertyKey(rating.name);
    if (!key) continue;
    votes.set(key, [...(votes.get(key) ?? []), rating.value]);
  }
  for (const [key, values] of votes) {
    const mean = average(values);
    if (mean !== null) entries.push([`rating_${key}`, mean]);
  }

  const intakes = only(day.records, 'intake');
  if (intakes.length > 0) {
    entries.push([
      'intakes_taken',
      intakes.filter((intake) => intake.status === 'TAKEN' || intake.status === 'LATE').length,
    ]);
    entries.push([
      'intakes_skipped',
      intakes.filter((intake) => intake.status === 'SKIPPED').length,
    ]);
  }

  const events = only(day.records, 'event');
  if (events.length > 0) entries.push(['event_count', events.length]);
  const sideEffects = only(day.records, 'side_effect');
  if (sideEffects.length > 0) entries.push(['side_effect_count', sideEffects.length]);

  const tags = ['diario'];
  if (meals.length > 0) tags.push('alimentazione');
  entries.push(['tags', tags]);

  return entries;
}

// ---------- Day ----------

/** Groups records by their local day and attaches the day scores the app computed */
export function groupByDate(
  records: ObsidianRecord[],
  summaries: Map<string, ObsidianDaySummary> = new Map()
): ObsidianDay[] {
  const byDate = new Map<string, ObsidianRecord[]>();
  for (const record of records) {
    byDate.set(record.date, [...(byDate.get(record.date) ?? []), record]);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayRecords]) => ({
      date,
      records: [...dayRecords].sort(byTime),
      summary: summaries.get(date),
    }));
}

export function renderDay(day: ObsidianDay): string {
  const sections: Section[] = [];
  const rendered = new Set<ObsidianRecordType>();

  for (const recordType of SECTION_ORDER) {
    const renderer = RENDERERS[recordType];
    if (!renderer) continue;
    rendered.add(recordType);
    sections.push(...renderer(day.records));
  }

  // Anything whose type never reached a renderer: printed from the summary
  // every record carries, so a new kind of record shows up as a readable line
  // instead of being dropped on the floor
  const leftovers = day.records.filter((record) => !rendered.has(record.recordType));
  if (leftovers.length > 0) {
    sections.push({
      heading: '## 📎 Altri dati',
      body: [
        ...leftovers.map((record) => `- ${timed(record.time, inline(record.summary))}`),
        '',
      ],
    });
  }

  const lines: string[] = [
    serializeFrontmatter(buildFrontmatter(day)),
    '',
    `# ${italianDate(day.date)}`,
    '',
  ];
  for (const section of sections) {
    lines.push(section.heading, '');
    lines.push(...section.body);
  }

  // One trailing newline, no runs of blank lines: the file should look the
  // same whether a section ended with a list or a paragraph
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** `Diario/2026-08-25.md` for every day that has something in it */
export function buildObsidianVault(days: ObsidianDay[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const day of days) {
    files[`${VAULT_DIR}/${day.date}.md`] = strToU8(renderDay(day));
  }
  return zipSync(files, { level: 6 });
}
