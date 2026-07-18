import { describe, it, expect } from 'vitest';
import {
  classifyQuickLog,
  classifyQuickLogCategory,
  classifyQuickLogValence,
  extractSupplementNames,
  hasSupplementStopWord,
  defaultMealTypeForHour,
} from '@budget/shared';
import { buildFoodCsv, FOOD_CSV_HEADER } from './food-export.service.js';
import { toLocalParts, addDays, average, valenceFromScores } from './food-dashboard.service.js';

const BOM = '﻿';

describe('quick log classification (keyword dictionaries)', () => {
  it('classifies "corsa 40 min gambe pesanti" as WORKOUT / NEGATIVE (criterio 9)', () => {
    const { category, valence } = classifyQuickLog('corsa 40 min gambe pesanti');
    expect(category).toBe('WORKOUT');
    expect(valence).toBe('NEGATIVE');
  });

  it('classifies sleep notes', () => {
    expect(classifyQuickLogCategory('dormito male, sveglio alle 3')).toBe('SLEEP');
    expect(classifyQuickLogValence('dormito male, sveglio alle 3')).toBe('NEGATIVE');
  });

  it('classifies supplement notes', () => {
    expect(classifyQuickLogCategory('iniziato magnesio 300 mg')).toBe('SUPPLEMENT');
  });

  it('falls back to FEELING / NEUTRAL on unmatched text', () => {
    const { category, valence } = classifyQuickLog('giornata come le altre');
    expect(category).toBe('FEELING');
    expect(valence).toBe('NEUTRAL');
  });

  it('resolves mixed valences to NEUTRAL', () => {
    expect(classifyQuickLogValence('gambe pesanti ma testa lucida')).toBe('NEUTRAL');
  });

  it('is accent- and case-insensitive with word boundaries', () => {
    expect(classifyQuickLogCategory('PALESTRA fatta')).toBe('WORKOUT');
    // "ok" must not match inside other words
    expect(classifyQuickLogValence('okinawa')).toBe('NEUTRAL');
  });
});

describe('supplement period detection', () => {
  it('extracts supplement names, preferring the most specific', () => {
    expect(extractSupplementNames('iniziato omega 3 oggi')).toEqual(['omega 3']);
    expect(extractSupplementNames('preso magnesio e melatonina')).toEqual(
      expect.arrayContaining(['magnesio', 'melatonina'])
    );
  });

  it('detects stop words', () => {
    expect(hasSupplementStopWord('smesso magnesio')).toBe(true);
    expect(hasSupplementStopWord('iniziato magnesio')).toBe(false);
  });
});

describe('smart default meal type by hour', () => {
  it('maps the hour ranges from the spec', () => {
    expect(defaultMealTypeForHour(8)).toBe('BREAKFAST');
    expect(defaultMealTypeForHour(13)).toBe('LUNCH');
    expect(defaultMealTypeForHour(16)).toBe('SNACK');
    expect(defaultMealTypeForHour(20)).toBe('DINNER');
  });
});

describe('day-state helpers', () => {
  it('averages scores and handles the empty case as null (not zero)', () => {
    expect(average([1, 0, -1])).toBe(0);
    expect(average([1, 1, 0])).toBe(0.67);
    expect(average([])).toBeNull();
  });

  it('collapses day scores into a valence by sum sign', () => {
    expect(valenceFromScores([1, 1, -1])).toBe('POSITIVE');
    expect(valenceFromScores([-1])).toBe('NEGATIVE');
    expect(valenceFromScores([1, -1])).toBe('NEUTRAL');
    expect(valenceFromScores([])).toBeNull();
  });

  it('shifts instants into the local day via tzOffset', () => {
    // 23:30 UTC + 120 min (Italy summer) = 01:30 next day
    const parts = toLocalParts(new Date('2026-07-16T23:30:00Z'), 120);
    expect(parts.date).toBe('2026-07-17');
    expect(parts.hour).toBe(1);
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
  });
});

describe('CSV export', () => {
  const meals = [
    {
      date: '2026-07-16',
      mealType: 'LUNCH' as const,
      notes: 'con olio evo',
      createdAt: new Date('2026-07-16T11:10:00Z'), // 13:10 local (+120)
      items: [
        { foodName: 'pasta al pomodoro', quantity: 90, unit: 'G' as const },
        { foodName: 'insalata, mista', quantity: 1, unit: 'PORTION' as const },
      ],
    },
  ];
  const quickLogs = [
    {
      loggedAt: new Date('2026-07-16T12:40:00Z'), // 14:40 local
      text: 'sonnolento e fiacco',
      linkedMeal: { date: '2026-07-16', mealType: 'LUNCH' as const },
    },
  ];

  it('produces the specified header and one row per item, chronologically interleaved', () => {
    const csv = buildFoodCsv(meals, quickLogs, 120);
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[0]).toBe(FOOD_CSV_HEADER);
    expect(lines).toHaveLength(4); // header + 2 items + 1 quick log
    expect(lines[1]).toBe('meal_item,2026-07-16 13:10,pranzo,pasta al pomodoro,90,g,con olio evo,');
    // Fields containing commas are quoted
    expect(lines[2]).toContain('"insalata, mista"');
    // Quick log after the meal, with linked_meal valorized (criteri 7/8)
    expect(lines[3]).toBe('quick_log,2026-07-16 14:40,,,,,sonnolento e fiacco,2026-07-16 pranzo');
  });

  it('starts with a UTF-8 BOM so Excel opens it correctly', () => {
    expect(buildFoodCsv([], [], 0).startsWith(BOM)).toBe(true);
  });

  it('leaves quantity and unit empty when missing (criterio 4)', () => {
    const csv = buildFoodCsv(
      [
        {
          date: '2026-07-16',
          mealType: 'DINNER' as const,
          notes: null,
          createdAt: new Date('2026-07-16T19:00:00Z'),
          items: [{ foodName: 'minestrone', quantity: null, unit: null }],
        },
      ],
      [],
      0
    );
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[1]).toBe('meal_item,2026-07-16 19:00,cena,minestrone,,,,');
  });
});
