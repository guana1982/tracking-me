import { describe, expect, it } from 'vitest';
import { createActivitySchema } from '@budget/shared';
import { weekStartForDate } from './activity.service.js';

describe('activities', () => {
  it('normalizes dates to the Monday of their ISO week', () => {
    expect(weekStartForDate('2026-08-15')).toBe('2026-08-10');
    expect(weekStartForDate('2026-08-16')).toBe('2026-08-10');
    expect(weekStartForDate('2026-08-17')).toBe('2026-08-17');
    expect(weekStartForDate('2027-01-01')).toBe('2026-12-28');
  });

  it('requires a date for deadlines and validates local times', () => {
    expect(() =>
      createActivitySchema.parse({
        title: 'Rinnova documento',
        kind: 'DEADLINE',
        scheduledFor: '2026-08-15',
      })
    ).toThrow();
    expect(() =>
      createActivitySchema.parse({
        title: 'Telefonata',
        scheduledFor: '2026-08-15',
        dueTime: '25:00',
      })
    ).toThrow();
  });
});
