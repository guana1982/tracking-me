// ============================================================
// Food Diary module - domain constants and keyword dictionaries
// ============================================================
// This file is THE single configuration point for the derived
// classification of quick logs (feature: keyword-based, no LLM).
// Extend the dictionaries here; derived fields on historical logs
// can be recomputed via POST /api/quick-logs/recalculate.

// ---------- Enums (codes in English, labels in Italian) ----------

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
export type DefaultMealTypeDTO = (typeof MEAL_TYPES)[number];
export type MealTypeDTO = string;

export const MEAL_ITEM_UNITS = ['G', 'ML', 'PIECES', 'PORTION', 'TBSP', 'CUP'] as const;
export type DefaultMealItemUnitDTO = (typeof MEAL_ITEM_UNITS)[number];
export type MealItemUnitDTO = string;

export const QUICK_LOG_CATEGORIES = ['WORKOUT', 'SLEEP', 'SUPPLEMENT', 'FEELING'] as const;
export type QuickLogCategoryDTO = (typeof QUICK_LOG_CATEGORIES)[number];

export const QUICK_LOG_VALENCES = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'] as const;
export type QuickLogValenceDTO = (typeof QUICK_LOG_VALENCES)[number];

// Italian labels (UI + CSV export use the lowercase form)
export const MEAL_TYPE_LABELS: Record<DefaultMealTypeDTO, string> = {
  BREAKFAST: 'colazione',
  LUNCH: 'pranzo',
  DINNER: 'cena',
  SNACK: 'spuntino',
};

export const MEAL_ITEM_UNIT_LABELS: Record<DefaultMealItemUnitDTO, string> = {
  G: 'g',
  ML: 'ml',
  PIECES: 'pezzi',
  PORTION: 'porzione',
  TBSP: 'cucchiai',
  CUP: 'tazza',
};

export const QUICK_LOG_CATEGORY_LABELS: Record<QuickLogCategoryDTO, string> = {
  WORKOUT: 'allenamento',
  SLEEP: 'sonno',
  SUPPLEMENT: 'integratore',
  FEELING: 'sensazione',
};

export const QUICK_LOG_VALENCE_LABELS: Record<QuickLogValenceDTO, string> = {
  POSITIVE: 'positiva',
  NEGATIVE: 'negativa',
  NEUTRAL: 'neutra',
};

// ---------- Product configuration (single point, easy to tune) ----------

export const FOOD_CONFIG = {
  // Quick log saved within this window after a meal insertion gets linked to it
  MEAL_LINK_WINDOW_HOURS: 4,
  // Day-state score per valence (dayState = simple average of the day's logs)
  VALENCE_SCORES: { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: -1 } as Record<QuickLogValenceDTO, number>,
  // SLEEP logs written before this hour describe the night that just ended and
  // belong to the same day; logs from this hour onwards affect the NEXT day
  SLEEP_ATTRIBUTION_HOUR: 12,
  // A dinner inserted at/after this hour counts as "cena dopo le 21"
  LATE_DINNER_HOUR: 21,
  // Comparison groups smaller than this get a low-reliability warning
  MIN_RELIABLE_GROUP_DAYS: 7,
  // Default smart meal-type by insertion hour: <11 colazione, 11-15 pranzo,
  // >=18 cena, otherwise spuntino
  MEAL_TYPE_HOURS: { BREAKFAST_BEFORE: 11, LUNCH_UNTIL: 15, DINNER_FROM: 18 },
  // How many frequent meals to propose as prefill
  FREQUENT_MEALS_LIMIT: 8,
} as const;

// ---------- Keyword dictionaries (Italian, matched case/accent-insensitive) ----------

// Category: first the specific ones; anything unmatched falls back to FEELING.
// Ties are resolved by match count, then by the priority order below.
export const QUICK_LOG_CATEGORY_KEYWORDS: Record<Exclude<QuickLogCategoryDTO, 'FEELING'>, string[]> = {
  WORKOUT: [
    'corsa', 'corso', 'corsetta', 'pesi', 'palestra', 'allenamento', 'allenato', 'allenata',
    'bici', 'bicicletta', 'nuoto', 'piscina', 'km', 'workout', 'esercizi', 'cardio',
    'camminata', 'trekking', 'calcio', 'calcetto', 'tennis', 'padel', 'yoga', 'stretching',
    'tapis roulant', 'squat', 'panca', 'trazioni', 'flessioni',
  ],
  SLEEP: [
    'dormito', 'dormire', 'sonno', 'letto', 'notte', 'nottata', 'sveglio', 'sveglia',
    'svegliato', 'svegliata', 'insonnia', 'riposato', 'riposata', 'addormentato',
    'addormentata', 'pisolino', 'russato', 'incubi', 'mezzanotte',
  ],
  SUPPLEMENT: [
    'integratore', 'integratori', 'iniziato', 'smesso', 'magnesio', 'creatina', 'omega',
    'vitamina', 'proteine', 'mg', 'compressa', 'compresse', 'capsula', 'capsule',
    'melatonina', 'zinco', 'ferro', 'multivitaminico', 'probiotici', 'ashwagandha', 'collagene',
  ],
};

// Priority when match counts tie (a supplement name is the strongest signal)
export const QUICK_LOG_CATEGORY_PRIORITY: Exclude<QuickLogCategoryDTO, 'FEELING'>[] = [
  'SUPPLEMENT',
  'WORKOUT',
  'SLEEP',
];

// Valence: match in both lists (or in none) resolves to NEUTRAL
export const QUICK_LOG_VALENCE_KEYWORDS: Record<Exclude<QuickLogValenceDTO, 'NEUTRAL'>, string[]> = {
  POSITIVE: [
    'bene', 'benissimo', 'ok', 'lucido', 'lucida', 'forza', 'energia', 'energico', 'energica',
    'carico', 'carica', 'riposato', 'riposata', 'leggero', 'leggera', 'fresco', 'fresca',
    'ottimo', 'ottima', 'top', 'forte', 'sereno', 'serena', 'rilassato', 'rilassata',
    'pimpante', 'in forma',
  ],
  NEGATIVE: [
    'fiacco', 'fiacca', 'stanco', 'stanca', 'stanchissimo', 'stanchissima', 'male', 'malissimo',
    'ko', 'pesante', 'pesanti', 'pesantezza', 'sonnolento', 'sonnolenta', 'gonfio', 'gonfia',
    'spossato', 'spossata', 'nervoso', 'nervosa', 'stressato', 'stressata', 'affaticato',
    'affaticata', 'dolori', 'dolore', 'mal di', 'insonnia', 'svogliato', 'svogliata',
    'esausto', 'esausta', 'distrutto', 'distrutta', 'stanco morto', 'nausea', 'acidità',
  ],
};

// Supplement period detection: a SUPPLEMENT log containing one of these names
// opens a period for that name; a later log with the same name plus a stop
// word closes it. No stop word ever seen = period still running.
export const SUPPLEMENT_NAMES = [
  'magnesio', 'creatina', 'omega 3', 'omega', 'vitamina d', 'vitamina c', 'vitamina b12',
  'vitamina', 'melatonina', 'zinco', 'ferro', 'multivitaminico', 'probiotici', 'proteine',
  'ashwagandha', 'collagene',
] as const;

export const SUPPLEMENT_STOP_WORDS = [
  'smesso', 'smetto', 'finito', 'finita', 'finite', 'finiti', 'stop', 'sospeso', 'sospendo', 'basta',
] as const;

// ---------- Matching helpers (pure, shared by backend and tests) ----------

/** Lowercase + strip accents so "sonnolento" matches "Sonnolènto" */
export function normalizeFoodText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word (or whole-phrase) match on already-normalized text */
export function matchesKeyword(normalizedText: string, keyword: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizeFoodText(keyword))}($|[^a-z0-9])`);
  return pattern.test(normalizedText);
}

function countMatches(normalizedText: string, keywords: readonly string[]): number {
  return keywords.reduce((count, kw) => (matchesKeyword(normalizedText, kw) ? count + 1 : count), 0);
}

export function classifyQuickLogCategory(text: string): QuickLogCategoryDTO {
  const normalized = normalizeFoodText(text);
  let best: QuickLogCategoryDTO = 'FEELING';
  let bestCount = 0;
  // Iterate in priority order so ties keep the strongest signal
  for (const category of QUICK_LOG_CATEGORY_PRIORITY) {
    const count = countMatches(normalized, QUICK_LOG_CATEGORY_KEYWORDS[category]);
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export function classifyQuickLogValence(text: string): QuickLogValenceDTO {
  const normalized = normalizeFoodText(text);
  const positive = countMatches(normalized, QUICK_LOG_VALENCE_KEYWORDS.POSITIVE);
  const negative = countMatches(normalized, QUICK_LOG_VALENCE_KEYWORDS.NEGATIVE);
  if (positive > 0 && negative === 0) return 'POSITIVE';
  if (negative > 0 && positive === 0) return 'NEGATIVE';
  return 'NEUTRAL';
}

export function classifyQuickLog(text: string): {
  category: QuickLogCategoryDTO;
  valence: QuickLogValenceDTO;
} {
  return {
    category: classifyQuickLogCategory(text),
    valence: classifyQuickLogValence(text),
  };
}

/** Supplement names mentioned in the text (longest names checked first) */
export function extractSupplementNames(text: string): string[] {
  const normalized = normalizeFoodText(text);
  const found: string[] = [];
  const byLength = [...SUPPLEMENT_NAMES].sort((a, b) => b.length - a.length);
  for (const name of byLength) {
    if (matchesKeyword(normalized, name)) {
      // Skip generic names already covered by a specific match ("omega" vs "omega 3")
      if (!found.some((f) => f.includes(name))) found.push(name);
    }
  }
  return found;
}

export function hasSupplementStopWord(text: string): boolean {
  const normalized = normalizeFoodText(text);
  return SUPPLEMENT_STOP_WORDS.some((word) => matchesKeyword(normalized, word));
}

/** Smart default meal type from the insertion hour (0-23) */
export function defaultMealTypeForHour(hour: number): MealTypeDTO {
  const { BREAKFAST_BEFORE, LUNCH_UNTIL, DINNER_FROM } = FOOD_CONFIG.MEAL_TYPE_HOURS;
  if (hour < BREAKFAST_BEFORE) return 'BREAKFAST';
  if (hour <= LUNCH_UNTIL) return 'LUNCH';
  if (hour >= DINNER_FROM) return 'DINNER';
  return 'SNACK';
}
