// ============================================================
// Daily ratings - DTOs
//
// A rating is a quick "how is this going right now" vote on a
// user-defined characteristic. Unlike the check-in (one evaluation of the
// whole day, filled in the mood modal), a rating carries the time it was
// given, so it lands in the diary timeline next to the meals and the notes.
// ============================================================

/**
 * Structured picker a rating row can hand off to. NONE keeps the row a plain
 * vote; MOOD opens the mood chips modal and attaches what was chosen.
 */
export const RATING_LINKED_FORMS = ['NONE', 'MOOD'] as const;
export type RatingLinkedFormDTO = (typeof RATING_LINKED_FORMS)[number];

export const RATING_LINKED_FORM_LABELS: Record<RatingLinkedFormDTO, string> = {
  NONE: 'Nessuno',
  MOOD: "Stati d'umore",
};

/** Boxes per row: 10 by default, but every row carries its own scale */
export const RATING_DEFAULT_MAX = 10;
export const RATING_MIN_MAX = 3;
export const RATING_MAX_MAX = 10;

export interface RatingDefinitionSeed {
  name: string;
  maxValue: number;
  linkedForm: RatingLinkedFormDTO;
}

/**
 * Installed once per user and then fully editable: rename them, remove them,
 * add others. They are a starting point, not the shape of the feature.
 */
export const DEFAULT_RATING_DEFINITIONS: RatingDefinitionSeed[] = [
  { name: 'Umore', maxValue: 10, linkedForm: 'MOOD' },
  { name: 'Benessere fisico', maxValue: 10, linkedForm: 'NONE' },
  { name: 'Allenamento', maxValue: 10, linkedForm: 'NONE' },
];

// ---------- Catalogue ----------

export interface RatingDefinitionDTO {
  key: string;
  name: string;
  /** Highest vote of the row: the boxes run 1..maxValue */
  maxValue: number;
  linkedForm: RatingLinkedFormDTO;
  position: number;
  isActive: boolean;
  isDefault: boolean;
  /** Already voted at least once: deleting it would drop that history */
  isUsed: boolean;
}

export interface CreateRatingDefinitionDTO {
  name: string;
  maxValue?: number;
  linkedForm?: RatingLinkedFormDTO;
}

export interface UpdateRatingDefinitionDTO {
  name?: string;
  maxValue?: number;
  linkedForm?: RatingLinkedFormDTO;
  position?: number;
  isActive?: boolean;
}

// ---------- Entries ----------

/**
 * One vote for one characteristic on one day. Name and scale are snapshots,
 * exactly like intakes and check-in values: editing the catalogue never
 * rewrites what a past day says.
 */
export interface RatingEntryDTO {
  date: string; // YYYY-MM-DD
  ratingKey: string;
  ratingName: string;
  /** null when the row only carries a note or a linked mood entry */
  value: number | null;
  maxValue: number;
  note: string | null;
  /** The mood log opened from this row, rendered inside the same recap */
  quickLogId: string | null;
  loggedAt: string;
}

/**
 * Partial update: an omitted field is left untouched, an explicit null clears
 * it. When nothing is left the entry is removed, so a mistaken tap is
 * fully undoable.
 */
export interface SetRatingDTO {
  date: string;
  ratingKey: string;
  value?: number | null;
  note?: string | null;
  quickLogId?: string | null;
  /** Local instant of the vote; defaults to now on the server */
  loggedAt?: string;
}
