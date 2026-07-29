import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { DEFAULT_RATING_DEFINITIONS } from '@budget/shared';
import type {
  CreateRatingDefinitionDTO,
  RatingDefinitionDTO,
  RatingEntryDTO,
  SetRatingDTO,
  UpdateRatingDefinitionDTO,
} from '@budget/shared';
import type { RatingDefinition, RatingEntry } from '@prisma/client';

/** Prisma @db.Date columns round-trip cleanly through UTC midnight */
function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The rating rows at the top of the diary: a handful of user-defined
 * characteristics, each voted on a 1..maxValue scale, each timestamped so the
 * vote takes its place in the day timeline.
 *
 * The suggested three are installed once per user and are editable from that
 * moment on - rename, add, remove. Whoever wants to rate something else rates
 * something else; whoever wants none archives them all.
 */
class RatingService {
  async list(userId: string, includeInactive = true): Promise<RatingDefinitionDTO[]> {
    await this.ensureSeeded(userId);
    const [definitions, usedKeys] = await Promise.all([
      prisma.ratingDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.ratingEntry.groupBy({
        by: ['ratingKey'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);
    const used = new Set(usedKeys.map((entry) => entry.ratingKey));
    return definitions.map((definition) => this.toDefinitionDTO(definition, used.has(definition.key)));
  }

  async create(userId: string, data: CreateRatingDefinitionDTO): Promise<RatingDefinitionDTO> {
    await this.assertUniqueName(userId, data.name);
    const last = await prisma.ratingDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const definition = await prisma.ratingDefinition.create({
      data: {
        userId,
        key: `r-${randomUUID()}`,
        name: data.name.trim(),
        maxValue: data.maxValue ?? 10,
        linkedForm: data.linkedForm ?? 'NONE',
        position: (last?.position ?? -1) + 1,
      },
    });
    return this.toDefinitionDTO(definition, false);
  }

  async update(
    key: string,
    userId: string,
    data: UpdateRatingDefinitionDTO
  ): Promise<RatingDefinitionDTO> {
    const existing = await prisma.ratingDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Caratteristica non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);

    const definition = await prisma.ratingDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        maxValue: data.maxValue,
        linkedForm: data.linkedForm,
        position: data.position,
        isActive: data.isActive,
      },
    });
    const used = await prisma.ratingEntry.count({ where: { userId, ratingKey: key } });
    return this.toDefinitionDTO(definition, used > 0);
  }

  /**
   * Hard delete of the row only. Past votes carry their own name and scale,
   * so the timeline of previous days is left exactly as it was written.
   */
  async delete(key: string, userId: string): Promise<void> {
    const existing = await prisma.ratingDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Caratteristica non trovata', 404, 'NOT_FOUND');
    await prisma.ratingDefinition.delete({ where: { id: existing.id } });
  }

  async getRange(userId: string, from?: string, to?: string): Promise<RatingEntryDTO[]> {
    const entries = await prisma.ratingEntry.findMany({
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
      orderBy: { loggedAt: 'asc' },
    });
    return entries.map((entry) => this.toEntryDTO(entry));
  }

  /**
   * One vote per characteristic per day, edited in place. Fields left out are
   * untouched and an explicit null clears them: when nothing is left the entry
   * disappears, so an accidental tap is undoable.
   *
   * Returns the entry, or null when it was removed.
   */
  async setEntry(userId: string, data: SetRatingDTO): Promise<RatingEntryDTO | null> {
    const day = dateOnly(data.date);
    const definition = await prisma.ratingDefinition.findFirst({
      where: { userId, key: data.ratingKey },
    });
    if (!definition) throw new AppError('Caratteristica non trovata', 404, 'NOT_FOUND');
    if (data.value != null && data.value > definition.maxValue) {
      throw new AppError('Voto fuori scala', 400, 'VALUE_OUT_OF_RANGE');
    }
    if (data.quickLogId) {
      const log = await prisma.quickLog.findFirst({
        where: { id: data.quickLogId, userId },
        select: { id: true },
      });
      if (!log) throw new AppError('Nota non trovata', 404, 'NOT_FOUND');
    }

    const existing = await prisma.ratingEntry.findFirst({
      where: { userId, date: day, ratingKey: data.ratingKey },
    });

    const value = data.value === undefined ? existing?.value ?? null : data.value;
    const note =
      data.note === undefined ? existing?.note ?? null : data.note?.trim() || null;
    const quickLogId =
      data.quickLogId === undefined ? existing?.quickLogId ?? null : data.quickLogId;

    // An empty row is no row: nothing to show in the timeline, nothing to keep
    if (value === null && note === null && quickLogId === null) {
      if (existing) await prisma.ratingEntry.delete({ where: { id: existing.id } });
      return null;
    }

    // The clock follows the act of rating, not a typo fixed in the note later
    const touchesMoment = data.value !== undefined || Boolean(data.quickLogId);
    const loggedAt = data.loggedAt
      ? new Date(data.loggedAt)
      : touchesMoment || !existing
        ? new Date()
        : existing.loggedAt;

    const entry = await prisma.ratingEntry.upsert({
      where: {
        userId_date_ratingKey: { userId, date: day, ratingKey: data.ratingKey },
      },
      create: {
        userId,
        date: day,
        ratingId: definition.id,
        ratingKey: definition.key,
        // Snapshots, like intakes and check-in values: renaming or deleting
        // the characteristic never rewrites what a past day says
        ratingName: definition.name,
        maxValue: definition.maxValue,
        value,
        note,
        quickLogId,
        loggedAt,
      },
      update: { value, note, quickLogId, loggedAt },
    });
    return this.toEntryDTO(entry);
  }

  async deleteEntry(userId: string, date: string, ratingKey: string): Promise<void> {
    await prisma.ratingEntry.deleteMany({
      where: { userId, date: dateOnly(date), ratingKey },
    });
  }

  /**
   * Installs the suggested rows the first time the diary asks for them. The
   * timestamp on the user is the guard: removing a row keeps it removed,
   * instead of having it grow back on the next reload.
   */
  private async ensureSeeded(userId: string): Promise<void> {
    // Atomic claim: only the request that flips the flag does the seeding
    const claimed = await prisma.user.updateMany({
      where: { id: userId, ratingsSeededAt: null },
      data: { ratingsSeededAt: new Date() },
    });
    if (claimed.count === 0) return;

    await prisma.ratingDefinition.createMany({
      data: DEFAULT_RATING_DEFINITIONS.map((seed, index) => ({
        userId,
        key: `r-${randomUUID()}`,
        name: seed.name,
        maxValue: seed.maxValue,
        linkedForm: seed.linkedForm,
        position: index,
        isDefault: true,
      })),
      skipDuplicates: true,
    });
  }

  private toDefinitionDTO(definition: RatingDefinition, isUsed: boolean): RatingDefinitionDTO {
    return {
      key: definition.key,
      name: definition.name,
      maxValue: definition.maxValue,
      linkedForm: definition.linkedForm,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed,
    };
  }

  private toEntryDTO(entry: RatingEntry): RatingEntryDTO {
    return {
      date: toIsoDate(entry.date),
      ratingKey: entry.ratingKey,
      ratingName: entry.ratingName,
      value: entry.value,
      maxValue: entry.maxValue,
      note: entry.note,
      quickLogId: entry.quickLogId,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.ratingDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già una caratteristica con questo nome', 409, 'DUPLICATE_RATING');
    }
  }
}

export const ratingService = new RatingService();
