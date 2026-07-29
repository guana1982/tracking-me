import { describe, it, expect } from 'vitest';
import {
  classifyQuickLog,
  classifyQuickLogCategory,
  classifyQuickLogValence,
  extractSupplementNames,
  hasSupplementStopWord,
  defaultMealTypeForHour,
  describeScaleValue,
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

  it('classifies mood notes as MOOD, separate from physical sensations', () => {
    expect(classifyQuickLogCategory('ansia e irritabilità tutto il giorno')).toBe('MOOD');
    expect(classifyQuickLogValence('ansia e irritabilità tutto il giorno')).toBe('NEGATIVE');
    expect(classifyQuickLogCategory('tranquillità e benessere')).toBe('MOOD');
    expect(classifyQuickLogValence('tranquillità e benessere')).toBe('POSITIVE');
    // A physical note stays physical even when the mood dictionary could match
    expect(classifyQuickLogCategory('gambe pesanti dopo la corsa')).toBe('WORKOUT');
    expect(classifyQuickLogCategory('dormito male, nottata agitata')).toBe('SLEEP');
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
      category: 'FEELING' as const,
      valence: 'NEGATIVE' as const,
      linkedMeal: { date: '2026-07-16', mealType: 'LUNCH' as const },
    },
  ];

  it('produces the specified header and one row per item, chronologically interleaved', () => {
    const csv = buildFoodCsv(meals, quickLogs, 120);
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[0]).toBe(FOOD_CSV_HEADER);
    expect(lines).toHaveLength(4); // header + 2 items + 1 quick log
    expect(lines[1]).toBe(
      'meal_item,2026-07-16,13:10,,,pranzo,pasta al pomodoro,90,g,con olio evo,,,,,,'
    );
    // Fields containing commas are quoted
    expect(lines[2]).toContain('"insalata, mista"');
    // Quick log after the meal, with category/valence and linked_meal (criteri 7/8)
    expect(lines[3]).toBe(
      'quick_log,2026-07-16,14:40,sensazione,negativa,,,,,sonnolento e fiacco,2026-07-16 pranzo,,,,,'
    );
  });

  it('marks mood notes with their own record_type, keeping the tracks separable', () => {
    const csv = buildFoodCsv(
      [],
      [
        {
          loggedAt: new Date('2026-07-16T08:00:00Z'), // 10:00 local
          text: 'ansia dal mattino',
          category: 'MOOD' as const,
          valence: 'NEGATIVE' as const,
          linkedMeal: null,
        },
      ],
      120
    );
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[1]).toBe(
      'mood_log,2026-07-16,10:00,umore,negativa,,,,,ansia dal mattino,,,,,,'
    );
  });

  it('opens each tracked day with a day_summary carrying both day scores', () => {
    const csv = buildFoodCsv(meals, quickLogs, 120, [
      { date: '2026-07-16', bodyState: -1, moodState: 0.5, mealCount: 1 },
    ]);
    const lines = csv.replace(BOM, '').trim().split('\n');
    // The summary sorts first within its day, before the meal rows
    expect(lines[1]).toBe('day_summary,2026-07-16,00:00,,,,,,,1 pasti registrati,,-1,0.5,,,');
    expect(lines[2]).toContain('meal_item');
  });

  it('leaves a day score empty when that track was not logged', () => {
    const csv = buildFoodCsv([], [], 0, [
      { date: '2026-07-16', bodyState: null, moodState: 0.5, mealCount: 0 },
    ]);
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[1]).toBe('day_summary,2026-07-16,00:00,,,,,,,0 pasti registrati,,,0.5,,,');
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
    expect(lines[1]).toBe('meal_item,2026-07-16,19:00,,,cena,minestrone,,,,,,,,,');
  });

  it('records an intake with its moment in meal_type, so it lines up with the meal', () => {
    const csv = buildFoodCsv(
      [],
      [],
      0,
      [],
      [
        {
          date: '2026-07-16',
          loggedAt: new Date('2026-07-16T07:05:00Z'),
          treatmentName: 'Sertralina 50 mg',
          doseLabel: '½ cp',
          slotName: 'Colazione',
          status: 'TAKEN' as const,
        },
      ]
    );
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines[1]).toBe(
      'intake,2026-07-16,07:05,Sertralina 50 mg,,Colazione,,,,½ cp,,,,,,preso'
    );
  });

  it('writes one checkin row per scale, with its wording and direction', () => {
    const csv = buildFoodCsv(
      [],
      [],
      0,
      [],
      [],
      [
        {
          date: '2026-07-16',
          loggedAt: new Date('2026-07-16T21:30:00Z'),
          values: [
            { key: 'tensione', name: 'Tensione', value: 4, maxValue: 10, isPositive: false },
            { key: 'energia', name: 'Energia', value: 8, maxValue: 10, isPositive: true },
          ],
          note: 'giornata pesante',
        },
      ]
    );
    const lines = csv.replace(BOM, '').trim().split('\n');
    // A symptom scale is flagged "negativo": lower is better
    expect(lines[1]).toBe(
      'checkin,2026-07-16,21:30,Tensione,negativo,,,,,presente ma gestibile,,,,4,10,'
    );
    // The single positive scale reads the other way round
    expect(lines[2]).toBe('checkin,2026-07-16,21:30,Energia,positivo,,,,,molto buona,,,,8,10,');
    // The note closes the check-in block
    expect(lines[3]).toBe('checkin,2026-07-16,21:30,nota,,,,,,giornata pesante,,,,,,');
  });

  it('records a diary vote at the minute it was given, skipping empty rows', () => {
    const csv = buildFoodCsv(
      [],
      [],
      0,
      [],
      [],
      [],
      [
        {
          date: '2026-07-16',
          loggedAt: new Date('2026-07-16T13:30:00Z'),
          ratingName: 'Umore',
          value: 7,
          maxValue: 10,
          note: 'giornata ok',
        },
        // Only a linked mood entry: already exported as its own mood_log
        {
          date: '2026-07-16',
          loggedAt: new Date('2026-07-16T14:00:00Z'),
          ratingName: 'Allenamento',
          value: null,
          maxValue: 10,
          note: null,
        },
      ]
    );
    const lines = csv.replace(BOM, '').trim().split('\n');
    expect(lines).toHaveLength(2); // header + the only row with something to say
    expect(lines[1]).toBe('rating,2026-07-16,13:30,Umore,,,,,,giornata ok,,,,7,10,');
  });

  it('uses the named steps of a scale instead of the generic wording', () => {
    const label = describeScaleValue(2, 3, false, ['nessuna', 'poche', 'molte', 'continue']);
    expect(label).toBe('molte');
    // Out-of-range answers clamp instead of producing undefined
    expect(describeScaleValue(9, 3, false, ['nessuna', 'poche'])).toBe('poche');
  });
});
