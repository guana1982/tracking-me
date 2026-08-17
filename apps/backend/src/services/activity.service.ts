import { randomUUID } from 'node:crypto';
import type { Activity, ActivityType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { DEFAULT_ACTIVITY_TYPES } from '@budget/shared';
import type {
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

class ActivityService {
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
          { status: { not: 'DONE' } },
          { kind: 'TASK', scope: 'DAY', scheduledFor: selectedDay, status: 'DONE' },
          { kind: 'TASK', scope: 'WEEK', scheduledFor: weekStartDay, status: 'DONE' },
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
    const today = mapped
      .filter(
        (activity) =>
          activity.kind === 'TASK' &&
          activity.scope === 'DAY' &&
          activity.scheduledFor === date
      )
      .sort(sortActivities);
    const week = mapped
      .filter(
        (activity) =>
          activity.kind === 'TASK' &&
          activity.scope === 'WEEK' &&
          activity.scheduledFor === weekStart
      )
      .sort(sortActivities);
    const deadlines = mapped
      .filter((activity) => activity.kind === 'DEADLINE')
      .sort(sortDeadlines);

    return {
      date,
      weekStart,
      weekEnd,
      all: mapped,
      today,
      week,
      deadlines,
      summary: {
        todayCompleted: today.filter((activity) => activity.status === 'DONE').length,
        todayTotal: today.length,
        weekCompleted: week.filter((activity) => activity.status === 'DONE').length,
        weekTotal: week.length,
        overdue: deadlines.filter(
          (activity) =>
            activity.status !== 'DONE' && activity.dueDate !== null && activity.dueDate < date
        ).length,
      },
    };
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

    let typeId = existing.typeId;
    if (data.typeKey !== undefined) {
      typeId = (await this.resolveType(userId, data.typeKey, schedule.kind))?.id ?? null;
    } else if (existing.type && existing.type.kind !== schedule.kind) {
      typeId = null;
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
        typeId,
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
      typeName: activity.type?.name ?? null,
      typeColor: activity.type?.color ?? null,
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
