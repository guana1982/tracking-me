import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFoodText } from '@budget/shared';

/**
 * The side-effect vocabulary and the exam advisories live in a JSON file, not
 * in the code (§7 of the spec): they change with the therapy, and changing
 * them must not require a deploy of application logic.
 *
 * Read once and cached - the file is small and only changes between restarts.
 */
export interface TherapyConfig {
  sideEffects: {
    common: string[];
    byIngredient: Record<string, string[]>;
  };
  examAdvisories: string[];
}

const EMPTY_CONFIG: TherapyConfig = {
  sideEffects: { common: [], byIngredient: {} },
  examAdvisories: [],
};

const CONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'config',
  'therapy-config.json'
);

let cached: TherapyConfig | null = null;

export function loadTherapyConfig(): TherapyConfig {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<TherapyConfig>;
    cached = {
      sideEffects: {
        common: raw.sideEffects?.common ?? [],
        byIngredient: raw.sideEffects?.byIngredient ?? {},
      },
      examAdvisories: raw.examAdvisories ?? [],
    };
  } catch {
    // A missing or broken config must not take the module down: the user can
    // always add scales by hand, they just lose the suggestions
    cached = EMPTY_CONFIG;
  }
  return cached;
}

/**
 * Which side effects to propose, given what the user is actually taking.
 * Returns each name once, with the treatments that brought it up.
 */
export function suggestedSideEffects(
  treatments: { name: string; detail: string | null; form: string | null }[]
): Map<string, string[]> {
  const config = loadTherapyConfig();
  const found = new Map<string, string[]>();

  const add = (name: string, source: string) => {
    const sources = found.get(name);
    if (sources) {
      if (!sources.includes(source)) sources.push(source);
    } else {
      found.set(name, [source]);
    }
  };

  for (const treatment of treatments) {
    const haystack = normalizeFoodText(
      [treatment.name, treatment.detail, treatment.form].filter(Boolean).join(' ')
    );
    for (const [ingredient, names] of Object.entries(config.sideEffects.byIngredient)) {
      if (haystack.includes(normalizeFoodText(ingredient))) {
        for (const name of names) add(name, treatment.name);
      }
    }
  }

  // The common ones only make sense once something is actually being taken
  if (treatments.length > 0) {
    for (const name of config.sideEffects.common) add(name, 'terapia in corso');
  }
  return found;
}

export function examAdvisories(): string[] {
  return loadTherapyConfig().examAdvisories;
}
