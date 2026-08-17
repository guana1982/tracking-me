import { randomUUID } from 'node:crypto';
import type { Activity, ActivityType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { DEFAULT_ACTIVITY_TYPES } from '@budget/shared';
import type {
  ActivityDayCountDTO,
  ActivityDTO,
  ActivityKindDTO,
  ActivityOverviewDTO,
  ActivityPriorityDTO,
  ActivityTypeDTO,
  CreateActivityDTO,
  CreateActivityTypeDTO,
  UpdateActivityDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';

type ActivityWithType = Activity & { type: ActivityType | null };

const PRIORITY_WEIGHT: Record<ActivityPriorityDTO, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  const value = dateOnly(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return toIsoDate(value);
}

/** Monday of the ISO week containing a plain calendar date. */
export function weekStartForDate(date: string): string {
  const value = dateOnly(date);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return toIsoDate(value);
}

function sortActivities(left: ActivityDTO, right: ActivityDTO): number {
  if (left.isManuallyPositioned && right.isManuallyPositioned) {
    return left.position - right.position || left.createdAt.localeCompare(right.createdAt);
  }
  if (left.isManuallyPositioned !== right.isManuallyPositioned) {
    return left.isManuallyPositioned ? -1 : 1;
  }
  if (left.status === 'DONE' && right.status !== 'DONE') return 1;
  if (left.status !== 'DONE' && right.status === 'DONE') return -1;
  const priority = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priority !== 0) return priority;
  return left.position - right.position || left.createdAt.localeCompare(right.createdAt);
}

function sortDeadlines(left: ActivityDTO, right: ActivityDTO): number {
  if (left.isManuallyPositioned && right.isManuallyPositioned) {
    return left.position - right.position || left.createdAt.localeCompare(right.createdAt);
  }
  if (left.isManuallyPositioned !== right.isManuallyPositioned) {
    return left.isManuallyPositioned ? -1 : 1;
  }
  if (left.status === 'DONE' && right.status !== 'DONE') return 1;
  if (left.status !== 'DONE' && right.status === 'DONE') return -1;
  const byDate = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');
  if (byDate !== 0) return byDate;
  const byTime = (left.dueTime ?? '23:59').localeCompare(right.dueTime ?? '23:59');
  if (byTime !== 0) return byTime;
  return PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
}

/**
 * Splits what was loaded into the four lists the page shows. Pure, because the
 * rule that decides where a task lands is the substance of the page and has to
 * be checkable without a database.
 */
export function splitActivities(activities: ActivityDTO[], date: string, weekStart: string) {
  const today = activities
    .filter(
      (activity) =>
        activity.kind === 'TASK' && activity.scope === 'DAY' && activity.scheduledFor === date
    )
    .sort(sortActivities);
  const week = activities
    .filter(
      (activity) =>
        activity.kind === 'TASK' && activity.scope === 'WEEK' && activity.scheduledFor === weekStart
    )
    .sort(sortActivities);
  const deadlines = activities
    .filter((activity) => activity.kind === 'DEADLINE')
    .sort(sortDeadlines);
  const backlog = activities
    .filter(
      (activity) =>
        activity.kind === 'TASK' &&
        activity.status !== 'DONE' &&
        (activity.scope === 'WEEK'
          ? activity.scheduledFor < weekStart
          : activity.scheduledFor < date)
    )
    .sort(sortActivities);

  return { today, week, deadlines, backlog };
}

class ActivityService {
  /**
   * Everything the selected date is answerable for. A task planned for a later
   * day is deliberately absent: it belongs to its own day, and showing it here
   * would make the calendar decorative. Nothing gets lost, because what was
   * left open earlier comes back as backlog.
   */
  async getOverview(userId: string, date: string): Promise<ActivityOverviewDTO> {
    const weekStart = weekStartForDate(date);
    const weekEnd = addDays(weekStart, 6);
    const selectedDay = dateOnly(date);
    const weekStartDay = dateOnly(weekStart);
    const weekEndDay = dateOnly(weekEnd);
    const dayAfterWeekEnd = dateOnly(addDays(weekEnd, 1));

    const records = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          // The day and the week themselves, completed items included: they are
          // the record of what that day was, and hiding them would erase it
          { kind: 'TASK', scope: 'DAY', scheduledFor: selectedDay },
          { kind: 'TASK', scope: 'WEEK', scheduledFor: weekStartDay },
          // Still open from before: a task does not stop existing at midnight
          { kind: 'TASK', scope: 'DAY', scheduledFor: { lt: selectedDay }, status: { not: 'DONE' } },
          {
            kind: 'TASK',
            scope: 'WEEK',
            scheduledFor: { lt: weekStartDay },
            status: { not: 'DONE' },
          },
          // A deadline is forward-looking by nature: while it is open it is
          // relevant from whatever day you are standing on
          { kind: 'DEADLINE', status: { not: 'DONE' } },
          {
            kind: 'DEADLINE',
            status: 'DONE',
            OR: [
              { dueDate: { gte: weekStartDay, lte: weekEndDay } },
              { completedAt: { gte: weekStartDay, lt: dayAfterWeekEnd } },
            ],
          },
        ],
      },
      include: { type: true },
    });

    const mapped = records.map((activity) => this.toDTO(activity));
    const { today, week, deadlines, backlog } = splitActivities(mapped, date, weekStart);

    return {
      date,
      weekStart,
      weekEnd,
      all: mapped,
      today,
      week,
      deadlines,
      backlog,
      summary: {
        todayCompleted: today.filter((activity) => activity.status === 'DONE').length,
        todayTotal: today.length,
        weekCompleted: week.filter((activity) => activity.status === 'DONE').length,
        weekTotal: week.length,
        // A task with a date on it can run late exactly like a deadline can
        overdue: mapped.filter(
          (activity) =>
            activity.status !== 'DONE' && activity.dueDate !== null && activity.dueDate < date
        ).length,
        backlog: backlog.length,
      },
    };
  }

  /**
   * Per-day load for the month grid. Deadlines are counted on the day they are
   * due; week tasks are left out, since they belong to a week and not to any
   * one of its days.
   */
  async countsByDay(userId: string, from: string, to: string): Promise<ActivityDayCountDTO[]> {
    const fromDay = dateOnly(from);
    const toDay = dateOnly(to);
    const records = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          { kind: 'TASK', scope: 'DAY', scheduledFor: { gte: fromDay, lte: toDay } },
          { kind: 'DEADLINE', dueDate: { gte: fromDay, lte: toDay } },
        ],
      },
      select: { kind: true, scheduledFor: true, dueDate: true, status: true },
    });

    const byDate = new Map<string, ActivityDayCountDTO>();
    for (const record of records) {
      const day = toIsoDate(record.kind === 'DEADLINE' ? record.dueDate ?? record.scheduledFor : record.scheduledFor);
      const entry = byDate.get(day) ?? { date: day, open: 0, done: 0, deadlines: 0 };
      if (record.status === 'DONE') entry.done += 1;
      else entry.open += 1;
      if (record.kind === 'DEADLINE') entry.deadlines += 1;
      byDate.set(day, entry);
    }
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  async create(userId: string, data: CreateActivityDTO): Promise<ActivityDTO> {
    const schedule = this.normalizeSchedule(
      data.kind ?? 'TASK',
      data.scope ?? 'DAY',
      data.scheduledFor,
      data.dueDate ?? null,
      data.dueTime ?? null
    );
    const type = await this.resolveType(userId, data.typeKey ?? null, schedule.kind);
    const activity = await prisma.activity.create({
      data: {
        userId,
        typeId: type?.id ?? null,
        typeName: type?.name ?? null,
        typeColor: type?.color ?? null,
        title: data.title.trim(),
        notes: data.notes?.trim() || null,
        kind: schedule.kind,
        scope: schedule.scope,
        scheduledFor: dateOnly(schedule.scheduledFor),
        dueDate: schedule.dueDate ? dateOnly(schedule.dueDate) : null,
        dueTime: schedule.dueTime,
        priority: data.priority ?? 'MEDIUM',
        position: await this.nextActivityPosition(userId, schedule.kind, schedule.scheduledFor),
      },
      include: { type: true },
    });
    return this.toDTO(activity);
  }

  async update(userId: string, id: string, data: UpdateActivityDTO): Promise<ActivityDTO> {
    const existing = await prisma.activity.findFirst({
      where: { id, userId },
      include: { type: true },
    });
    if (!existing) throw new AppError('Attività non trovata', 404, 'NOT_FOUND');

    const kind = data.kind ?? existing.kind;
    const scope = data.scope ?? existing.scope;
    const scheduledFor = data.scheduledFor ?? toIsoDate(existing.scheduledFor);
    const dueDate =
      data.dueDate !== undefined
        ? data.dueDate
        : existing.dueDate
          ? toIsoDate(existing.dueDate)
          : null;
    const dueTime = data.dueTime !== undefined ? data.dueTime : existing.dueTime;
    const schedule = this.normalizeSchedule(kind, scope, scheduledFor, dueDate, dueTime);

    let type = existing.type;
    if (data.typeKey !== undefined) {
      type = await this.resolveType(userId, data.typeKey, schedule.kind);
    } else if (existing.type && existing.type.kind !== schedule.kind) {
      // Switching task <-> deadline invalidates a category that belonged to the
      // other family; keeping it would label the activity with a lie
      type = null;
    }

    const nextStatus = data.status ?? existing.status;
    const completedAt =
      nextStatus === 'DONE'
        ? existing.completedAt ?? new Date()
        : existing.status === 'DONE'
          ? null
          : existing.completedAt;

    const activity = await prisma.activity.update({
      where: { id: existing.id },
      data: {
        typeId: type?.id ?? null,
        typeName: type?.name ?? null,
        typeColor: type?.color ?? null,
        title: data.title?.trim(),
        notes: data.notes === undefined ? undefined : data.notes?.trim() || null,
        kind: schedule.kind,
        scope: schedule.scope,
        scheduledFor: dateOnly(schedule.scheduledFor),
        dueDate: schedule.dueDate ? dateOnly(schedule.dueDate) : null,
        dueTime: schedule.dueTime,
        priority: data.priority,
        status: nextStatus,
        position: data.position,
        isManuallyPositioned: data.position === undefined ? undefined : true,
        completedAt,
      },
      include: { type: true },
    });
    return this.toDTO(activity);
  }

  async reorder(userId: string, activityIds: string[]): Promise<void> {
    const activities = await prisma.activity.findMany({
      where: { userId, id: { in: activityIds } },
      select: { id: true },
    });
    if (activities.length !== activityIds.length) {
      throw new AppError('Una o più attività non sono state trovate', 404, 'NOT_FOUND');
    }

    await prisma.$transaction(
      activityIds.map((id, position) =>
        prisma.activity.update({
          where: { id },
          data: { position, isManuallyPositioned: true },
        })
      )
    );
  }

  /**
   * Hands the list back to priority and due dates. Without this a single drag
   * would switch the whole list to manual for good, while the interface keeps
   * promising an automatic order.
   */
  async resetOrder(userId: string, activityIds?: string[]): Promise<void> {
    await prisma.activity.updateMany({
      where: {
        userId,
        ...(activityIds && activityIds.length > 0 ? { id: { in: activityIds } } : {}),
      },
      data: { isManuallyPositioned: false },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await prisma.activity.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new AppError('Attività non trovata', 404, 'NOT_FOUND');
    await prisma.activity.delete({ where: { id: existing.id } });
  }

  async listTypes(userId: string): Promise<ActivityTypeDTO[]> {
    const types = await prisma.activityType.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });
    return types.map((type) => this.toTypeDTO(type));
  }

  async installDefaultTypes(userId: string): Promise<ActivityTypeDTO[]> {
    const existing = await prisma.activityType.findMany({
      where: { userId },
      select: { name: true, kind: true },
    });
    const taken = new Set(existing.map((type) => `${type.kind}:${type.name.toLowerCase()}`));
    const missing = DEFAULT_ACTIVITY_TYPES.filter(
      (type) => !taken.has(`${type.kind}:${type.name.toLowerCase()}`)
    );

    if (missing.length > 0) {
      const positions = new Map<ActivityKindDTO, number>();
      for (const kind of ['TASK', 'DEADLINE'] as const) {
        positions.set(kind, await this.nextTypePosition(userId, kind));
      }
      await prisma.activityType.createMany({
        data: missing.map((type) => {
          const position = positions.get(type.kind) ?? 0;
          positions.set(type.kind, position + 1);
          return {
            userId,
            key: `at-${randomUUID()}`,
            name: type.name,
            color: type.color,
            kind: type.kind,
            position,
            isDefault: true,
          };
        }),
      });
    }
    return this.listTypes(userId);
  }

  async createType(userId: string, data: CreateActivityTypeDTO): Promise<ActivityTypeDTO> {
    await this.assertUniqueTypeName(userId, data.kind, data.name);
    const type = await prisma.activityType.create({
      data: {
        userId,
        key: `at-${randomUUID()}`,
        name: data.name.trim(),
        color: data.color,
        kind: data.kind,
        position: await this.nextTypePosition(userId, data.kind),
      },
    });
    return this.toTypeDTO(type);
  }

  async updateType(
    userId: string,
    key: string,
    data: UpdateActivityTypeDTO
  ): Promise<ActivityTypeDTO> {
    const existing = await prisma.activityType.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Tipologia non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) {
      await this.assertUniqueTypeName(userId, existing.kind, data.name, key);
    }
    const type = await prisma.activityType.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        color: data.color,
        position: data.position,
        isActive: data.isActive,
      },
    });
    // Keep the copy on the activities aligned while the type is alive, so the
    // label that survives a future deletion is the current one, not a stale one
    if (data.name !== undefined || data.color !== undefined) {
      await prisma.activity.updateMany({
        where: { userId, typeId: type.id },
        data: { typeName: type.name, typeColor: type.color },
      });
    }
    return this.toTypeDTO(type);
  }

  async deleteType(userId: string, key: string): Promise<void> {
    const existing = await prisma.activityType.findFirst({ where: { userId, key }, select: { id: true } });
    if (!existing) throw new AppError('Tipologia non trovata', 404, 'NOT_FOUND');
    await prisma.activityType.delete({ where: { id: existing.id } });
  }

  private normalizeSchedule(
    kind: ActivityKindDTO,
    scope: 'DAY' | 'WEEK',
    scheduledFor: string,
    dueDate: string | null,
    dueTime: string | null
  ) {
    if (kind === 'DEADLINE') {
      if (!dueDate) {
        throw new AppError('La data di scadenza è obbligatoria', 400, 'DUE_DATE_REQUIRED');
      }
      return { kind, scope: 'DAY' as const, scheduledFor: dueDate, dueDate, dueTime };
    }
    if (dueTime && !dueDate) {
      throw new AppError('Imposta una data prima dell’orario', 400, 'DUE_DATE_REQUIRED');
    }
    return {
      kind,
      scope,
      scheduledFor: scope === 'WEEK' ? weekStartForDate(scheduledFor) : scheduledFor,
      dueDate,
      dueTime: dueDate ? dueTime : null,
    };
  }

  private async resolveType(userId: string, key: string | null, kind: ActivityKindDTO) {
    if (!key) return null;
    const type = await prisma.activityType.findFirst({ where: { userId, key, isActive: true } });
    if (!type) throw new AppError('Tipologia non trovata', 404, 'TYPE_NOT_FOUND');
    if (type.kind !== kind) {
      throw new AppError('La tipologia non è compatibile con il tipo di attività', 400, 'TYPE_MISMATCH');
    }
    return type;
  }

  private async nextActivityPosition(userId: string, kind: ActivityKindDTO, date: string) {
    const last = await prisma.activity.findFirst({
      where: { userId, kind, scheduledFor: dateOnly(date) },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async nextTypePosition(userId: string, kind: ActivityKindDTO): Promise<number> {
    const last = await prisma.activityType.findFirst({
      where: { userId, kind },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async assertUniqueTypeName(
    userId: string,
    kind: ActivityKindDTO,
    name: string,
    excludeKey?: string
  ): Promise<void> {
    const duplicate = await prisma.activityType.findFirst({
      where: {
        userId,
        kind,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già una tipologia con questo nome', 409, 'DUPLICATE_TYPE');
    }
  }

  private toDTO(activity: ActivityWithType): ActivityDTO {
    return {
      id: activity.id,
      title: activity.title,
      notes: activity.notes,
      kind: activity.kind,
      scope: activity.scope,
      scheduledFor: toIsoDate(activity.scheduledFor),
      dueDate: activity.dueDate ? toIsoDate(activity.dueDate) : null,
      dueTime: activity.dueTime,
      priority: activity.priority,
      status: activity.status,
      typeKey: activity.type?.key ?? null,
      // The live type wins while it exists; the copy takes over once it is gone
      typeName: activity.type?.name ?? activity.typeName,
      typeColor: activity.type?.color ?? activity.typeColor,
      position: activity.position,
      isManuallyPositioned: activity.isManuallyPositioned,
      completedAt: activity.completedAt?.toISOString() ?? null,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
    };
  }

  private toTypeDTO(type: ActivityType): ActivityTypeDTO {
    return {
      key: type.key,
      name: type.name,
      color: type.color,
      kind: type.kind,
      position: type.position,
      isActive: type.isActive,
      isDefault: type.isDefault,
    };
  }
}

export const activityService = new ActivityService();
