import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { roundCurrency } from '../lib/utils.js';
import type {
  SpendingCategoryDTO,
  CreateSpendingCategoryDTO,
  UpdateSpendingCategoryDTO,
  ReclassifyResultDTO,
  SpendingBreakdownDTO,
  SpendingBreakdownItemDTO,
} from '@budget/shared';

// Default dictionary built from the user's real expense history (99.8% coverage on
// Jan-Jul 2026 data). Order matters: rules are evaluated top-to-bottom and the first
// match wins, so specific merchants/brands come before generic words like "spesa".
// Keywords are regexes tested against the normalized label (lowercase, accents
// stripped, "Tricount Io/Fra:" prefix removed).
const DEFAULT_CATEGORIES: { name: string; color: string; keywords: string[] }[] = [
  { name: 'Abbonamenti', color: '#8b5cf6', keywords: ['netflix', 'openai', '\\bgpt\\b', 'claude', 'railway', 'google drive', 'amazon prime', 'abbonamento', 'spotify', 'disney'] },
  { name: 'Telefonia & Internet', color: '#06b6d4', keywords: ['\\bwind', 'tim mobile', '\\btim\\b', 'iliad', 'vodafone'] },
  { name: 'Bollette & Utenze', color: '#eab308', keywords: ['bolletta', '\\bluce\\b', 'octupus', 'octopus', 'ocutpus', 'ocupus', '\\bvus\\b', '\\btari\\b', '\\bgas\\b', '\\benel\\b'] },
  { name: 'Mutuo & Assicurazioni', color: '#64748b', keywords: ['mutuo', '\\barca\\b', 'assicura'] },
  { name: 'Banca & Commissioni', color: '#475569', keywords: ['bper', 'commission', 'bonifi', 'prelievo', '\\batm\\b', 'competenze', 'oneri', 'nuova carta', 'revolut'] },
  { name: 'Salute & Farmacia', color: '#ef4444', keywords: ['farmacia', 'antibiotic', 'fermenti', 'tachipirina', 'nurofen', '\\boki\\b', 'tampone', 'streptococco', 'visita', 'ecograf', 'ecocolordoppler', 'pomata', 'vitamin', 'integrator', 'medicin', 'sciroppo', 'scirippo', 'mascherine', 'allattamento', 'allettamento', 'termometro', 'magnesio', '\\baloe\\b', 'cordone', 'anestesic'] },
  { name: 'Sport & Fitness', color: '#84cc16', keywords: ['palestra', 'creatina', 'proteine', 'whey', 'omega', 'dischetti', 'atletica', 'piscina', 'decathlon'] },
  { name: 'Auto & Trasporti', color: '#f97316', keywords: ['diesel', 'metano', 'benzina', '\\bgpl\\b', 'autostrada', 'parcheggio', '\\bbollo\\b', 'gomme', 'batteria', 'carro attrezzi', 'lavaggio auto', 'noleggio', 'lancia', 'fiat', 'officina', 'meccanico', 'treno', 'biglietto bus'] },
  { name: 'Bar & Colazioni', color: '#d97706', keywords: ['colazione', 'caffe', 'gelato', 'spremuta', 'patatine', 'goleador', 'deteinato', 'frulleria', 'merenda', '\\bbar\\b'] },
  { name: 'Ristoranti & Cene', color: '#f43f5e', keywords: ['\\bcena\\b', 'pranzo', 'ristorante', 'pizz', 'mcdonald', 'mc donald', 'hamburger', 'aperitivo', 'birr', 'sushi', 'cinese', 'toast', 'autogrill', 'taverna', '\\bbrace\\b', 'panini', 'kebab'] },
  { name: 'Regali', color: '#ec4899', keywords: ['regal', 'compleanno', 'uovo pasqua', 'anello'] },
  { name: 'Vacanze & Viaggi', color: '#14b8a6', keywords: ['hotel', 'vacanz', 'ombrellone', 'materassino', 'telo mare', 'campeggio', '\\bvolo\\b', 'airbnb', 'booking'] },
  { name: 'Abbigliamento', color: '#a855f7', keywords: ['scarpe', 'magliett', 'tshirt', 't-shirt', 'vestiti', 'fantasmini', 'ciabatte', 'pantaloni', '\\bovs\\b', 'felpa', 'giacca', 'calzini'] },
  { name: 'Cura personale', color: '#c084fc', keywords: ['barbiere', 'barba', 'justformen', 'parrucch', 'estetist', 'tinta'] },
  { name: 'Documenti & Burocrazia', color: '#78716c', keywords: ['carta identita', 'fototessera', 'passaporto'] },
  { name: 'Figli', color: '#3b82f6', keywords: ['\\bgab\\b', 'gabriele', '\\bbea\\b', 'beatrice', 'asilo', '\\bnido\\b', 'pannolini', 'ciucc', 'svezzamento', 'aptamil', 'latte artificiale', 'tiralatte', 'scaldabiberon', 'biberon', 'giostre', 'macchinine', 'gettoni', '\\blego\\b', 'pikachu', 'bimbostore', 'laboratorio', 'luna park', 'cinema', 'teatro', 'bambin', '\\bbimb'] },
  { name: 'Casa & Manutenzione', color: '#0ea5e9', keywords: ['pulizie', 'leroy', 'bricofer', 'mensole', 'silicone', 'antimuffa', 'detersiv', 'lavanderia', 'lavaggio', 'dyson', 'libreria', '\\bdeghi\\b', 'lampadin', 'condizionator', 'caldaia', 'cuscino', 'tovagliett', 'trapunta', 'risparmio casa', 'sacchetti', '\\bcasa\\b', 'ikea', 'mobile per'] },
  { name: 'Spesa & Supermercato', color: '#22c55e', keywords: ['\\bspesa\\b', '\\bcoop\\b', 'conad', 'eurospin', '\\blidl\\b', 'esselunga', 'ticket', 'buoni pasto', '\\blatte\\b', 'acqua', '\\bpane\\b', 'edenred', 'supermercato'] },
];

// Seeded rules start at priority 1000 so user-added rules (priority 0) always win
const SEED_PRIORITY_BASE = 1000;

const UNCLASSIFIED_NAME = 'Altro';
const UNCLASSIFIED_COLOR = '#94a3b8';

type RuleWithCategory = { spendingCategoryId: string; keyword: string };

export class SpendingCategoryService {
  /**
   * Normalize an expense label for keyword matching:
   * lowercase, accents stripped, tricount prefix removed, whitespace collapsed
   */
  normalizeLabel(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/^tricount (io|fra):\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Classify a label against an ordered rule list. First match wins.
   * Invalid regexes (possible with user-entered keywords) fall back to literal match.
   */
  classifyLabel(label: string, rules: RuleWithCategory[]): string | null {
    const text = this.normalizeLabel(label);
    for (const rule of rules) {
      const keyword = this.normalizeLabel(rule.keyword);
      let matched: boolean;
      try {
        matched = new RegExp(keyword).test(text);
      } catch {
        matched = text.includes(keyword);
      }
      if (matched) return rule.spendingCategoryId;
    }
    return null;
  }

  /**
   * Seed the default dictionary for a user who has no spending categories yet.
   * Idempotent: does nothing if any category already exists.
   */
  async ensureDefaults(userId: string): Promise<void> {
    const count = await prisma.spendingCategory.count({ where: { userId } });
    if (count > 0) return;

    let priority = SEED_PRIORITY_BASE;
    for (const [index, def] of DEFAULT_CATEGORIES.entries()) {
      await prisma.spendingCategory.create({
        data: {
          userId,
          name: def.name,
          color: def.color,
          sortOrder: index,
          rules: {
            create: def.keywords.map((keyword) => ({ keyword, priority: priority++ })),
          },
        },
      });
    }
  }

  /**
   * Load the user's rules in evaluation order (user-added first, then seeded)
   */
  async getOrderedRules(userId: string): Promise<RuleWithCategory[]> {
    await this.ensureDefaults(userId);
    return prisma.categoryRule.findMany({
      where: { spendingCategory: { userId } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: { spendingCategoryId: true, keyword: true },
    });
  }

  /**
   * Classify a single expense label for a user (used on expense create/update)
   */
  async classifyForUser(userId: string, label: string): Promise<string | null> {
    const rules = await this.getOrderedRules(userId);
    return this.classifyLabel(label, rules);
  }

  /**
   * Get all categories with their rules (user-scoped)
   */
  async getAll(userId: string): Promise<SpendingCategoryDTO[]> {
    await this.ensureDefaults(userId);
    const categories = await prisma.spendingCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        rules: { orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    return categories.map((cat: (typeof categories)[number]) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      sortOrder: cat.sortOrder,
      rules: cat.rules.map((rule: (typeof cat.rules)[number]) => ({
        id: rule.id,
        keyword: rule.keyword,
        priority: rule.priority,
      })),
    }));
  }

  /**
   * Create a category, optionally with initial keywords (priority 0 = they win
   * over the seeded dictionary)
   */
  async create(userId: string, data: CreateSpendingCategoryDTO): Promise<SpendingCategoryDTO> {
    await this.ensureDefaults(userId);

    const existing = await prisma.spendingCategory.findFirst({
      where: { userId, name: data.name },
    });
    if (existing) {
      throw new AppError(`Category "${data.name}" already exists`, 409, 'DUPLICATE_CATEGORY');
    }

    const maxSort = await prisma.spendingCategory.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const category = await prisma.spendingCategory.create({
      data: {
        userId,
        name: data.name,
        color: data.color ?? UNCLASSIFIED_COLOR,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        rules: {
          create: (data.keywords ?? []).map((keyword) => ({ keyword, priority: 0 })),
        },
      },
      include: { rules: { orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] } },
    });

    return {
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder,
      rules: category.rules.map((rule: (typeof category.rules)[number]) => ({
        id: rule.id,
        keyword: rule.keyword,
        priority: rule.priority,
      })),
    };
  }

  /**
   * Update a category's name/color (user-scoped)
   */
  async update(id: string, userId: string, data: UpdateSpendingCategoryDTO): Promise<void> {
    const category = await prisma.spendingCategory.findFirst({ where: { id, userId } });
    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }
    await prisma.spendingCategory.update({
      where: { id },
      data: { name: data.name ?? undefined, color: data.color ?? undefined },
    });
  }

  /**
   * Delete a category: its expenses go back to unclassified (FK is SET NULL)
   */
  async delete(id: string, userId: string): Promise<void> {
    const category = await prisma.spendingCategory.findFirst({ where: { id, userId } });
    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }
    await prisma.spendingCategory.delete({ where: { id } });
  }

  /**
   * Add a keyword rule to a category (priority 0: wins over the seeded dictionary)
   */
  async addRule(categoryId: string, userId: string, keyword: string): Promise<void> {
    const category = await prisma.spendingCategory.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }
    await prisma.categoryRule.create({
      data: { spendingCategoryId: categoryId, keyword, priority: 0 },
    });
  }

  /**
   * Delete a keyword rule (user-scoped)
   */
  async deleteRule(ruleId: string, userId: string): Promise<void> {
    const rule = await prisma.categoryRule.findFirst({
      where: { id: ruleId, spendingCategory: { userId } },
    });
    if (!rule) {
      throw new AppError('Rule not found', 404, 'NOT_FOUND');
    }
    await prisma.categoryRule.delete({ where: { id: ruleId } });
  }

  /**
   * Re-run the classifier over the user's whole expense history.
   * SAVINGS transfers are excluded and manual overrides are preserved.
   */
  async reclassifyAll(userId: string): Promise<ReclassifyResultDTO> {
    const rules = await this.getOrderedRules(userId);

    const expenses = await prisma.expense.findMany({
      where: { monthPeriod: { userId }, category: { not: 'SAVINGS' } },
      select: { id: true, label: true, spendingCategoryId: true, spendingCategoryManual: true },
    });

    let classified = 0;
    let unclassified = 0;
    let skippedManual = 0;
    // Group updates by target category to batch them with updateMany
    const idsByTarget = new Map<string | null, string[]>();

    for (const expense of expenses) {
      if (expense.spendingCategoryManual) {
        skippedManual++;
        continue;
      }
      const target = this.classifyLabel(expense.label, rules);
      if (target) classified++;
      else unclassified++;
      if (target !== expense.spendingCategoryId) {
        if (!idsByTarget.has(target)) idsByTarget.set(target, []);
        idsByTarget.get(target)!.push(expense.id);
      }
    }

    for (const [target, ids] of idsByTarget) {
      await prisma.expense.updateMany({
        where: { id: { in: ids } },
        data: { spendingCategoryId: target },
      });
    }

    return { classified, unclassified, skippedManual };
  }

  /**
   * Spending breakdown by category for a period ("Dove sono andati i soldi").
   * SAVINGS transfers are excluded; unmatched expenses land in the "Altro" bucket.
   */
  async getBreakdown(periodKey: string, userId: string): Promise<SpendingBreakdownDTO> {
    const period = await prisma.monthPeriod.findFirst({
      where: { periodKey, userId },
      include: {
        expenses: {
          where: { category: { not: 'SAVINGS' } },
          select: { amount: true, spendingCategoryId: true },
        },
      },
    });

    if (!period) {
      throw new AppError(`Month period ${periodKey} not found`, 404, 'NOT_FOUND');
    }

    const categories = await prisma.spendingCategory.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
    });
    const categoryById = new Map<string, { name: string; color: string }>(
      categories.map((cat: { id: string; name: string; color: string }) => [
        cat.id,
        { name: cat.name, color: cat.color },
      ])
    );

    const buckets = new Map<string | null, { total: number; count: number }>();
    let total = 0;
    for (const expense of period.expenses) {
      const key = expense.spendingCategoryId ?? null;
      if (!buckets.has(key)) buckets.set(key, { total: 0, count: 0 });
      const bucket = buckets.get(key)!;
      bucket.total += expense.amount;
      bucket.count++;
      total += expense.amount;
    }

    const items: SpendingBreakdownItemDTO[] = [...buckets.entries()]
      .map(([categoryId, bucket]) => {
        const meta = categoryId ? categoryById.get(categoryId) : undefined;
        return {
          categoryId,
          name: meta?.name ?? UNCLASSIFIED_NAME,
          color: meta?.color ?? UNCLASSIFIED_COLOR,
          total: roundCurrency(bucket.total),
          count: bucket.count,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { periodKey, total: roundCurrency(total), items };
  }
}

export const spendingCategoryService = new SpendingCategoryService();
