// ============================================================
// Therapy plan - DTOs for the parts of the module that live on a calendar
// (titration, exams, appointments), the weekly weight, and the weekly
// reading of everything the diary has collected.
// ============================================================

// ---------- Titration (§3.1) ----------

/** A planned dose change: date and the dose it becomes */
export interface TitrationStepDTO {
  id: string;
  treatmentKey: string;
  treatmentName: string;
  date: string; // YYYY-MM-DD
  dose: string;
  /** The catalogue has been updated to this dose */
  applied: boolean;
}

export interface CreateTitrationStepDTO {
  treatmentKey: string;
  date: string;
  dose: string;
}

// ---------- Milestones (§3.7) ----------

export const MILESTONE_KINDS = ['EXAM', 'APPOINTMENT', 'OTHER'] as const;
export type MilestoneKindDTO = (typeof MILESTONE_KINDS)[number];

export const MILESTONE_KIND_LABELS: Record<MilestoneKindDTO, string> = {
  EXAM: 'Esame',
  APPOINTMENT: 'Controllo',
  OTHER: 'Altro',
};

export interface MilestoneDTO {
  id: string;
  kind: MilestoneKindDTO;
  title: string;
  date: string; // YYYY-MM-DD
  notes: string | null;
  /** Values to be checked, for an exam */
  items: string[];
  /** Conditional reminders, e.g. the 72 h without heavy training before a CPK */
  advisories: string[];
  isDone: boolean;
  /** Metadata only - the bytes are never carried in a list response */
  attachments: MilestoneAttachmentDTO[];
}

// ---------- Attachments on a scheduled date (referti) ----------

/**
 * What may be attached. Deliberately short: these are reports, and a list
 * that accepts anything is a list nobody can reason about when it comes out
 * the other end inside an export.
 */
export const ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'text/plain',
  'text/csv',
] as const;
export type AttachmentMimeTypeDTO = (typeof ATTACHMENT_MIME_TYPES)[number];

/** Extension the file gets when written into the export archive */
export const ATTACHMENT_EXTENSIONS: Record<AttachmentMimeTypeDTO, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

/** 10 MB: a scanned report fits, a photo album does not */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export interface MilestoneAttachmentDTO {
  id: string;
  milestoneId: string;
  fileName: string;
  mimeType: AttachmentMimeTypeDTO;
  sizeBytes: number;
  /** Whether the next export carries the file itself */
  includeInExport: boolean;
  createdAt: string; // ISO datetime
}

export interface CreateMilestoneAttachmentDTO {
  fileName: string;
  mimeType: AttachmentMimeTypeDTO;
  /** base64 of the file, without the `data:` URL prefix */
  content: string;
}

export interface UpdateMilestoneAttachmentDTO {
  includeInExport: boolean;
}

export interface CreateMilestoneDTO {
  kind?: MilestoneKindDTO;
  title: string;
  date: string;
  notes?: string | null;
  items?: string[];
  advisories?: string[];
}

export interface UpdateMilestoneDTO {
  kind?: MilestoneKindDTO;
  title?: string;
  date?: string;
  notes?: string | null;
  items?: string[];
  advisories?: string[];
  isDone?: boolean;
}

/**
 * The schedule the diary reads: milestones and planned dose changes merged
 * into one list, so "what is coming up" is a single question.
 */
export interface ScheduleItemDTO {
  id: string;
  source: 'MILESTONE' | 'TITRATION';
  kind: MilestoneKindDTO | 'DOSE_CHANGE';
  title: string;
  date: string;
  detail: string | null;
  items: string[];
  advisories: string[];
  isDone: boolean;
  /** Days from today: negative when the date has passed */
  daysAway: number;
}

// ---------- Weight (§3.6) ----------

export interface WeightEntryDTO {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  note: string | null;
}

export interface SaveWeightDTO {
  date: string;
  weightKg: number;
  note?: string | null;
}

/** Weekly by design: the card only asks again once the week has passed */
export const WEIGHT_INTERVAL_DAYS = 7;

export interface WeightSummaryDTO {
  entries: WeightEntryDTO[];
  first: WeightEntryDTO | null;
  last: WeightEntryDTO | null;
  deltaKg: number | null;
  daysSinceLast: number | null;
}

// ---------- Side effects (§3.5) ----------

export interface SuggestedSideEffectDTO {
  name: string;
  /** Names of the treatments that brought it up, for the "why this one" question */
  sources: string[];
  /** The same treatments by key, so the diary can group by drug */
  sourceKeys: string[];
  /** Already among the diary chips */
  isInstalled: boolean;
}

// ---------- Weekly reading (§4.4) ----------

/**
 * No correlation is shown below this many observations, and every figure
 * carries its sample size. Reading a trend out of four days is noise.
 */
export const MIN_OBSERVATIONS_FOR_CORRELATION = 21;

export interface TherapyScaleSeriesDTO {
  key: string;
  name: string;
  maxValue: number;
  isPositive: boolean;
  isSideEffect: boolean;
}

export interface TherapyWeekPointDTO {
  weekStart: string; // Monday, YYYY-MM-DD
  label: string; // "15–21 lug"
  /** The running week: fewer days, shown but flagged */
  isPartial: boolean;
  /** Check-ins actually compiled that week */
  checkIns: number;
  /** Weekly mean per scale, null when that scale was never answered */
  scales: Record<string, number | null>;
  /** Episodes counted that week, per type */
  events: Record<string, number>;
}

export interface TriggerRankDTO {
  trigger: string;
  count: number;
}

export interface AdherenceDTO {
  treatmentKey: string;
  name: string;
  taken: number;
  late: number;
  skipped: number;
  /** Slots the treatment was due, over the period */
  expected: number;
  /** Answered / expected, as a percentage of the period */
  recordedPct: number;
  takenPct: number;
}

export interface SideEffectReportDTO {
  key: string;
  name: string;
  /** First day it was logged; null = never happened in the period */
  firstSeen: string | null;
  /** Distinct days it was logged on */
  daysPresent: number;
  /** Intensity of the last time it was logged */
  lastLabel: string | null;
}

export interface DoseChangeMarkerDTO {
  date: string;
  weekStart: string;
  label: string;
}

export interface TherapyTrendsDTO {
  from: string;
  to: string;
  weeks: TherapyWeekPointDTO[];
  scales: TherapyScaleSeriesDTO[];
  events: { key: string; name: string }[];
  triggers: TriggerRankDTO[];
  triggerWindowDays: number;
  adherence: AdherenceDTO[];
  sideEffects: SideEffectReportDTO[];
  doseChanges: DoseChangeMarkerDTO[];
  weight: { first: WeightEntryDTO; last: WeightEntryDTO; deltaKg: number } | null;
  /** Total check-ins in the period: the denominator of everything above */
  totalCheckIns: number;
}
