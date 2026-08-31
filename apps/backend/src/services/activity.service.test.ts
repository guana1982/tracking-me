import { describe, expect, it } from 'vitest';
import type { ActivityDTO } from '@budget/shared';
import {
  activityRangeQuerySchema,
  createActivitySchema,
  reorderActivitiesSchema,
  resetActivityOrderSchema,
} from '@budget/shared';
import { splitActivities, weekStartForDate } from './activity.service.js';

function activity(overrides: Partial<ActivityDTO> & { id: string }): ActivityDTO {
  return {
    title: overrides.id,
    notes: null,
    kind: 'TASK',
    scope: 'DAY',
    scheduledFor: '2026-08-17',
    dueDate: null,
    dueTime: null,
    priority: 'MEDIUM',
    status: 'TODO',
    typeKey: null,
    typeName: null,
    typeColor: null,
    position: 0,
    isManuallyPositioned: false,
    completedAt: null,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    ...overrides,
  };
}

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

  it('accepts only a non-empty list of unique activity IDs for reordering', () => {
    expect(reorderActivitiesSchema.parse({ activityIds: ['activity-1', 'activity-2'] })).toEqual({
      activityIds: ['activity-1', 'activity-2'],
    });
    expect(() => reorderActivitiesSchema.parse({ activityIds: [] })).toThrow();
    expect(() =>
      reorderActivitiesSchema.parse({ activityIds: ['activity-1', 'activity-1'] })
    ).toThrow();
  });

  it('reads an empty reset as "everywhere", not as an error', () => {
    expect(resetActivityOrderSchema.parse({})).toEqual({});
    expect(resetActivityOrderSchema.parse({ activityIds: ['activity-1'] })).toEqual({
      activityIds: ['activity-1'],
    });
  });

  it('refuses a range that ends before it starts', () => {
    expect(activityRangeQuerySchema.parse({ from: '2026-08-01', to: '2026-08-31' })).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(() => activityRangeQuerySchema.parse({ from: '2026-08-31', to: '2026-08-01' })).toThrow();
  });

  describe('what a selected day is answerable for', () => {
    const date = '2026-08-17'; // a Monday
    const weekStart = weekStartForDate(date);

    it('keeps the day, its week and the open deadlines', () => {
      const result = splitActivities(
        [
          activity({ id: 'day', scheduledFor: date }),
          activity({ id: 'week', scope: 'WEEK', scheduledFor: weekStart }),
          activity({ id: 'deadline', kind: 'DEADLINE', dueDate: '2026-09-30', scheduledFor: '2026-09-30' }),
        ],
        date,
        weekStart
      );
      expect(result.today.map((entry) => entry.id)).toEqual(['day']);
      expect(result.week.map((entry) => entry.id)).toEqual(['week']);
      expect(result.deadlines.map((entry) => entry.id)).toEqual(['deadline']);
      expect(result.backlog).toEqual([]);
    });

    it('carries over what was left open earlier, day and week alike', () => {
      const result = splitActivities(
        [
          activity({ id: 'ieri', scheduledFor: '2026-08-16' }),
          activity({ id: 'settimana-scorsa', scope: 'WEEK', scheduledFor: '2026-08-10' }),
        ],
        date,
        weekStart
      );
      expect(result.backlog.map((entry) => entry.id)).toEqual(['ieri', 'settimana-scorsa']);
      expect(result.today).toEqual([]);
      expect(result.week).toEqual([]);
    });

    it('does not carry over what was already closed', () => {
      const result = splitActivities(
        [activity({ id: 'chiusa-ieri', scheduledFor: '2026-08-16', status: 'DONE' })],
        date,
        weekStart
      );
      expect(result.backlog).toEqual([]);
    });

    it('leaves the day itself in place even once it is done, so the day keeps its record', () => {
      const result = splitActivities(
        [activity({ id: 'fatta-oggi', scheduledFor: date, status: 'DONE' })],
        date,
        weekStart
      );
      expect(result.today.map((entry) => entry.id)).toEqual(['fatta-oggi']);
      expect(result.backlog).toEqual([]);
    });

    it('sinks the done ones, and otherwise follows the order the user arranged', () => {
      const result = splitActivities(
        [
          activity({ id: 'terza', position: 2 }),
          activity({ id: 'chiusa', position: 0, status: 'DONE' }),
          activity({ id: 'seconda', position: 1 }),
        ],
        date,
        weekStart
      );
      expect(result.today.map((entry) => entry.id)).toEqual(['seconda', 'terza', 'chiusa']);
    });

    it('lets priority and due date decide nothing: only the position does', () => {
      const result = splitActivities(
        [
          activity({ id: 'urgente-lontana', priority: 'URGENT', dueDate: '2026-08-18', position: 1 }),
          activity({ id: 'bassa-vicina', priority: 'LOW', dueDate: '2026-12-31', position: 0 }),
        ],
        date,
        weekStart
      );
      expect(result.today.map((entry) => entry.id)).toEqual(['bassa-vicina', 'urgente-lontana']);
    });

    it('orders deadlines by the same hand-made position, not by when they fall', () => {
      const result = splitActivities(
        [
          activity({ id: 'tardi', kind: 'DEADLINE', dueDate: '2026-12-31', scheduledFor: '2026-12-31', position: 0 }),
          activity({ id: 'presto', kind: 'DEADLINE', dueDate: '2026-08-20', scheduledFor: '2026-08-20', position: 1 }),
        ],
        date,
        weekStart
      );
      expect(result.deadlines.map((entry) => entry.id)).toEqual(['tardi', 'presto']);
    });
  });
});
