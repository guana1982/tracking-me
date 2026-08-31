import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { MEAL_ITEM_UNITS, MEAL_ITEM_UNIT_LABELS } from '@budget/shared';
import type {
  CreateMealUnitDefinitionDTO,
  MealUnitDefinitionDTO,
  UpdateMealUnitDefinitionDTO,
} from '@budget/shared';

const DEFAULT_DEFINITIONS = MEAL_ITEM_UNITS.map((key, position) => ({
  key,
  name: MEAL_ITEM_UNIT_LABELS[key],
  position,
  isDefault: true,
}));

class MealUnitDefinitionService {
  async list(userId: string, includeInactive = true): Promise<MealUnitDefinitionDTO[]> {
    await this.ensureDefaults(userId);
    const [definitions, usedUnits] = await Promise.all([
      prisma.mealUnitDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.mealItem.findMany({
        where: { meal: { userId }, unit: { not: null } },
        distinct: ['unit'],
        select: { unit: true },
      }),
    ]);
    const used = new Set(usedUnits.flatMap((entry) => (entry.unit ? [entry.unit] : [])));
    return definitions.map((definition) => ({
      key: definition.key,
      name: definition.name,
      position: definition.position,
      isActive: definition.isActive,
      isDefault: definition.isDefault,
      isUsed: used.has(definition.key),
    }));
  }

  async create(userId: string, data: CreateMealUnitDefinitionDTO): Promise<MealUnitDefinitionDTO> {
    await this.ensureDefaults(userId);
    await this.assertUniqueName(userId, data.name);
    const last = await prisma.mealUnitDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const definition = await prisma.mealUnitDefinition.create({
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
    data: UpdateMealUnitDefinitionDTO
  ): Promise<MealUnitDefinitionDTO> {
    await this.ensureDefaults(userId);
    const existing = await prisma.mealUnitDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Unità non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);
    const definition = await prisma.mealUnitDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        position: data.position,
        isActive: data.isActive,
      },
    });
    const isUsed =
      (await prisma.mealItem.count({ where: { meal: { userId }, unit: key } })) > 0;
    return { ...definition, isUsed };
  }

  async assertExists(userId: string, key: string): Promise<void> {
    await this.ensureDefaults(userId);
    const definition = await prisma.mealUnitDefinition.findFirst({
      where: { userId, key },
      select: { id: true },
    });
    if (!definition) {
      throw new AppError('Unità non valida', 400, 'INVALID_MEAL_UNIT');
    }
  }

  async nameMap(userId: string): Promise<Map<string, string>> {
    const definitions = await this.list(userId);
    return new Map(definitions.map((definition) => [definition.key, definition.name]));
  }

  private async ensureDefaults(userId: string): Promise<void> {
    await prisma.$transaction(
      DEFAULT_DEFINITIONS.map((definition) =>
        prisma.mealUnitDefinition.upsert({
          where: { userId_key: { userId, key: definition.key } },
          create: { userId, ...definition },
          update: {},
        })
      )
    );
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.mealUnitDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già un’unità con questo nome', 409, 'DUPLICATE_MEAL_UNIT');
    }
  }
}

export const mealUnitDefinitionService = new MealUnitDefinitionService();
