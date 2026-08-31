import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import {
  DEFAULT_EVENT_DEFINITIONS,
  DEFAULT_RATING_DEFINITIONS,
  SIDE_EFFECT_MAX,
} from '@budget/shared';
import { suggestedSideEffects } from '../lib/therapy-config.js';
import type {
  CreateRatingDefinitionDTO,
  CreateRatingEntryDTO,
  RatingDefinitionDTO,
  RatingEntryDTO,
  SuggestedSideEffectDTO,
  UpdateRatingDefinitionDTO,
  UpdateRatingEntryDTO,
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
    const definition = await prisma.ratingDefinition.create({
      data: {
        userId,
        key: `r-${randomUUID()}`,
        name: data.name.trim(),
        kind: data.kind ?? 'SCALE',
        maxValue: data.maxValue ?? 10,
        // A row wired to the mood picker is a mood row unless told otherwise
        track: data.track ?? (data.linkedForm === 'MOOD' ? 'MOOD' : 'BODY'),
        sourceTreatmentKeys: data.sourceTreatmentKeys ?? [],
        linkedForm: data.linkedForm ?? 'NONE',
        position: await this.nextPosition(userId),
      },
    });
    return this.toDefinitionDTO(definition, false);
  }

  /**
   * Installs the suggested episode types, skipping any name already there.
   * On request only - the catalogue is never populated behind the user's back.
   */
  async installDefaultEvents(userId: string): Promise<RatingDefinitionDTO[]> {
    const existing = await prisma.ratingDefinition.findMany({
      where: { userId },
      select: { name: true },
    });
    const taken = new Set(existing.map((definition) => definition.name.toLowerCase()));
    const missing = DEFAULT_EVENT_DEFINITIONS.filter((name) => !taken.has(name.toLowerCase()));

    if (missing.length > 0) {
      const start = await this.nextPosition(userId);
      await prisma.ratingDefinition.createMany({
        data: missing.map((name, index) => ({
          userId,
          key: `r-${randomUUID()}`,
          name,
          kind: 'EVENT' as const,
          // An episode is rated 1-10 like everything else, but the intensity
          // is optional: the tap that records it must stay a single tap
          maxValue: 10,
          // The suggested five are psychological episodes; a user logging
          // migraines or reflux moves them to the physical track
          track: 'MOOD' as const,
          position: start + index,
          isDefault: true,
        })),
        skipDuplicates: true,
      });
    }
    return this.list(userId);
  }

  /**
   * The side effects worth watching, derived from what the user is actually
   * taking. The vocabulary comes from the config file, never from the code
   * (§7): it changes with the therapy.
   */
  async suggestSideEffects(userId: string): Promise<SuggestedSideEffectDTO[]> {
    const [treatments, definitions] = await Promise.all([
      prisma.treatmentDefinition.findMany({
        where: { userId, isActive: true },
        select: { key: true, name: true, detail: true, form: true },
      }),
      prisma.ratingDefinition.findMany({ where: { userId }, select: { name: true } }),
    ]);

    const installed = new Set(definitions.map((definition) => definition.name.toLowerCase()));
    return [...suggestedSideEffects(treatments).entries()].map(([name, match]) => ({
      name,
      sources: match.sources.map((source) => source.name),
      sourceKeys: match.sources.map((source) => source.key),
      isInstalled: installed.has(name.toLowerCase()),
    }));
  }

  /**
   * Installs the chosen side effects as chips in the diary. Their intensity
   * is the three named steps of the spec, never a number to count.
   */
  async installSideEffects(userId: string, names: string[]): Promise<RatingDefinitionDTO[]> {
    const [existing, treatments] = await Promise.all([
      prisma.ratingDefinition.findMany({ where: { userId }, select: { name: true } }),
      prisma.treatmentDefinition.findMany({
        where: { userId, isActive: true },
        select: { key: true, name: true, detail: true, form: true },
      }),
    ]);
    const taken = new Set(existing.map((definition) => definition.name.toLowerCase()));
    const missing = names.filter((name) => !taken.has(name.trim().toLowerCase()));

    // Re-derived here rather than trusted from the client: the source is what
    // the config says today, not what a stale screen thought
    const matches = suggestedSideEffects(treatments);

    if (missing.length > 0) {
      const start = await this.nextPosition(userId);
      await prisma.ratingDefinition.createMany({
        data: missing.map((name, index) => ({
          userId,
          key: `r-${randomUUID()}`,
          name: name.trim(),
          kind: 'SIDE_EFFECT' as const,
          maxValue: SIDE_EFFECT_MAX,
          track: 'BODY' as const,
          sourceTreatmentKeys:
            matches.get(name.trim())?.sources.map((source) => source.key) ?? [],
          position: start + index,
          isDefault: true,
        })),
        skipDuplicates: true,
      });
    }
    return this.list(userId);
  }

  /**
   * The triggers already used, most frequent first. This is the autocomplete
   * source, and over time the same list becomes the ranking the spec calls
   * the most valuable output of the module.
   */
  async listTriggers(userId: string, limit = 40): Promise<string[]> {
    const grouped = await prisma.ratingEntry.groupBy({
      by: ['trigger'],
      where: { userId, trigger: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { trigger: 'desc' } },
      take: limit,
    });
    return grouped
      .map((row) => row.trigger)
      .filter((trigger): trigger is string => trigger !== null);
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
        kind: data.kind,
        maxValue: data.maxValue,
        track: data.track,
        sourceTreatmentKeys: data.sourceTreatmentKeys,
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
   * Always an insert. The row that produced this vote forgets it immediately,
   * so voting the same characteristic again a few hours later records a
   * second moment rather than correcting the first.
   */
  async createEntry(userId: string, data: CreateRatingEntryDTO): Promise<RatingEntryDTO> {
    const definition = await prisma.ratingDefinition.findFirst({
      where: { userId, key: data.ratingKey },
    });
    if (!definition) throw new AppError('Caratteristica non trovata', 404, 'NOT_FOUND');
    // An episode or a side effect is worth recording even without an
    // intensity: the tap that logs it has to stay one tap. A mark is the mark
    if (definition.kind === 'SCALE' && data.value == null) {
      throw new AppError('Voto mancante', 400, 'VALUE_REQUIRED');
    }
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

    const entry = await prisma.ratingEntry.create({
      data: {
        userId,
        date: dateOnly(data.date),
        ratingId: definition.id,
        ratingKey: definition.key,
        // Snapshots, like intakes and check-in values: renaming or deleting
        // the characteristic never rewrites what a past day says
        ratingName: definition.name,
        kind: definition.kind,
        maxValue: definition.maxValue,
        value: data.value ?? null,
        note: data.note?.trim() || null,
        trigger: data.trigger?.trim() || null,
        quickLogId: data.quickLogId ?? null,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      },
    });
    return this.toEntryDTO(entry);
  }

  /**
   * Corrects a vote already recorded. The scale checked is the one stored on
   * the entry, not the current one: an old vote stays valid against the scale
   * it was given on, even after the characteristic has been rescaled.
   */
  async updateEntry(
    userId: string,
    id: string,
    data: UpdateRatingEntryDTO
  ): Promise<RatingEntryDTO> {
    const existing = await prisma.ratingEntry.findFirst({ where: { userId, id } });
    if (!existing) throw new AppError('Voto non trovato', 404, 'NOT_FOUND');
    if (data.value != null && data.value > existing.maxValue) {
      throw new AppError('Voto fuori scala', 400, 'VALUE_OUT_OF_RANGE');
    }

    const entry = await prisma.ratingEntry.update({
      where: { id: existing.id },
      data: {
        value: data.value,
        note: data.note === undefined ? undefined : data.note?.trim() || null,
        trigger: data.trigger === undefined ? undefined : data.trigger?.trim() || null,
        // loggedAt untouched on purpose: fixing a mark does not move the
        // moment it was given, so the recap keeps its place in the timeline
      },
    });
    return this.toEntryDTO(entry);
  }

  /** Removing a vote removes that vote, not the whole day */
  async deleteEntry(userId: string, id: string): Promise<void> {
    await prisma.ratingEntry.deleteMany({ where: { userId, id } });
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
        track: seed.track,
        position: index,
        isDefault: true,
      })),
      skipDuplicates: true,
    });
  }

  private async nextPosition(userId: string): Promise<number> {
    const last = await prisma.ratingDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private toDefinitionDTO(definition: RatingDefinition, isUsed: boolean): RatingDefinitionDTO {
    return {
      key: definition.key,
      name: definition.name,
      kind: definition.kind,
      maxValue: definition.maxValue,
      track: definition.track,
      sourceTreatmentKeys: definition.sourceTreatmentKeys,
      linkedForm: definition.linkedForm,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed,
    };
  }

  private toEntryDTO(entry: RatingEntry): RatingEntryDTO {
    return {
      id: entry.id,
      date: toIsoDate(entry.date),
      ratingKey: entry.ratingKey,
      ratingName: entry.ratingName,
      kind: entry.kind,
      value: entry.value,
      maxValue: entry.maxValue,
      note: entry.note,
      trigger: entry.trigger,
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
