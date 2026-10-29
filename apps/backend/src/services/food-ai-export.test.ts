import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { buildFoodAiPackage } from './food-ai-export.js';

describe('AI food export package', () => {
  it('preserves the CSV and includes machine-readable documentation plus a prompt', () => {
    const csv = '\uFEFFrecord_type,date,time\nquick_log,2026-07-30,17:06\n';
    const archive = buildFoodAiPackage(csv, {
      from: '2026-07-01',
      to: '2026-07-30',
      tzOffset: 120,
    });
    const files = unzipSync(archive);

    expect(Object.keys(files).sort()).toEqual([
      'LEGGIMI.md',
      'diario-alimentare.csv',
      'dizionario-campi.csv',
      'prompt-analisi.txt',
      'tipi-record.csv',
    ]);
    expect(files['diario-alimentare.csv']).toEqual(strToU8(csv));
    expect(strFromU8(files['LEGGIMI.md'])).toContain('UTC+02:00');
    expect(strFromU8(files['LEGGIMI.md'])).toContain('2026-07-01 - 2026-07-30');
    expect(strFromU8(files['dizionario-campi.csv'])).toContain('record_type,string,all');
    expect(strFromU8(files['tipi-record.csv'])).toContain(
      'intake,Registrazione di una assunzione prevista'
    );
    expect(strFromU8(files['prompt-analisi.txt'])).toContain(
      'almeno 21 osservazioni abbinate'
    );
  });

  it('carries the attached reports at the path the CSV points at, and says so in the readme', () => {
    const archive = buildFoodAiPackage('﻿record_type,date,time\n', { tzOffset: 0 }, [
      { path: 'referti/2026-08-25-emocromo.pdf', bytes: strToU8('%PDF-1.4 finto') },
    ]);
    const files = unzipSync(archive);

    expect(strFromU8(files['referti/2026-08-25-emocromo.pdf'])).toBe('%PDF-1.4 finto');
    // Without this line the folder is just there, and a model has no reason
    // to open anything in it
    expect(strFromU8(files['LEGGIMI.md'])).toContain('1 referto allegato');
  });

  it('says nothing about reports when none were included', () => {
    const files = unzipSync(buildFoodAiPackage('﻿record_type\n', { tzOffset: 0 }));
    expect(strFromU8(files['LEGGIMI.md'])).not.toContain('referti/');
  });
});
