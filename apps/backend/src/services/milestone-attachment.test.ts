import { describe, expect, it } from 'vitest';
import { buildExportPaths } from './milestone-attachment.service.js';

describe('report paths inside the export archive', () => {
  it('names a file by its day and its declared type, not by what it happened to be called', () => {
    const [file] = buildExportPaths([
      { date: '2026-08-25', fileName: 'Referto Città 12/2026.PDF', mimeType: 'application/pdf' },
    ]);
    expect(file.exportPath).toBe('referti/2026-08-25-referto-citta-12-2026.pdf');
  });

  it('keeps two files of the same day apart', () => {
    const files = buildExportPaths([
      { date: '2026-08-25', fileName: 'emocromo.pdf', mimeType: 'application/pdf' },
      { date: '2026-08-25', fileName: 'emocromo.pdf', mimeType: 'application/pdf' },
    ]);
    expect(files.map((file) => file.exportPath)).toEqual([
      'referti/2026-08-25-emocromo.pdf',
      'referti/2026-08-25-emocromo-2.pdf',
    ]);
  });

  it('falls back to a usable name when there is nothing to slug', () => {
    const [file] = buildExportPaths([
      { date: '2026-08-25', fileName: '???.png', mimeType: 'image/png' },
    ]);
    expect(file.exportPath).toBe('referti/2026-08-25-referto.png');
  });
});
