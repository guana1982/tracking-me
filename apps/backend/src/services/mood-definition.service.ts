import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { MOOD_OPTIONS } from '@budget/shared';
import type {
  CreateMoodDefinitionDTO,
  MoodDefinitionDTO,
  UpdateMoodDefinitionDTO,
} from '@budget/shared';

const DEFAULT_DEFINITIONS = MOOD_OPTIONS.map((option, position) => ({
  key: option.key,
  name: option.label,
  valence: option.valence,
  position,
  isDefault: true,
}));

class MoodDefinitionService {
  async list(userId: string, includeInactive = true): Promise<MoodDefinitionDTO[]> {
    await this.ensureSeeded(userId);
    const [definitions, moodLogs] = await Promise.all([
      prisma.moodDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      // Mood logs store their labels as text (no FK), so "used" is a text match.
      // That is deliberate: editing the catalog never rewrites history.
      prisma.quickLog.findMany({
        where: { userId, derivedCategory: 'MOOD' },
        select: { text: true },
      }),
    ]);

    const loggedText = moodLogs.map((log) => log.text.toLowerCase());
    return definitions.map((definition) => ({
      key: definition.key,
      name: definition.name,
      valence: definition.valence,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed: loggedText.some((text) => text.includes(definition.name.toLowerCase())),
    }));
  }

  async create(userId: string, data: CreateMoodDefinitionDTO): Promise<MoodDefinitionDTO> {
    await this.ensureSeeded(userId);
    await this.assertUniqueName(userId, data.name);
    const last = await prisma.moodDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const definition = await prisma.moodDefinition.create({
      data: {
        userId,
        key: `custom-${randomUUID()}`,
        name: data.name.trim(),
        valence: data.valence,
        position: (last?.position ?? -1) + 1,
      },
    });
    return { ...definition, isUsed: false };
  }

  async update(
    key: string,
    userId: string,
    data: UpdateMoodDefinitionDTO
  ): Promise<MoodDefinitionDTO> {
    await this.ensureSeeded(userId);
    const existing = await prisma.moodDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Stato d\'umore non trovato', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);
    if (data.isActive === false && existing.isActive) {
      const activeCount = await prisma.moodDefinition.count({ where: { userId, isActive: true } });
      if (activeCount <= 1) {
        throw new AppError(
          'Deve rimanere almeno uno stato d\'umore attivo',
          400,
          'LAST_ACTIVE_MOOD'
        );
      }
    }

    const definition = await prisma.moodDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        valence: data.valence,
        position: data.position,
        isActive: data.isActive,
      },
    });
    return { ...definition, isUsed: await this.isUsed(userId, definition.name) };
  }

  /**
   * Hard delete. Safe for history: past mood logs keep their own text and
   * valence, so nothing is rewritten. The last definition cannot be removed,
   * which is also what stops the defaults from being re-seeded.
   */
  async delete(key: string, userId: string): Promise<void> {
    await this.ensureSeeded(userId);
    const existing = await prisma.moodDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Stato d\'umore non trovato', 404, 'NOT_FOUND');

    const total = await prisma.moodDefinition.count({ where: { userId } });
    if (total <= 1) {
      throw new AppError('Deve rimanere almeno uno stato d\'umore', 400, 'LAST_MOOD');
    }
    await prisma.moodDefinition.delete({ where: { id: existing.id } });
  }

  /**
   * Seed the shared defaults ONLY for a user with an empty catalog: re-adding
   * them on every call would make deletions come back.
   */
  private async ensureSeeded(userId: string): Promise<void> {
    const count = await prisma.moodDefinition.count({ where: { userId } });
    if (count > 0) return;
    await prisma.moodDefinition.createMany({
      data: DEFAULT_DEFINITIONS.map((definition) => ({ userId, ...definition })),
      skipDuplicates: true,
    });
  }

  private async isUsed(userId: string, name: string): Promise<boolean> {
    const match = await prisma.quickLog.findFirst({
      where: {
        userId,
        derivedCategory: 'MOOD',
        text: { contains: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return match !== null;
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.moodDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già uno stato d\'umore con questo nome', 409, 'DUPLICATE_MOOD');
    }
  }
}

export const moodDefinitionService = new MoodDefinitionService();
