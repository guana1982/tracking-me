import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { DEFAULT_HABITS } from '@budget/shared';
import type {
  CreateHabitDefinitionDTO,
  HabitDayDTO,
  HabitDayGroupDTO,
  HabitDayItemDTO,
  HabitDefinitionDTO,
  HabitEntryDTO,
  SetHabitDTO,
  UpdateHabitDefinitionDTO,
} from '@budget/shared';
import type { HabitDefinition, HabitEntry } from '@prisma/client';

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ISO weekday of a plain date: 1 = Monday … 7 = Sunday */
export function isoWeekday(date: string): number {
  const day = dateOnly(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Habits: the same shape as the intakes - a catalogue the user owns, one
 * answer per day - with the difference that nothing here is a dose. What is
 * tracked, how it is measured and on which days is entirely up to them.
 *
 * Nothing is seeded. An empty catalogue keeps the whole thing invisible.
 */
class HabitService {
  async list(userId: string, includeInactive = true): Promise<HabitDefinitionDTO[]> {
    const [definitions, usedKeys] = await Promise.all([
      prisma.habitDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.habitEntry.groupBy({ by: ['habitKey'], where: { userId }, _count: { _all: true } }),
    ]);
    const used = new Set(usedKeys.map((entry) => entry.habitKey));
    return definitions.map((definition) => this.toDTO(definition, used.has(definition.key)));
  }

  async create(userId: string, data: CreateHabitDefinitionDTO): Promise<HabitDefinitionDTO> {
    await this.assertUniqueName(userId, data.name);
    const definition = await prisma.habitDefinition.create({
      data: {
        userId,
        key: `h-${randomUUID()}`,
        name: data.name.trim(),
        measure: data.measure ?? 'DONE',
        unit: data.unit?.trim() ?? '',
        target: data.target ?? null,
        moment: data.moment?.trim() || null,
        daysOfWeek: data.daysOfWeek ?? [],
        track: data.track ?? 'NONE',
        position: await this.nextPosition(userId),
      },
    });
    return this.toDTO(definition, false);
  }

  /** Installs the suggested set, skipping any name the user already has */
  async installDefaults(userId: string): Promise<HabitDefinitionDTO[]> {
    const existing = await prisma.habitDefinition.findMany({
      where: { userId },
      select: { name: true },
    });
    const taken = new Set(existing.map((definition) => definition.name.toLowerCase()));
    const missing = DEFAULT_HABITS.filter((seed) => !taken.has(seed.name.toLowerCase()));

    if (missing.length > 0) {
      const start = await this.nextPosition(userId);
      await prisma.habitDefinition.createMany({
        data: missing.map((seed, index) => ({
          userId,
          key: `h-${randomUUID()}`,
          name: seed.name,
          measure: seed.measure,
          unit: seed.unit,
          position: start + index,
          isDefault: true,
        })),
        skipDuplicates: true,
      });
    }
    return this.list(userId);
  }

  async update(
    key: string,
    userId: string,
    data: UpdateHabitDefinitionDTO
  ): Promise<HabitDefinitionDTO> {
    const existing = await prisma.habitDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Abitudine non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);

    const definition = await prisma.habitDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        measure: data.measure,
        unit: data.unit?.trim(),
        target: data.target,
        moment: data.moment === undefined ? undefined : data.moment?.trim() || null,
        daysOfWeek: data.daysOfWeek,
        track: data.track,
        position: data.position,
        isActive: data.isActive,
      },
    });
    const used = await prisma.habitEntry.count({ where: { userId, habitKey: key } });
    return this.toDTO(definition, used > 0);
  }

  /**
   * Hard delete of the catalogue entry only. Answers keep their own name and
   * measure, so the history survives (the FK goes null).
   */
  async delete(key: string, userId: string): Promise<void> {
    const existing = await prisma.habitDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Abitudine non trovata', 404, 'NOT_FOUND');
    await prisma.habitDefinition.delete({ where: { id: existing.id } });
  }

  /**
   * What is expected on a given day, already carrying the answer given so
   * far. Habits scheduled on other weekdays are left out entirely: a rest day
   * is not a skipped day, and showing it would invite marking it as one.
   */
  async getDay(userId: string, date: string): Promise<HabitDayDTO> {
    const day = dateOnly(date);
    const weekday = isoWeekday(date);
    const [definitions, entries] = await Promise.all([
      prisma.habitDefinition.findMany({
        where: { userId, isActive: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.habitEntry.findMany({ where: { userId, date: day } }),
    ]);

    const answered = new Map(entries.map((entry) => [entry.habitKey, entry]));
    const due = definitions.filter(
      (definition) =>
        definition.daysOfWeek.length === 0 || definition.daysOfWeek.includes(weekday)
    );

    // Grouped by moment, in catalogue order; the unlabelled ones come first
    const groups = new Map<string, HabitDayItemDTO[]>();
    for (const definition of due) {
      const entry = answered.get(definition.key);
      const item: HabitDayItemDTO = {
        habitKey: definition.key,
        name: definition.name,
        measure: definition.measure,
        unit: definition.unit,
        target: definition.target,
        status: entry?.status ?? null,
        value: entry?.value ?? null,
        note: entry?.note ?? null,
      };
      const moment = definition.moment ?? '';
      groups.set(moment, [...(groups.get(moment) ?? []), item]);
    }

    const ordered: HabitDayGroupDTO[] = [...groups.entries()]
      .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
      .map(([moment, items]) => ({ moment, items }));

    const total = due.length;
    const answeredCount = due.filter((definition) => answered.has(definition.key)).length;
    return { date, groups: ordered, answered: answeredCount, total };
  }

  async getRange(userId: string, from?: string, to?: string): Promise<HabitEntryDTO[]> {
    const entries = await prisma.habitEntry.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: dateOnly(from) } : {}),
                ...(to ? { lte: dateOnly(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
    return entries.map((entry) => this.toEntryDTO(entry));
  }

  /**
   * Idempotent per (day, habit): answering twice does not create two records,
   * and a null status removes the answer entirely.
   */
  async setEntry(userId: string, data: SetHabitDTO): Promise<HabitDayDTO> {
    const day = dateOnly(data.date);

    if (data.status === null) {
      await prisma.habitEntry.deleteMany({
        where: { userId, date: day, habitKey: data.habitKey },
      });
      return this.getDay(userId, data.date);
    }

    const definition = await prisma.habitDefinition.findFirst({
      where: { userId, key: data.habitKey },
    });
    if (!definition) throw new AppError('Abitudine non trovata', 404, 'NOT_FOUND');

    // A plain yes/no carries no amount: storing one would be inventing it
    const value = definition.measure === 'DONE' ? null : (data.value ?? null);
    const note = data.note?.trim() || null;

    await prisma.habitEntry.upsert({
      where: { userId_date_habitKey: { userId, date: day, habitKey: data.habitKey } },
      create: {
        userId,
        habitId: definition.id,
        habitKey: definition.key,
        // Snapshots: renaming or deleting the habit leaves the history intact
        habitName: definition.name,
        measure: definition.measure,
        unit: definition.unit,
        date: day,
        status: data.status,
        value,
        note,
      },
      update: { status: data.status, value, note, loggedAt: new Date() },
    });
    return this.getDay(userId, data.date);
  }

  private async nextPosition(userId: string): Promise<number> {
    const last = await prisma.habitDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private toDTO(definition: HabitDefinition, isUsed: boolean): HabitDefinitionDTO {
    return {
      key: definition.key,
      name: definition.name,
      measure: definition.measure,
      unit: definition.unit,
      target: definition.target,
      moment: definition.moment,
      daysOfWeek: definition.daysOfWeek,
      track: definition.track,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed,
    };
  }

  private toEntryDTO(entry: HabitEntry): HabitEntryDTO {
    return {
      date: toIsoDate(entry.date),
      habitKey: entry.habitKey,
      habitName: entry.habitName,
      measure: entry.measure,
      unit: entry.unit,
      status: entry.status,
      value: entry.value,
      note: entry.note,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.habitDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già un’abitudine con questo nome', 409, 'DUPLICATE_HABIT');
    }
  }
}

export const habitService = new HabitService();
