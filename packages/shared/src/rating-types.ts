// ============================================================
// Daily ratings - DTOs
//
// A rating is a quick "how is this going right now" vote on a user-defined
// characteristic. Unlike the check-in (one evaluation of the whole day,
// filled in the mood modal), a rating carries the time it was given and can
// be repeated: the same characteristic can be voted again hours later, and
// each vote is its own entry in the diary timeline.
// ============================================================

/**
 * What a characteristic is for. SCALE is a periodic mark (a row of boxes);
 * EVENT is an episode logged the moment it happens (a chip to tap). Same
 * storage, same recap, same export - only the way in differs.
 */
/**
 * Which of the two day tracks an entry feeds. The app never guesses this from
 * a name: what counts as "physical" or "psychological" is the user's call, and
 * NONE keeps something out of the day state entirely.
 */
export const DAY_TRACKS = ['BODY', 'MOOD', 'NONE'] as const;
export type DayTrackDTO = (typeof DAY_TRACKS)[number];

export const DAY_TRACK_LABELS: Record<DayTrackDTO, string> = {
  BODY: 'Condizione fisica',
  MOOD: 'Umore',
  NONE: 'Fuori dal grafico',
};

export const RATING_KINDS = ['SCALE', 'EVENT', 'SIDE_EFFECT'] as const;
export type RatingKindDTO = (typeof RATING_KINDS)[number];

export const RATING_KIND_LABELS: Record<RatingKindDTO, string> = {
  SCALE: 'Voto',
  EVENT: 'Episodio',
  SIDE_EFFECT: 'Effetto collaterale',
};

/**
 * Intensity of a side effect (§3.5): three named steps, never a number to
 * count. Stored as the 1..3 value of the entry.
 */
export const SIDE_EFFECT_INTENSITY_LABELS = ['lieve', 'moderato', 'forte'];
export const SIDE_EFFECT_MAX = SIDE_EFFECT_INTENSITY_LABELS.length;

/** The wording of an intensity, or the bare number for any other scale */
export function describeIntensity(value: number, maxValue: number): string {
  if (maxValue === SIDE_EFFECT_MAX) {
    return SIDE_EFFECT_INTENSITY_LABELS[Math.min(Math.max(value, 1), maxValue) - 1];
  }
  return `${value}/${maxValue}`;
}

/**
 * Suggested episode types. Installed on request, never automatically: the
 * catalogue stays the user's own.
 */
export const DEFAULT_EVENT_DEFINITIONS: string[] = [
  'Esplosione / sfogo verbale',
  'Picco di irritazione',
  'Picco compulsioni',
  'Crollo dell’umore',
  'Episodio di rimuginio',
];

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
  track: DayTrackDTO;
}

/**
 * Installed once per user and then fully editable: rename them, remove them,
 * add others. They are a starting point, not the shape of the feature.
 */
export const DEFAULT_RATING_DEFINITIONS: RatingDefinitionSeed[] = [
  { name: 'Umore', maxValue: 10, linkedForm: 'MOOD', track: 'MOOD' },
  { name: 'Benessere fisico', maxValue: 10, linkedForm: 'NONE', track: 'BODY' },
  { name: 'Allenamento', maxValue: 10, linkedForm: 'NONE', track: 'BODY' },
];

// ---------- Catalogue ----------

export interface RatingDefinitionDTO {
  key: string;
  name: string;
  kind: RatingKindDTO;
  /** Highest vote of the row: the boxes run 1..maxValue */
  maxValue: number;
  /** Which curve of "stato del giorno" this feeds */
  track: DayTrackDTO;
  /**
   * For a SIDE_EFFECT: the treatments that brought it up, so the diary can
   * group them under the drug they belong to. Empty = the therapy as a whole.
   */
  sourceTreatmentKeys: string[];
  linkedForm: RatingLinkedFormDTO;
  position: number;
  isActive: boolean;
  isDefault: boolean;
  /** Already voted at least once: deleting it would drop that history */
  isUsed: boolean;
}

export interface CreateRatingDefinitionDTO {
  name: string;
  kind?: RatingKindDTO;
  maxValue?: number;
  track?: DayTrackDTO;
  sourceTreatmentKeys?: string[];
  linkedForm?: RatingLinkedFormDTO;
}

export interface UpdateRatingDefinitionDTO {
  name?: string;
  kind?: RatingKindDTO;
  maxValue?: number;
  track?: DayTrackDTO;
  sourceTreatmentKeys?: string[];
  linkedForm?: RatingLinkedFormDTO;
  position?: number;
  isActive?: boolean;
}

// ---------- Entries ----------

/**
 * One vote, given at one moment. Name and scale are snapshots, exactly like
 * intakes and check-in values: editing the catalogue never rewrites what a
 * past day says. Several votes on the same characteristic can share a day.
 */
export interface RatingEntryDTO {
  id: string;
  date: string; // YYYY-MM-DD
  ratingKey: string;
  ratingName: string;
  kind: RatingKindDTO;
  /** The mark, or the intensity of an episode. Null while unanswered */
  value: number | null;
  maxValue: number;
  note: string | null;
  /**
   * What set the episode off. The most valuable field of the module: over
   * time it produces the ranking of the real triggers.
   */
  trigger: string | null;
  /** The mood log opened from this row, rendered inside the same recap */
  quickLogId: string | null;
  loggedAt: string;
}

/**
 * The vote leaving the row, with whatever was typed or picked next to it.
 * Always an insert: the row keeps no memory of it, so voting again later in
 * the day adds a second entry instead of overwriting the first.
 */
export interface CreateRatingEntryDTO {
  date: string;
  ratingKey: string;
  /** Required for a SCALE; optional for an EVENT, which is one tap away */
  value?: number | null;
  note?: string | null;
  trigger?: string | null;
  quickLogId?: string | null;
  /** Local instant of the vote; defaults to now on the server */
  loggedAt?: string;
}

/**
 * Correcting an entry already recorded. The moment is deliberately not part
 * of this: fixing a mark, a note or a trigger must not move the recap in the
 * timeline.
 */
export interface UpdateRatingEntryDTO {
  value?: number | null;
  note?: string | null;
  trigger?: string | null;
}
