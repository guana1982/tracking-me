// ============================================================
// Intake & check-in module - shared vocabulary
//
// Deliberately generic: nothing here names a specific drug. The catalogue is
// empty until the user fills it, so someone who only tracks supplements (or
// nothing at all) never sees the module.
// ============================================================

export const TREATMENT_KINDS = ['MEDICATION', 'SUPPLEMENT', 'OTHER'] as const;

export const TREATMENT_KIND_LABELS: Record<(typeof TREATMENT_KINDS)[number], string> = {
  MEDICATION: 'Farmaco',
  SUPPLEMENT: 'Integratore',
  OTHER: 'Altro',
};

export const INTAKE_STATUSES = ['TAKEN', 'SKIPPED', 'LATE'] as const;

export const INTAKE_STATUS_LABELS: Record<(typeof INTAKE_STATUSES)[number], string> = {
  TAKEN: 'preso',
  SKIPPED: 'non preso',
  LATE: 'preso in ritardo',
};

/**
 * A slot is a meal-type key (colazione, pranzo, cena...), so renaming a meal
 * type keeps working and the intake shows up inside that meal's form. This
 * pseudo-slot covers the one moment that is not a meal.
 */
export const BEDTIME_SLOT = 'bedtime';
export const BEDTIME_SLOT_LABEL = 'Prima di dormire';

export const CHECK_IN_SCALE_MAX = 10;

export interface CheckInScaleSeed {
  key: string;
  name: string;
  lowLabel: string;
  highLabel: string;
  /** Non-empty turns the slider into labelled steps (index = value) */
  levelLabels: string[];
  maxValue: number;
  /** true = high is good; the only kind of scale that must be flagged in UI */
  isPositive: boolean;
  /** Core scales are always visible; the rest sit in the optional section */
  isCore: boolean;
}

/**
 * Starting set, editable by the user. One convention holds for every core
 * scale: 0 = symptom absent, max = symptom at its worst, so a falling curve
 * always means improvement and no scale is ever read backwards.
 */
export const DEFAULT_CHECK_IN_SCALES: CheckInScaleSeed[] = [
  {
    key: 'umore-basso',
    name: 'Umore basso',
    lowLabel: 'umore normale',
    highLabel: 'crollo totale, giornata nera',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: false,
    isCore: true,
  },
  {
    key: 'irritabilita',
    name: 'Irritabilità',
    lowLabel: 'tollerante, nessuno scatto',
    highLabel: 'intolleranza continua, esplosioni',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: false,
    isCore: true,
  },
  {
    key: 'tensione',
    name: 'Tensione / agitazione interna',
    lowLabel: 'calmo',
    highLabel: 'agitazione costante',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: false,
    isCore: true,
  },
  {
    key: 'ruminazione',
    name: 'Ruminazione',
    lowLabel: 'mente libera',
    highLabel: 'rimuginio martellante per ore',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: false,
    isCore: true,
  },
  {
    key: 'ossessioni',
    name: 'Intensità ossessioni',
    lowLabel: 'assenti',
    highLabel: 'ossessioni continue e invadenti',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: false,
    isCore: true,
  },
  {
    // Steps, not a count: counting compulsions exactly is itself a ritual
    key: 'compulsioni',
    name: 'Compulsioni',
    lowLabel: 'nessuna',
    highLabel: 'continue',
    levelLabels: ['nessuna', 'poche', 'molte', 'continue'],
    maxValue: 3,
    isPositive: false,
    isCore: false,
  },
  {
    key: 'energia',
    name: 'Energia',
    lowLabel: 'nessuna energia',
    highLabel: 'pieno di energia',
    levelLabels: [],
    maxValue: CHECK_IN_SCALE_MAX,
    isPositive: true,
    isCore: false,
  },
];

const INTENSITY_LADDER = [
  'assente',
  'appena percepibile',
  'lieve',
  'presente ma gestibile',
  'presente ma gestibile',
  'moderato',
  'moderato',
  'marcato',
  'marcato',
  'molto intenso',
  'al massimo',
];

const POSITIVE_LADDER = [
  'assente',
  'quasi nulla',
  'molto scarsa',
  'scarsa',
  'sotto la media',
  'nella media',
  'discreta',
  'buona',
  'molto buona',
  'ottima',
  'al massimo',
];

/**
 * Every slider shows the wording of the value, not just the number: `4 —
 * presente ma gestibile` is what makes two entries a week apart comparable.
 * Scales with their own levelLabels use those instead.
 */
export function describeScaleValue(
  value: number,
  maxValue: number = CHECK_IN_SCALE_MAX,
  isPositive = false,
  levelLabels: string[] = []
): string {
  if (levelLabels.length > 0) {
    return levelLabels[Math.min(Math.max(value, 0), levelLabels.length - 1)] ?? String(value);
  }
  const ladder = isPositive ? POSITIVE_LADDER : INTENSITY_LADDER;
  const safeMax = maxValue > 0 ? maxValue : CHECK_IN_SCALE_MAX;
  const ratio = Math.min(Math.max(value, 0), safeMax) / safeMax;
  return ladder[Math.round(ratio * (ladder.length - 1))] ?? String(value);
}
