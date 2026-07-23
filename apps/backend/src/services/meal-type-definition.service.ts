import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '@budget/shared';
import type {
  CreateMealTypeDefinitionDTO,
  MealTypeDefinitionDTO,
  UpdateMealTypeDefinitionDTO,
} from '@budget/shared';

const DEFAULT_DEFINITIONS = MEAL_TYPES.map((key, position) => ({
  key,
  name: MEAL_TYPE_LABELS[key].charAt(0).toUpperCase() + MEAL_TYPE_LABELS[key].slice(1),
  position,
  isDefault: true,
}));

class MealTypeDefinitionService {
  async list(userId: string, includeInactive = true): Promise<MealTypeDefinitionDTO[]> {
    await this.ensureDefaults(userId);
    const [definitions, usedTypes] = await Promise.all([
      prisma.mealTypeDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.meal.groupBy({
        by: ['mealType'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);
    const used = new Set(usedTypes.map((entry) => entry.mealType));
    return definitions.map((definition) => ({
      key: definition.key,
      name: definition.name,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed: used.has(definition.key),
    }));
  }

  async create(
    userId: string,
    data: CreateMealTypeDefinitionDTO
  ): Promise<MealTypeDefinitionDTO> {
    await this.ensureDefaults(userId);
    await this.assertUniqueName(userId, data.name);
    const last = await prisma.mealTypeDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const definition = await prisma.mealTypeDefinition.create({
      data: {
        userId,
        key: `custom-${randomUUID()}`,
        name: data.name.trim(),
        position: (last?.position ?? -1) + 1,
      },
    });
    return { ...definition, isUsed: false };
  }

  async update(
    key: string,
    userId: string,
    data: UpdateMealTypeDefinitionDTO
  ): Promise<MealTypeDefinitionDTO> {
    await this.ensureDefaults(userId);
    const existing = await prisma.mealTypeDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Tipo pasto non trovato', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);
    if (data.isActive === false && existing.isActive) {
      const activeCount = await prisma.mealTypeDefinition.count({ where: { userId, isActive: true } });
      if (activeCount <= 1) {
        throw new AppError(
          'Deve rimanere almeno un tipo pasto attivo',
          400,
          'LAST_ACTIVE_MEAL_TYPE'
        );
      }
    }
    const definition = await prisma.mealTypeDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        position: data.position,
        isActive: data.isActive,
      },
    });
    const isUsed = (await prisma.meal.count({ where: { userId, mealType: key } })) > 0;
    return { ...definition, isUsed };
  }

  async assertActive(userId: string, key: string): Promise<void> {
    await this.ensureDefaults(userId);
    const definition = await prisma.mealTypeDefinition.findFirst({
      where: { userId, key, isActive: true },
      select: { id: true },
    });
    if (!definition) {
      throw new AppError('Tipo pasto non valido o non attivo', 400, 'INVALID_MEAL_TYPE');
    }
  }

  async nameMap(userId: string): Promise<Map<string, string>> {
    const definitions = await this.list(userId);
    return new Map(definitions.map((definition) => [definition.key, definition.name]));
  }

  private async ensureDefaults(userId: string): Promise<void> {
    await prisma.$transaction(
      DEFAULT_DEFINITIONS.map((definition) =>
        prisma.mealTypeDefinition.upsert({
          where: { userId_key: { userId, key: definition.key } },
          create: { userId, ...definition },
          update: {},
        })
      )
    );
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.mealTypeDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già un tipo pasto con questo nome', 409, 'DUPLICATE_MEAL_TYPE');
    }
  }
}

export const mealTypeDefinitionService = new MealTypeDefinitionService();
