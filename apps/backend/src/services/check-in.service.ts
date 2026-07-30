import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { DEFAULT_CHECK_IN_SCALES, SIDE_EFFECT_LEVELS } from '@budget/shared';
import { suggestedSideEffects } from '../lib/therapy-config.js';
import type {
  SuggestedSideEffectDTO,
  CheckInDayDTO,
  CheckInEntryDTO,
  CheckInScaleDTO,
  CheckInValueDTO,
  CreateCheckInScaleDTO,
  SaveCheckInDTO,
  UpdateCheckInScaleDTO,
} from '@budget/shared';
import type { CheckInEntry, CheckInScale, Prisma } from '@prisma/client';

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** valuesJson is written by us, but read defensively: it is still a Json column */
function readValues(entry: Pick<CheckInEntry, 'valuesJson'>): CheckInValueDTO[] {
  if (!Array.isArray(entry.valuesJson)) return [];
  return (entry.valuesJson as unknown[]).filter(
    (value): value is CheckInValueDTO =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as CheckInValueDTO).key === 'string' &&
      typeof (value as CheckInValueDTO).value === 'number'
  );
}

/**
 * The daily check-in: configurable scales, one entry per day.
 *
 * Nothing is seeded automatically - a user who only tracks food and mood
 * never meets this. The suggested set is installed on request, and from then
 * on scales can be renamed, reordered, added or removed freely.
 */
class CheckInService {
  async listScales(userId: string, includeInactive = true): Promise<CheckInScaleDTO[]> {
    const [scales, entries] = await Promise.all([
      prisma.checkInScale.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.checkInEntry.findMany({ where: { userId }, select: { valuesJson: true } }),
    ]);

    const used = new Set<string>();
    for (const entry of entries) {
      for (const value of readValues(entry)) used.add(value.key);
    }
    return scales.map((scale) => this.toScaleDTO(scale, used.has(scale.key)));
  }

  /** Installs the suggested set, skipping any scale the user already has */
  async installDefaultScales(userId: string): Promise<CheckInScaleDTO[]> {
    const existing = await prisma.checkInScale.findMany({
      where: { userId },
      select: { key: true, position: true },
    });
    const existingKeys = new Set(existing.map((scale) => scale.key));
    const nextPosition = existing.reduce((max, scale) => Math.max(max, scale.position + 1), 0);

    const missing = DEFAULT_CHECK_IN_SCALES.filter((seed) => !existingKeys.has(seed.key));
    if (missing.length > 0) {
      await prisma.checkInScale.createMany({
        data: missing.map((seed, index) => ({
          userId,
          key: seed.key,
          name: seed.name,
          lowLabel: seed.lowLabel,
          highLabel: seed.highLabel,
          levelLabels: seed.levelLabels,
          maxValue: seed.maxValue,
          isPositive: seed.isPositive,
          isCore: seed.isCore,
          position: nextPosition + index,
          isDefault: true,
        })),
        skipDuplicates: true,
      });
    }
    return this.listScales(userId);
  }

  async createScale(userId: string, data: CreateCheckInScaleDTO): Promise<CheckInScaleDTO> {
    await this.assertUniqueName(userId, data.name);
    const last = await prisma.checkInScale.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const levelLabels = data.levelLabels ?? [];
    const scale = await prisma.checkInScale.create({
      data: {
        userId,
        key: `s-${randomUUID()}`,
        name: data.name.trim(),
        lowLabel: data.lowLabel?.trim() ?? '',
        highLabel: data.highLabel?.trim() ?? '',
        levelLabels,
        // Named steps define their own range: the two must never disagree
        maxValue: levelLabels.length > 0 ? levelLabels.length - 1 : data.maxValue ?? 10,
        isPositive: data.isPositive ?? false,
        isCore: data.isCore ?? true,
        isSideEffect: data.isSideEffect ?? false,
        // A side effect is a bodily fact, a symptom scale a psychological one
        track: data.track ?? (data.isSideEffect ? 'BODY' : 'MOOD'),
        position: (last?.position ?? -1) + 1,
      },
    });
    return this.toScaleDTO(scale, false);
  }

  /**
   * The side effects worth asking about, derived from what the user is
   * actually taking. The vocabulary comes from the config file, never from
   * the code: it changes with the therapy (§7).
   */
  async suggestSideEffects(userId: string): Promise<SuggestedSideEffectDTO[]> {
    const [treatments, scales] = await Promise.all([
      prisma.treatmentDefinition.findMany({
        where: { userId, isActive: true },
        select: { name: true, detail: true, form: true },
      }),
      prisma.checkInScale.findMany({ where: { userId }, select: { name: true } }),
    ]);

    const installed = new Set(scales.map((scale) => scale.name.toLowerCase()));
    return [...suggestedSideEffects(treatments).entries()].map(([name, sources]) => ({
      name,
      sources,
      isInstalled: installed.has(name.toLowerCase()),
    }));
  }

  /**
   * Installs the chosen side effects as optional check-in scales with named
   * steps: presence and how strong, never a number to count.
   */
  async installSideEffects(userId: string, names: string[]): Promise<CheckInScaleDTO[]> {
    const existing = await prisma.checkInScale.findMany({
      where: { userId },
      select: { name: true, position: true },
    });
    const taken = new Set(existing.map((scale) => scale.name.toLowerCase()));
    const nextPosition = existing.reduce((max, scale) => Math.max(max, scale.position + 1), 0);
    const missing = names.filter((name) => !taken.has(name.trim().toLowerCase()));

    if (missing.length > 0) {
      await prisma.checkInScale.createMany({
        data: missing.map((name, index) => ({
          userId,
          key: `s-${randomUUID()}`,
          name: name.trim(),
          levelLabels: SIDE_EFFECT_LEVELS,
          maxValue: SIDE_EFFECT_LEVELS.length - 1,
          isPositive: false,
          // Optional by design: the core five stay the five of the spec
          isCore: false,
          isSideEffect: true,
          track: 'BODY' as const,
          position: nextPosition + index,
        })),
        skipDuplicates: true,
      });
    }
    return this.listScales(userId);
  }

  async updateScale(
    key: string,
    userId: string,
    data: UpdateCheckInScaleDTO
  ): Promise<CheckInScaleDTO> {
    const existing = await prisma.checkInScale.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Scala non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);

    const levelLabels = data.levelLabels ?? existing.levelLabels;
    const scale = await prisma.checkInScale.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        lowLabel: data.lowLabel?.trim(),
        highLabel: data.highLabel?.trim(),
        levelLabels: data.levelLabels,
        maxValue:
          levelLabels.length > 0
            ? levelLabels.length - 1
            : data.maxValue ?? (data.levelLabels ? 10 : undefined),
        isPositive: data.isPositive,
        isCore: data.isCore,
        isSideEffect: data.isSideEffect,
        track: data.track,
        position: data.position,
        isActive: data.isActive,
      },
    });
    return this.toScaleDTO(scale, await this.isScaleUsed(userId, key));
  }

  /**
   * Hard delete. Past entries snapshot the scale they answered, so removing
   * it from the catalogue never changes what a previous day says.
   */
  async deleteScale(key: string, userId: string): Promise<void> {
    const existing = await prisma.checkInScale.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Scala non trovata', 404, 'NOT_FOUND');
    await prisma.checkInScale.delete({ where: { id: existing.id } });
  }

  /**
   * Everything the form needs for one day: the scales to render, the entry
   * already saved for that day (if any) and the previous answers to prefill
   * with, so only what actually changed has to be moved.
   */
  async getDay(userId: string, date: string): Promise<CheckInDayDTO> {
    const day = dateOnly(date);
    const [scales, entry, previous] = await Promise.all([
      this.listScales(userId),
      prisma.checkInEntry.findFirst({ where: { userId, date: day } }),
      prisma.checkInEntry.findFirst({
        where: { userId, date: { lt: day } },
        orderBy: { date: 'desc' },
      }),
    ]);

    const prefill: Record<string, number> = {};
    for (const value of previous ? readValues(previous) : []) {
      prefill[value.key] = value.value;
    }

    return {
      date,
      scales: scales.filter((scale) => scale.isActive),
      entry: entry ? this.toEntryDTO(entry) : null,
      prefill,
    };
  }

  async getRange(userId: string, from?: string, to?: string): Promise<CheckInEntryDTO[]> {
    const entries = await prisma.checkInEntry.findMany({
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
   * One entry per day, enforced by a unique index: saving again edits the
   * existing one instead of stacking a second evaluation of the same day.
   */
  async save(userId: string, data: SaveCheckInDTO): Promise<CheckInEntryDTO> {
    const day = dateOnly(data.date);
    const scales = await prisma.checkInScale.findMany({ where: { userId } });
    const byKey = new Map(scales.map((scale) => [scale.key, scale]));

    const values: CheckInValueDTO[] = [];
    for (const answer of data.values) {
      const scale = byKey.get(answer.key);
      if (!scale) throw new AppError('Scala non trovata', 404, 'NOT_FOUND');
      if (answer.value < 0 || answer.value > scale.maxValue) {
        throw new AppError('Valore fuori scala', 400, 'VALUE_OUT_OF_RANGE');
      }
      // Snapshot the scale: the entry stays readable after any catalogue edit
      values.push({
        key: scale.key,
        name: scale.name,
        value: answer.value,
        maxValue: scale.maxValue,
        isPositive: scale.isPositive,
      });
    }

    const note = data.note?.trim() || null;
    // A DTO array is a valid JSON value; Prisma's input type just cannot see it
    const valuesJson = values as unknown as Prisma.InputJsonValue;
    const entry = await prisma.checkInEntry.upsert({
      where: { userId_date: { userId, date: day } },
      create: { userId, date: day, valuesJson, note },
      update: { valuesJson, note, loggedAt: new Date() },
    });
    return this.toEntryDTO(entry);
  }

  async deleteEntry(userId: string, date: string): Promise<void> {
    await prisma.checkInEntry.deleteMany({ where: { userId, date: dateOnly(date) } });
  }

  private async isScaleUsed(userId: string, key: string): Promise<boolean> {
    const entries = await prisma.checkInEntry.findMany({
      where: { userId },
      select: { valuesJson: true },
    });
    return entries.some((entry) => readValues(entry).some((value) => value.key === key));
  }

  private toScaleDTO(scale: CheckInScale, isUsed: boolean): CheckInScaleDTO {
    return {
      key: scale.key,
      name: scale.name,
      lowLabel: scale.lowLabel,
      highLabel: scale.highLabel,
      levelLabels: scale.levelLabels,
      maxValue: scale.maxValue,
      isPositive: scale.isPositive,
      isCore: scale.isCore,
      isSideEffect: scale.isSideEffect,
      track: scale.track,
      position: scale.position,
      isActive: scale.isActive,
      isDefault: scale.isDefault,
      isUsed,
    };
  }

  private toEntryDTO(entry: CheckInEntry): CheckInEntryDTO {
    return {
      date: toIsoDate(entry.date),
      values: readValues(entry),
      note: entry.note,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.checkInScale.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già una scala con questo nome', 409, 'DUPLICATE_SCALE');
    }
  }
}

export const checkInService = new CheckInService();
