import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';
import { FOOD_CONFIG } from '@budget/shared';
import type {
  MealDTO,
  MealItemDTO,
  MealPhotoDTO,
  CreateMealDTO,
  UpdateMealDTO,
  CreateMealItemDTO,
  FoodSuggestionDTO,
  RepeatMealDTO,
  FrequentMealDTO,
  MealItemUnitDTO,
  MealTypeDTO,
} from '@budget/shared';
import type { Meal, MealItem, Prisma } from '@prisma/client';

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

type MealWithRelations = Meal & { items: MealItem[]; photo: { id: string } | null };

const mealInclude = {
  items: { orderBy: { position: 'asc' } },
  // Never pull the photo bytes into list queries - only its presence
  photo: { select: { id: true } },
} satisfies Prisma.MealInclude;

function decodePhotoDataUrl(dataUrl: string): { mimeType: string; data: Buffer } {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new AppError('Invalid photo data URL', 400, 'INVALID_PHOTO');
  }
  return { mimeType: match[1], data: Buffer.from(match[2], 'base64') };
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

class MealService {
  async getByRange(userId: string, from?: string, to?: string): Promise<MealDTO[]> {
    const meals = await prisma.meal.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: mealInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return meals.map((meal) => this.toDTO(meal, names));
  }

  async create(userId: string, data: CreateMealDTO): Promise<MealDTO> {
    await mealTypeDefinitionService.assertActive(userId, data.mealType);
    const meal = await prisma.meal.create({
      data: {
        userId,
        date: new Date(data.date),
        mealType: data.mealType,
        notes: data.notes || null,
        items: {
          create: data.items.map((item, index) => this.toItemCreate(item, index)),
        },
        ...(data.photo
          ? { photo: { create: decodePhotoDataUrl(data.photo.dataUrl) } }
          : {}),
      },
      include: mealInclude,
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return this.toDTO(meal, names);
  }

  async update(id: string, userId: string, data: UpdateMealDTO): Promise<MealDTO> {
    await this.assertOwned(id, userId);
    if (data.mealType !== undefined) {
      await mealTypeDefinitionService.assertActive(userId, data.mealType);
    }

    const meal = await prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.mealItem.deleteMany({ where: { mealId: id } });
      }
      if (data.photo === null) {
        await tx.mealPhoto.deleteMany({ where: { mealId: id } });
      } else if (data.photo) {
        const photo = decodePhotoDataUrl(data.photo.dataUrl);
        await tx.mealPhoto.upsert({
          where: { mealId: id },
          create: { mealId: id, ...photo },
          update: photo,
        });
      }
      return tx.meal.update({
        where: { id },
        data: {
          date: data.date !== undefined ? new Date(data.date) : undefined,
          mealType: data.mealType ?? undefined,
          notes: data.notes === undefined ? undefined : data.notes || null,
          ...(data.items !== undefined
            ? { items: { create: data.items.map((item, index) => this.toItemCreate(item, index)) } }
            : {}),
        },
        include: mealInclude,
      });
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return this.toDTO(meal, names);
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.assertOwned(id, userId);
    await prisma.meal.delete({ where: { id } });
  }

  /**
   * Autocomplete from the user's own meal_items history: partial
   * case-insensitive match, ranked by frequency then recency. The last used
   * quantity/unit are returned so selecting a suggestion prefills them.
   */
  async getSuggestions(userId: string, q: string, limit: number): Promise<FoodSuggestionDTO[]> {
    const items = await prisma.mealItem.findMany({
      where: {
        meal: { userId },
        foodName: { contains: q, mode: 'insensitive' },
      },
      include: { meal: { select: { date: true, createdAt: true } } },
      orderBy: { meal: { createdAt: 'desc' } },
      take: 500,
    });

    const groups = new Map<
      string,
      { foodName: string; count: number; lastUsedAt: string; lastQuantity: number | null; lastUnit: MealItemUnitDTO | null }
    >();
    for (const item of items) {
      const key = item.foodName.trim().toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Items arrive most-recent first, so the first one wins for prefill
        groups.set(key, {
          foodName: item.foodName.trim(),
          count: 1,
          lastUsedAt: toDateOnly(item.meal.date),
          lastQuantity: item.quantity,
          lastUnit: item.unit,
        });
      }
    }

    return [...groups.values()]
      .sort((a, b) => b.count - a.count || (a.lastUsedAt < b.lastUsedAt ? 1 : -1))
      .slice(0, limit);
  }

  /** "Ripeti ieri": items of yesterday's meal of the same type, or null */
  async getRepeatMeal(userId: string, date: string, mealType: MealTypeDTO): Promise<RepeatMealDTO | null> {
    const yesterday = new Date(date);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const meal = await prisma.meal.findFirst({
      where: { userId, mealType, date: yesterday },
      include: mealInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (!meal) return null;
    const names = await mealTypeDefinitionService.nameMap(userId);

    return {
      date: toDateOnly(meal.date),
      mealType: meal.mealType,
      mealTypeName: names.get(meal.mealType) ?? meal.mealType,
      notes: meal.notes,
      items: meal.items.map((item) => this.toItemInput(item)),
    };
  }

  /** Recurring meals grouped by identical set of items, offered as prefill */
  async getFrequentMeals(userId: string): Promise<FrequentMealDTO[]> {
    const meals = await prisma.meal.findMany({
      where: { userId },
      include: mealInclude,
      orderBy: { date: 'desc' },
      take: 500,
    });

    const groups = new Map<string, { count: number; sample: MealWithRelations }>();
    for (const meal of meals) {
      if (meal.items.length === 0) continue;
      const signature = meal.items
        .map((item) => `${item.foodName.trim().toLowerCase()}|${item.quantity ?? ''}|${item.unit ?? ''}`)
        .sort()
        .join(';');
      const existing = groups.get(signature);
      if (existing) {
        existing.count += 1;
      } else {
        // Meals arrive most-recent first: the sample keeps the latest casing
        groups.set(signature, { count: 1, sample: meal });
      }
    }

    const names = await mealTypeDefinitionService.nameMap(userId);
    return [...groups.entries()]
      .filter(([, group]) => group.count >= 2)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, FOOD_CONFIG.FREQUENT_MEALS_LIMIT)
      .map(([signature, group]) => ({
        signature,
        count: group.count,
        mealType: group.sample.mealType,
        mealTypeName: names.get(group.sample.mealType) ?? group.sample.mealType,
        lastDate: toDateOnly(group.sample.date),
        items: group.sample.items.map((item) => this.toItemInput(item)),
      }));
  }

  async getPhoto(mealId: string, userId: string): Promise<MealPhotoDTO> {
    await this.assertOwned(mealId, userId);
    const photo = await prisma.mealPhoto.findUnique({ where: { mealId } });
    if (!photo) {
      throw new AppError('Photo not found', 404, 'NOT_FOUND');
    }
    return {
      mealId,
      dataUrl: `data:${photo.mimeType};base64,${Buffer.from(photo.data).toString('base64')}`,
    };
  }

  private async assertOwned(id: string, userId: string): Promise<void> {
    const meal = await prisma.meal.findFirst({ where: { id, userId }, select: { id: true } });
    if (!meal) {
      throw new AppError('Meal not found', 404, 'NOT_FOUND');
    }
  }

  private toItemCreate(item: CreateMealItemDTO, index: number) {
    return {
      foodName: item.foodName.trim(),
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      position: index,
    };
  }

  private toItemInput(item: MealItem): CreateMealItemDTO {
    return { foodName: item.foodName, quantity: item.quantity, unit: item.unit };
  }

  private toDTO(meal: MealWithRelations, names: Map<string, string>): MealDTO {
    return {
      id: meal.id,
      date: toDateOnly(meal.date),
      mealType: meal.mealType,
      mealTypeName: names.get(meal.mealType) ?? meal.mealType,
      notes: meal.notes,
      hasPhoto: meal.photo !== null,
      createdAt: meal.createdAt.toISOString(),
      items: meal.items.map(
        (item): MealItemDTO => ({
          id: item.id,
          foodName: item.foodName,
          quantity: item.quantity,
          unit: item.unit,
          position: item.position,
        })
      ),
    };
  }
}

export const mealService = new MealService();
