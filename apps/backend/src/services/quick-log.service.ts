import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';
import { classifyQuickLog, FOOD_CONFIG } from '@budget/shared';
import type {
  QuickLogDTO,
  CreateQuickLogDTO,
  UpdateQuickLogDTO,
  RecalculateQuickLogsResultDTO,
} from '@budget/shared';
import type { Meal, QuickLog } from '@prisma/client';

type QuickLogWithMeal = QuickLog & {
  meal: Pick<Meal, 'id' | 'date' | 'mealType'> | null;
};

const quickLogInclude = {
  meal: { select: { id: true, date: true, mealType: true } },
} as const;

class QuickLogService {
  async getByRange(userId: string, from?: string, to?: string): Promise<QuickLogDTO[]> {
    // Widen by one day on both sides: the frontend groups by LOCAL date,
    // which can differ from the UTC date at the edges of the range
    const gte = from ? new Date(new Date(from).getTime() - 24 * 3600 * 1000) : undefined;
    const lt = to ? new Date(new Date(to).getTime() + 2 * 24 * 3600 * 1000) : undefined;

    const logs = await prisma.quickLog.findMany({
      where: {
        userId,
        ...(gte || lt ? { loggedAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } } : {}),
      },
      include: quickLogInclude,
      orderBy: { loggedAt: 'asc' },
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return logs.map((log) => this.toDTO(log, names));
  }

  /**
   * Save the raw text, classify it via keyword dictionaries and silently link
   * it to the most recent meal inserted within the last 4 hours (if any).
   * The user confirms nothing: text in, done.
   */
  async create(userId: string, data: CreateQuickLogDTO): Promise<QuickLogDTO> {
    const loggedAt = data.loggedAt ? new Date(data.loggedAt) : new Date();
    const derived = classifyQuickLog(data.text);
    // Structured entries (mood picker) pin their own meaning: the explicit
    // value wins and is flagged manual, so recalculate() never rewrites it.
    // `undefined` means nobody said, and the dictionaries answer; `null` is an
    // answer - the free day note refuses a classification, and both flags stay
    // manual so no later recompute can hand it one
    const category = data.derivedCategory !== undefined ? data.derivedCategory : derived.category;
    const valence = data.derivedValence !== undefined ? data.derivedValence : derived.valence;

    const linkWindowStart = new Date(
      loggedAt.getTime() - FOOD_CONFIG.MEAL_LINK_WINDOW_HOURS * 3600 * 1000
    );
    // Meals only carry a day, so the insertion moment is the time proxy
    const recentMeal = await prisma.meal.findFirst({
      where: { userId, createdAt: { gte: linkWindowStart, lte: loggedAt } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const log = await prisma.quickLog.create({
      data: {
        userId,
        loggedAt,
        text: data.text,
        mealId: recentMeal?.id ?? null,
        derivedCategory: category,
        derivedValence: valence,
        categoryManual: data.derivedCategory !== undefined,
        valenceManual: data.derivedValence !== undefined,
      },
      include: quickLogInclude,
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return this.toDTO(log, names);
  }

  /**
   * Text edits re-run the classification, but a manual correction always
   * wins: once categoryManual/valenceManual is set, recompute skips it.
   */
  async update(id: string, userId: string, data: UpdateQuickLogDTO): Promise<QuickLogDTO> {
    const existing = await prisma.quickLog.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Quick log not found', 404, 'NOT_FOUND');
    }

    let derivedCategory = existing.derivedCategory;
    let derivedValence = existing.derivedValence;
    let categoryManual = existing.categoryManual;
    let valenceManual = existing.valenceManual;

    if (data.text !== undefined && data.text !== existing.text) {
      const { category, valence } = classifyQuickLog(data.text);
      if (!categoryManual) derivedCategory = category;
      if (!valenceManual) derivedValence = valence;
    }
    if (data.derivedCategory !== undefined) {
      derivedCategory = data.derivedCategory;
      categoryManual = true;
    }
    if (data.derivedValence !== undefined) {
      derivedValence = data.derivedValence;
      valenceManual = true;
    }

    const log = await prisma.quickLog.update({
      where: { id },
      data: {
        text: data.text ?? undefined,
        derivedCategory,
        derivedValence,
        categoryManual,
        valenceManual,
      },
      include: quickLogInclude,
    });
    const names = await mealTypeDefinitionService.nameMap(userId);
    return this.toDTO(log, names);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.quickLog.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) {
      throw new AppError('Quick log not found', 404, 'NOT_FOUND');
    }
    await prisma.quickLog.delete({ where: { id } });
  }

  /**
   * Re-run the dictionaries over the whole history (e.g. after extending
   * them). Manual corrections are preserved per-field.
   */
  async recalculate(userId: string): Promise<RecalculateQuickLogsResultDTO> {
    const logs = await prisma.quickLog.findMany({ where: { userId } });
    let updated = 0;

    for (const log of logs) {
      if (log.categoryManual && log.valenceManual) continue;
      const { category, valence } = classifyQuickLog(log.text);
      const nextCategory = log.categoryManual ? log.derivedCategory : category;
      const nextValence = log.valenceManual ? log.derivedValence : valence;
      if (nextCategory === log.derivedCategory && nextValence === log.derivedValence) continue;

      await prisma.quickLog.update({
        where: { id: log.id },
        data: { derivedCategory: nextCategory, derivedValence: nextValence },
      });
      updated += 1;
    }

    return { updated, total: logs.length };
  }

  private toDTO(log: QuickLogWithMeal, names: Map<string, string>): QuickLogDTO {
    return {
      id: log.id,
      loggedAt: log.loggedAt.toISOString(),
      text: log.text,
      linkedMeal: log.meal
        ? {
            id: log.meal.id,
            date: log.meal.date.toISOString().slice(0, 10),
            mealType: log.meal.mealType,
            mealTypeName: names.get(log.meal.mealType) ?? log.meal.mealType,
          }
        : null,
      derivedCategory: log.derivedCategory,
      derivedValence: log.derivedValence,
      categoryManual: log.categoryManual,
      valenceManual: log.valenceManual,
    };
  }
}

export const quickLogService = new QuickLogService();
