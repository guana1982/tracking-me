import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildObsidianVault,
  groupByDate,
  renderDay,
  serializeFrontmatter,
  type ObsidianRecord,
} from './obsidian-export.js';
import { buildFoodCsv, FOOD_CSV_HEADER } from './food-export.service.js';

const BOM = '﻿';

/** The frontmatter block, without the fences */
function frontmatter(markdown: string): string {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('frontmatter mancante');
  return match[1];
}

function property(markdown: string, key: string): string | null {
  const line = frontmatter(markdown)
    .split('\n')
    .find((entry) => entry.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).trim() : null;
}

const dayNote = (date: string, time: string, text: string): ObsidianRecord => ({
  recordType: 'day_note',
  date,
  time,
  summary: text,
  text,
});

describe('Obsidian export - a full day', () => {
  const records: ObsidianRecord[] = [
    dayNote('2026-08-25', '07:30', 'Oggi ho fatto le analisi del sangue.'),
    {
      recordType: 'weight',
      date: '2026-08-25',
      time: null,
      summary: 'Peso 80.1 kg',
      weightKg: 80.1,
      note: null,
    },
    {
      recordType: 'rating',
      date: '2026-08-25',
      time: '08:00',
      summary: 'Sonno 5/10',
      name: 'Sonno',
      value: 5,
      maxValue: 10,
      note: 'Temporale di notte.',
      linkedText: null,
    },
    {
      recordType: 'mood_log',
      date: '2026-08-25',
      time: '07:56',
      summary: 'poca voglia',
      text: 'poca voglia',
    },
    {
      recordType: 'meal',
      date: '2026-08-25',
      time: '09:00',
      summary: 'Colazione',
      mealTypeName: 'Colazione',
      notes: null,
      items: [
        { foodName: 'Caffè', quantity: 1, unitName: 'tazzina' },
        { foodName: 'Musli', quantity: 5, unitName: 'cucchiai' },
      ],
    },
    {
      recordType: 'intake',
      date: '2026-08-25',
      time: '11:25',
      summary: 'Sertralina',
      treatmentName: 'Sertralina',
      doseLabel: '50 mg',
      slotName: 'Colazione',
      status: 'TAKEN',
    },
    {
      recordType: 'activity',
      date: '2026-08-25',
      time: null,
      summary: 'Comprare soluzione per scope',
      title: 'Comprare soluzione per scope',
      notes: null,
      typeName: 'Casa',
      scopeLabel: 'Giornata',
      priorityLabel: 'Media',
      status: 'TODO',
    },
  ];

  const [day] = groupByDate(records, new Map([['2026-08-25', { bodyState: 0.4, moodState: -0.2, mealCount: 1 }]]));
  const markdown = renderDay(day);

  it('opens with valid frontmatter and a readable Italian title', () => {
    expect(markdown.startsWith('---\n')).toBe(true);
    expect(property(markdown, 'date')).toBe('"2026-08-25"');
    expect(property(markdown, 'type')).toBe('"diario"');
    expect(markdown).toContain('# 25 agosto 2026');
  });

  it('keeps daily numbers as numbers, so Obsidian can filter on them', () => {
    expect(property(markdown, 'weight')).toBe('80.1');
    expect(property(markdown, 'meal_count')).toBe('1');
    expect(property(markdown, 'body_state')).toBe('0.4');
    expect(property(markdown, 'mood_state')).toBe('-0.2');
    // One key per characteristic voted, so a year of "Sonno" can be charted
    expect(property(markdown, 'rating_sonno')).toBe('5');
  });

  it('renders every kind of record it was given', () => {
    expect(markdown).toContain('## 📝 Nota della giornata');
    expect(markdown).toContain('## ⚖️ Peso');
    expect(markdown).toContain('**80,1 kg**');
    expect(markdown).toContain('## 😴 Sonno');
    expect(markdown).toContain('**5/10**');
    expect(markdown).toContain('## 🧠 Umore');
    expect(markdown).toContain('## 🍽️ Alimentazione');
    expect(markdown).toContain('### ☕ Colazione — 09:00');
    expect(markdown).toContain('- Caffè — 1 tazzina');
    expect(markdown).toContain('## 💊 Assunzioni');
    expect(markdown).toContain('## ✅ Attività');
  });

  it('does not put single food items into the properties', () => {
    expect(frontmatter(markdown)).not.toContain('Caffè');
    expect(frontmatter(markdown)).not.toContain('Musli');
  });
});

describe('Obsidian export - partial days', () => {
  it('renders only the sections it has data for', () => {
    const [day] = groupByDate([dayNote('2026-08-25', '20:00', 'Solo una nota, oggi.')]);
    const markdown = renderDay(day);

    expect(markdown).toContain('## 📝 Nota della giornata');
    expect(markdown).not.toContain('## ⚖️ Peso');
    expect(markdown).not.toContain('## 🍽️ Alimentazione');
    expect(markdown).not.toContain('## ✅ Attività');
    // Nothing measured means nothing claimed: no empty or zero properties
    expect(property(markdown, 'weight')).toBeNull();
    expect(property(markdown, 'meal_count')).toBeNull();
    expect(property(markdown, 'body_state')).toBeNull();
  });
});

describe('Obsidian export - ordering', () => {
  it('lists several records of the same kind in the order they happened', () => {
    const [day] = groupByDate([
      dayNote('2026-08-25', '18:00', 'terza'),
      dayNote('2026-08-25', '07:00', 'prima'),
      dayNote('2026-08-25', '12:00', 'seconda'),
    ]);
    const markdown = renderDay(day);

    expect(markdown.indexOf('prima')).toBeLessThan(markdown.indexOf('seconda'));
    expect(markdown.indexOf('seconda')).toBeLessThan(markdown.indexOf('terza'));
  });

  it('averages repeated votes of the same characteristic into one property', () => {
    const vote = (time: string, value: number): ObsidianRecord => ({
      recordType: 'rating',
      date: '2026-08-25',
      time,
      summary: `Umore ${value}`,
      name: 'Umore',
      value,
      maxValue: 10,
      note: null,
      linkedText: null,
    });
    const [day] = groupByDate([vote('08:00', 5), vote('14:00', 7), vote('20:00', 6)]);
    const markdown = renderDay(day);

    expect(property(markdown, 'rating_umore')).toBe('6');
    expect(markdown).toContain('- 08:00 — **5/10**');
    expect(markdown).toContain('- 20:00 — **6/10**');
  });
});

describe('Obsidian export - hostile text', () => {
  it('keeps the frontmatter valid whatever the note contains', () => {
    const nasty = 'Titolo: "virgolette", # cancelletto, l\'apostrofo\ne un a capo — 🙂';
    const [day] = groupByDate([
      dayNote('2026-08-25', '09:00', nasty),
      {
        recordType: 'rating',
        date: '2026-08-25',
        time: '09:00',
        // A name full of punctuation must still produce a usable property key
        summary: 'x',
        name: 'Umore: "mattina"',
        value: 4,
        maxValue: 5,
        note: null,
        linkedText: null,
      },
    ]);
    const markdown = renderDay(day);
    const block = frontmatter(markdown);

    // Exactly one frontmatter block, and nothing from the note leaked into it
    expect(markdown.match(/^---$/gm)?.length).toBe(2);
    expect(block).not.toContain('cancelletto');
    expect(block).toContain('rating_umore_mattina: 4');
    // The note itself survives intact in the body
    expect(markdown).toContain('l\'apostrofo');
    expect(markdown).toContain('🙂');
  });

  it('does not let a multi-line note break a list item', () => {
    const [day] = groupByDate([
      {
        recordType: 'mood_log',
        date: '2026-08-25',
        time: '09:00',
        summary: 'x',
        text: 'prima riga\nseconda riga',
      },
    ]);
    const markdown = renderDay(day);
    expect(markdown).toContain('- 09:00 — prima riga seconda riga');
  });
});

describe('Obsidian export - planned is not done', () => {
  it('leaves a planned exam and an open task unticked', () => {
    const [day] = groupByDate([
      {
        recordType: 'milestone',
        date: '2026-09-30',
        time: null,
        summary: 'ECG',
        kindLabel: 'Esame',
        title: 'ECG',
        items: [],
        advisories: ['niente sforzi 72 h prima'],
        notes: null,
        isDone: false,
      },
      {
        recordType: 'activity',
        date: '2026-09-30',
        time: null,
        summary: 'Prenotare',
        title: 'Prenotare',
        notes: null,
        typeName: null,
        scopeLabel: 'Giornata',
        priorityLabel: 'Alta',
        status: 'IN_PROGRESS',
      },
      {
        recordType: 'intake',
        date: '2026-09-30',
        time: '08:00',
        summary: 'Sertralina',
        treatmentName: 'Sertralina',
        doseLabel: '50 mg',
        slotName: 'Colazione',
        status: 'SKIPPED',
      },
    ]);
    const markdown = renderDay(day);

    expect(markdown).toContain('- [ ] Esame: ECG');
    expect(markdown).not.toContain('- [x] Esame: ECG');
    // In progress is not finished
    expect(markdown).toContain('- [ ] Prenotare');
    expect(markdown).toContain('in corso');
    expect(markdown).toContain('non presa');
    expect(markdown).not.toContain('- [x] Sertralina');
    expect(property(markdown, 'intakes_skipped')).toBe('1');
  });
});

describe('Obsidian export - unknown record types', () => {
  it('never drops a record whose type has no renderer of its own', () => {
    // Cast on purpose: this is the case of a record type added upstream before
    // anybody wrote a section for it
    const stranger = {
      recordType: 'sleep_tracker',
      date: '2026-08-25',
      time: '23:10',
      summary: 'Sonno profondo 1h40',
    } as unknown as ObsidianRecord;

    const [day] = groupByDate([stranger, dayNote('2026-08-25', '09:00', 'ciao')]);
    const markdown = renderDay(day);

    expect(markdown).toContain('## 📎 Altri dati');
    expect(markdown).toContain('- 23:10 — Sonno profondo 1h40');
  });
});

describe('Obsidian export - the vault', () => {
  it('writes one Markdown file per day under Diario/', () => {
    const days = groupByDate([
      dayNote('2026-08-23', '09:00', 'lunedì'),
      dayNote('2026-08-24', '09:00', 'martedì'),
      dayNote('2026-08-25', '09:00', 'mercoledì'),
    ]);
    const files = unzipSync(buildObsidianVault(days));

    expect(Object.keys(files).sort()).toEqual([
      'Diario/2026-08-23.md',
      'Diario/2026-08-24.md',
      'Diario/2026-08-25.md',
    ]);
    expect(strFromU8(files['Diario/2026-08-24.md'])).toContain('# 24 agosto 2026');
    expect(strFromU8(files['Diario/2026-08-24.md'])).toContain('martedì');
  });
});

describe('Obsidian export - frontmatter serializer', () => {
  it('keeps types distinct and quotes every string', () => {
    const yaml = serializeFrontmatter([
      ['date', '2026-08-25'],
      ['weight', 80.1],
      ['done', true],
      ['tags', ['diario', 'alimentazione']],
    ]);
    expect(yaml).toBe(
      ['---', 'date: "2026-08-25"', 'weight: 80.1', 'done: true', 'tags:', '  - "diario"', '  - "alimentazione"', '---'].join('\n')
    );
  });
});

describe('the CSV export is untouched by all of this', () => {
  it('still produces the same header and the same rows', () => {
    const csv = buildFoodCsv(
      [
        {
          date: '2026-07-16',
          mealType: 'LUNCH',
          notes: 'con olio evo',
          createdAt: new Date('2026-07-16T11:10:00Z'),
          items: [{ foodName: 'pasta al pomodoro', quantity: 90, unit: 'G' }],
        },
      ],
      [
        {
          loggedAt: new Date('2026-07-16T12:40:00Z'),
          text: 'sonnolento e fiacco',
          category: 'FEELING',
          valence: 'NEGATIVE',
          linkedMeal: { date: '2026-07-16', mealType: 'LUNCH' },
        },
      ],
      120
    );
    const lines = csv.replace(BOM, '').trim().split('\n');

    expect(lines[0]).toBe(FOOD_CSV_HEADER);
    expect(lines[1]).toBe(
      'meal_item,2026-07-16,13:10,,,pranzo,pasta al pomodoro,90,g,con olio evo,,,,,,'
    );
    expect(lines[2]).toBe(
      'quick_log,2026-07-16,14:40,sensazione,negativa,,,,,sonnolento e fiacco,2026-07-16 pranzo,,,,,'
    );
  });
});
