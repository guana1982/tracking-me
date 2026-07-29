import type { TREATMENT_KINDS, INTAKE_STATUSES } from './therapy-dictionaries';

// ============================================================
// Intake & check-in module - DTOs
//
// The module grafts onto the food diary instead of living beside it: an
// intake belongs to a slot (a meal type, or "prima di dormire"), and the
// daily check-in belongs to the day the mood is logged for.
// ============================================================

export type TreatmentKindDTO = (typeof TREATMENT_KINDS)[number];
export type IntakeStatusDTO = (typeof INTAKE_STATUSES)[number];

// ---------- Catalogue ----------

export interface TreatmentDefinitionDTO {
  key: string;
  name: string;
  kind: TreatmentKindDTO;
  /** Active ingredient, brand, whatever the user needs to recognise it */
  detail: string | null;
  /** compressa / gocce / bustina ... free text, no fixed list */
  form: string | null;
  /** Free text so "½ cp" and "3 gtt" are equally expressible */
  dose: string | null;
  /** Meal-type keys, plus BEDTIME_SLOT */
  slots: string[];
  notes: string | null;
  startedOn: string | null; // YYYY-MM-DD
  position: number;
  isActive: boolean;
  /** Has at least one recorded intake: deleting it would lose that history */
  isUsed: boolean;
}

export interface CreateTreatmentDefinitionDTO {
  name: string;
  kind?: TreatmentKindDTO;
  detail?: string | null;
  form?: string | null;
  dose?: string | null;
  slots: string[];
  notes?: string | null;
  startedOn?: string | null;
}

export interface UpdateTreatmentDefinitionDTO {
  name?: string;
  kind?: TreatmentKindDTO;
  detail?: string | null;
  form?: string | null;
  dose?: string | null;
  slots?: string[];
  notes?: string | null;
  startedOn?: string | null;
  position?: number;
  isActive?: boolean;
}

// ---------- Adherence ----------

export interface IntakeSlotItemDTO {
  treatmentKey: string;
  name: string;
  kind: TreatmentKindDTO;
  /** Dose and form already joined, ready to render: "½ cp" */
  doseLabel: string | null;
  notes: string | null;
  /** null = not answered yet; the day is not judged for it */
  status: IntakeStatusDTO | null;
}

export interface IntakeSlotDTO {
  slot: string;
  slotName: string;
  items: IntakeSlotItemDTO[];
}

export interface DayIntakesDTO {
  date: string;
  slots: IntakeSlotDTO[];
  answered: number;
  total: number;
}

export interface SetIntakeDTO {
  date: string;
  treatmentKey: string;
  slot: string;
  /** null clears the answer, so a mistaken tap is fully undoable */
  status: IntakeStatusDTO | null;
}

export interface SetIntakesDTO {
  entries: SetIntakeDTO[];
}

// ---------- Check-in ----------

export interface CheckInScaleDTO {
  key: string;
  name: string;
  lowLabel: string;
  highLabel: string;
  levelLabels: string[];
  maxValue: number;
  isPositive: boolean;
  isCore: boolean;
  /** Read as "when did it appear and did it fade", not as a curve */
  isSideEffect: boolean;
  position: number;
  isActive: boolean;
  isDefault: boolean;
  isUsed: boolean;
}

export interface CreateCheckInScaleDTO {
  name: string;
  lowLabel?: string;
  highLabel?: string;
  levelLabels?: string[];
  maxValue?: number;
  isPositive?: boolean;
  isCore?: boolean;
  isSideEffect?: boolean;
}

export interface UpdateCheckInScaleDTO {
  name?: string;
  lowLabel?: string;
  highLabel?: string;
  levelLabels?: string[];
  maxValue?: number;
  isPositive?: boolean;
  isCore?: boolean;
  isSideEffect?: boolean;
  position?: number;
  isActive?: boolean;
}

/**
 * Values snapshot the scale they were answered on, exactly like mood logs
 * snapshot their label: renaming or deleting a scale never rewrites history.
 */
export interface CheckInValueDTO {
  key: string;
  name: string;
  value: number;
  maxValue: number;
  isPositive: boolean;
}

export interface CheckInEntryDTO {
  date: string;
  values: CheckInValueDTO[];
  note: string | null;
  loggedAt: string;
}

export interface SaveCheckInDTO {
  date: string;
  values: { key: string; value: number }[];
  note?: string | null;
}

/** Everything the check-in form needs, in one request */
export interface CheckInDayDTO {
  date: string;
  scales: CheckInScaleDTO[];
  /** Already compiled today? The form edits it instead of adding a second one */
  entry: CheckInEntryDTO | null;
  /** Last previous answer per scale: only what changed has to be moved */
  prefill: Record<string, number>;
}
